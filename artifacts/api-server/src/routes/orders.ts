import { Router, type IRouter } from "express";
import { eq, ilike, and, or, sql, count, desc, gte, lte } from "drizzle-orm";
import { db, ordersTable, vendorsTable, ridersTable, stationsTable, orderCommentsTable, orderStatusHistoryTable, usersTable, notificationsTable, riderInventoryTable, riderCommissionsTable, stockTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { createAuditLog } from "../lib/audit";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

function generateOrderCode(): string {
  const prefix = "SS";
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

async function checkDuplicate(order: { customerPhone: string; customerName: string; productName: string; address: string; vendorId: number }, excludeId?: number) {
  const sinceYesterday = new Date();
  sinceYesterday.setDate(sinceYesterday.getDate() - 2);

  const recent = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.customerPhone, order.customerPhone),
      sql`${ordersTable.createdAt} >= ${sinceYesterday.toISOString()}`,
      excludeId ? sql`${ordersTable.id} != ${excludeId}` : sql`1=1`
    ));

  if (recent.length === 0) return null;

  for (const existing of recent) {
    const matchedFields: string[] = [];
    if (existing.customerPhone === order.customerPhone) matchedFields.push("phone");
    if (existing.customerName.toLowerCase() === order.customerName.toLowerCase()) matchedFields.push("customer_name");
    if (existing.address.toLowerCase() === order.address.toLowerCase()) matchedFields.push("address");
    if (existing.productName.toLowerCase() === order.productName.toLowerCase()) matchedFields.push("product");
    if (existing.vendorId === order.vendorId) matchedFields.push("vendor");

    if (matchedFields.length >= 2) {
      const confidence = matchedFields.length >= 4 ? "high" : matchedFields.length >= 3 ? "medium" : "low";
      return {
        matchedOrderId: existing.id,
        matchedFields,
        confidence,
        reason: `Matched fields: ${matchedFields.join(", ")}`,
      };
    }
  }
  return null;
}

async function formatOrder(o: typeof ordersTable.$inferSelect, viewerVendorId?: number) {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, o.vendorId));
  let riderName: string | null = null;
  if (o.riderId) {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, o.riderId));
    riderName = rider?.name ?? null;
  }
  let stationName: string | null = null;
  if (o.stationId) {
    const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, o.stationId));
    stationName = station?.name ?? null;
  }

  // For vendor viewers: only show duplicate info if the matched order is within the same vendor
  let duplicateFlag = o.duplicateFlag;
  let duplicateReason = o.duplicateReason;
  let matchedOrderId = o.matchedOrderId;
  let duplicateConfidence = o.duplicateConfidence;
  let status = o.status;

  if (viewerVendorId && o.duplicateFlag) {
    let isSameVendorDuplicate = false;
    if (o.matchedOrderId) {
      const [matchedOrder] = await db.select({ vendorId: ordersTable.vendorId })
        .from(ordersTable).where(eq(ordersTable.id, o.matchedOrderId));
      isSameVendorDuplicate = matchedOrder?.vendorId === viewerVendorId;
    }
    if (!isSameVendorDuplicate) {
      duplicateFlag = false;
      duplicateReason = null;
      matchedOrderId = null;
      duplicateConfidence = null;
      if (status === "duplicate_flagged") status = "new";
    }
  }

  return {
    id: o.id,
    orderCode: o.orderCode,
    vendorId: o.vendorId,
    vendorName: vendor?.name ?? "Unknown",
    vendorCode: vendor?.vendorCode ?? "",
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    alternatePhone: o.alternatePhone,
    productName: o.productName,
    productSku: o.productSku,
    quantity: o.quantity,
    codAmount: Number(o.codAmount),
    deliveryCharge: Number(o.deliveryCharge),
    vendorPayable: Number(o.vendorPayable),
    address: o.address,
    landmark: o.landmark,
    area: o.area,
    city: o.city,
    district: o.district,
    stationId: o.stationId,
    stationName,
    riderId: o.riderId,
    riderName,
    priority: o.priority,
    requestedDeliveryTime: o.requestedDeliveryTime,
    status,
    duplicateFlag,
    duplicateReason,
    matchedOrderId,
    duplicateConfidence,
    paymentReleaseStatus: o.paymentReleaseStatus,
    notes: o.notes,
    internalNote: o.internalNote,
    createdBy: o.createdBy,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    followupDate: o.followupDate ? o.followupDate.toISOString() : null,
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { status, vendorId, riderId, stationId, dateFrom, dateTo, search, duplicateOnly, page = "1", limit = "20" } = req.query as Record<string, string>;

  const conditions: any[] = [];
  let viewerVendorId: number | undefined;

  // Vendor sees only their orders
  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (vendor) { conditions.push(eq(ordersTable.vendorId, vendor.id)); viewerVendorId = vendor.id; }
    else { res.json({ orders: [], total: 0, page: 1, limit: 20 }); return; }
  }
  // Rider sees only assigned orders
  else if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (rider) conditions.push(eq(ordersTable.riderId, rider.id));
    else { res.json({ orders: [], total: 0, page: 1, limit: 20 }); return; }
  }

  if (status) conditions.push(eq(ordersTable.status, status));
  if (vendorId) conditions.push(eq(ordersTable.vendorId, parseInt(vendorId, 10)));
  if (riderId) conditions.push(eq(ordersTable.riderId, parseInt(riderId, 10)));
  if (stationId) conditions.push(eq(ordersTable.stationId, parseInt(stationId, 10)));
  if (duplicateOnly === "true") conditions.push(eq(ordersTable.duplicateFlag, true));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(ordersTable.createdAt, new Date(dateTo)));
  if (search) conditions.push(or(
    ilike(ordersTable.customerName, `%${search}%`),
    ilike(ordersTable.customerPhone, `%${search}%`),
    ilike(ordersTable.orderCode, `%${search}%`),
  )!);

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(ordersTable).where(whereClause);
  const orders = await db.select().from(ordersTable).where(whereClause)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limitNum).offset(offset);

  const formatted = await Promise.all(orders.map((o) => formatOrder(o, viewerVendorId)));
  res.json({ orders: formatted, total: Number(total), page: pageNum, limit: limitNum });
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { vendorId, customerName, customerPhone, alternatePhone, productName, productSku,
    quantity, codAmount, address, landmark, area, city, district, stationId, priority, requestedDeliveryTime, notes } = req.body;

  if (!vendorId || !customerName || !customerPhone || !productName || !codAmount || !address) {
    res.status(400).json({ error: "vendorId, customerName, customerPhone, productName, codAmount, address required" });
    return;
  }

  // Vendor ownership check
  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor || vendor.id !== vendorId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
  if (!vendor) { res.status(400).json({ error: "Vendor not found" }); return; }

  const deliveryCharge = Number(vendor.deliveryCharge);
  const cod = Number(codAmount);
  const vendorPayable = cod - deliveryCharge;

  // Duplicate check
  const duplicate = await checkDuplicate({ customerPhone, customerName, productName, address, vendorId });

  const [order] = await db.insert(ordersTable).values({
    orderCode: generateOrderCode(),
    vendorId,
    customerName,
    customerPhone,
    alternatePhone: alternatePhone ?? null,
    productName,
    productSku: productSku ?? null,
    quantity: quantity ?? 1,
    codAmount: String(cod),
    deliveryCharge: String(deliveryCharge),
    vendorPayable: String(vendorPayable),
    address,
    landmark: landmark ?? null,
    area: area ?? null,
    city: city ?? null,
    district: district ?? null,
    stationId: stationId ?? null,
    priority: priority ?? "normal",
    requestedDeliveryTime: requestedDeliveryTime ?? null,
    status: duplicate ? "duplicate_flagged" : "new",
    duplicateFlag: !!duplicate,
    duplicateReason: duplicate?.reason ?? null,
    matchedOrderId: duplicate?.matchedOrderId ?? null,
    duplicateConfidence: duplicate?.confidence ?? null,
    notes: notes ?? null,
    createdBy: userId,
  }).returning();

  // Status history
  await db.insert(orderStatusHistoryTable).values({
    orderId: order.id,
    status: order.status,
    changedBy: userId,
    note: "Order created",
  });

  await createAuditLog({ userId, action: "create", entity: "order", entityId: order.id, description: `Created order ${order.orderCode}` });

  // Notify all admins and managers about the new order
  const adminUsers = await db.select().from(usersTable).where(
    or(eq(usersTable.role, "admin"), eq(usersTable.role, "manager"))
  );
  for (const adminUser of adminUsers) {
    await createNotification({
      userId: adminUser.id,
      title: "New Order Created",
      message: `Order ${order.orderCode} created by ${vendor.name}`,
      type: "new_order",
      relatedId: order.id,
    });
  }

  res.status(201).json(await formatOrder(order));
});

router.post("/orders/bulk", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const { vendorId, orders: ordersList } = req.body;
  if (!vendorId || !Array.isArray(ordersList)) {
    res.status(400).json({ error: "vendorId and orders array required" }); return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
  if (!vendor) { res.status(400).json({ error: "Vendor not found" }); return; }

  const results: any[] = [];
  const errors: any[] = [];
  let created = 0;
  let failed = 0;

  for (let i = 0; i < ordersList.length; i++) {
    const o = ordersList[i];
    try {
      // Validate required fields
      if (!o.customerName) { errors.push({ rowIndex: i, field: "customerName", message: "Customer name required" }); failed++; continue; }
      if (!o.customerPhone) { errors.push({ rowIndex: i, field: "customerPhone", message: "Phone required" }); failed++; continue; }
      if (!o.productName) { errors.push({ rowIndex: i, field: "productName", message: "Product required" }); failed++; continue; }
      if (!o.codAmount) { errors.push({ rowIndex: i, field: "codAmount", message: "COD amount required" }); failed++; continue; }
      if (!o.address) { errors.push({ rowIndex: i, field: "address", message: "Address required" }); failed++; continue; }

      // Nepal phone validation
      const phoneClean = o.customerPhone.replace(/[\s\-+]/g, "");
      if (!/^(98|97|96|01)\d{7,8}$/.test(phoneClean) && !/^\d{9,10}$/.test(phoneClean)) {
        errors.push({ rowIndex: i, field: "customerPhone", message: "Invalid Nepal phone number" }); failed++; continue;
      }

      const deliveryCharge = Number(vendor.deliveryCharge);
      const cod = Number(o.codAmount);
      const vendorPayable = cod - deliveryCharge;

      const duplicate = await checkDuplicate({ customerPhone: phoneClean, customerName: o.customerName, productName: o.productName, address: o.address, vendorId });

      const [order] = await db.insert(ordersTable).values({
        orderCode: generateOrderCode(),
        vendorId,
        customerName: o.customerName,
        customerPhone: phoneClean,
        alternatePhone: o.alternatePhone ?? null,
        productName: o.productName,
        quantity: o.quantity ?? 1,
        codAmount: String(cod),
        deliveryCharge: String(deliveryCharge),
        vendorPayable: String(vendorPayable),
        address: o.address,
        landmark: o.landmark ?? null,
        area: o.area ?? null,
        city: o.city ?? null,
        stationId: o.stationId ?? null,
        status: duplicate ? "duplicate_flagged" : "new",
        duplicateFlag: !!duplicate,
        duplicateReason: duplicate?.reason ?? null,
        matchedOrderId: duplicate?.matchedOrderId ?? null,
        duplicateConfidence: duplicate?.confidence ?? null,
        priority: o.priority ?? "normal",
        createdBy: userId,
      }).returning();

      await db.insert(orderStatusHistoryTable).values({ orderId: order.id, status: order.status, changedBy: userId });
      results.push(await formatOrder(order));
      created++;
    } catch (err) {
      errors.push({ rowIndex: i, field: "general", message: String(err) });
      failed++;
    }
  }

  // Notify admins/managers about bulk order creation
  if (created > 0) {
    const [bulkVendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
    const adminManagerUsers = await db.select().from(usersTable).where(
      or(eq(usersTable.role, "admin"), eq(usersTable.role, "manager"))
    );
    for (const adminUser of adminManagerUsers) {
      await createNotification({
        userId: adminUser.id,
        title: "Bulk Orders Created",
        message: `${created} new order${created > 1 ? "s" : ""} created in bulk by ${bulkVendor?.name ?? "vendor"}`,
        type: "new_order",
        relatedId: undefined,
      });
    }
  }

  res.status(201).json({ created, failed, errors, orders: results });
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Vendor can only see their own orders
  let viewerVendorId: number | undefined;
  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor || vendor.id !== order.vendorId) { res.status(403).json({ error: "Forbidden" }); return; }
    viewerVendorId = vendor.id;
  }
  // Rider can only see assigned orders
  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider || rider.id !== order.riderId) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const comments = await db.select().from(orderCommentsTable).where(eq(orderCommentsTable.orderId, id));
  const statusHistory = await db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id));

  const commentUsers = await Promise.all(comments.map(async (c) => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, c.userId));
    return { id: c.id, orderId: c.orderId, userId: c.userId, userName: u?.name ?? "Unknown", userRole: u?.role ?? "unknown", content: c.content, visibility: c.visibility, createdAt: c.createdAt.toISOString() };
  }));

  const historyFormatted = await Promise.all(statusHistory.map(async (h) => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, h.changedBy));
    return { id: h.id, orderId: h.orderId, status: h.status, changedBy: h.changedBy, changedByName: u?.name ?? "Unknown", note: h.note, createdAt: h.createdAt.toISOString() };
  }));

  res.json({ order: await formatOrder(order, viewerVendorId), comments: commentUsers, statusHistory: historyFormatted });
});

router.patch("/orders/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { customerName, customerPhone, alternatePhone, productName, quantity, codAmount, address, landmark, area, stationId, priority, notes, internalNote } = req.body;
  if (customerName) updates.customerName = customerName;
  if (customerPhone) updates.customerPhone = customerPhone;
  if (alternatePhone !== undefined) updates.alternatePhone = alternatePhone;
  if (productName) updates.productName = productName;
  if (quantity) updates.quantity = quantity;
  if (codAmount !== undefined) updates.codAmount = String(codAmount);
  if (address) updates.address = address;
  if (landmark !== undefined) updates.landmark = landmark;
  if (area !== undefined) updates.area = area;
  if (stationId !== undefined) updates.stationId = stationId;
  if (priority) updates.priority = priority;
  if (notes !== undefined) updates.notes = notes;
  if (internalNote !== undefined) updates.internalNote = internalNote;
  const [order] = await db.update(ordersTable).set(updates as any).where(eq(ordersTable.id, id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  await createAuditLog({ userId, action: "update", entity: "order", entityId: id, description: `Updated order ${order.orderCode}` });
  res.json(await formatOrder(order));
});

router.delete("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  // Fetch order first to check permissions
  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  if (userRole === "vendor") {
    // Vendor can only delete their own unassigned orders
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor || vendor.id !== existing.vendorId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (existing.riderId) { res.status(403).json({ error: "Cannot delete an order that has already been assigned to a rider." }); return; }
  } else if (userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(ordersTable).where(eq(ordersTable.id, id));
  await createAuditLog({ userId, action: "delete", entity: "order", entityId: id, description: `Deleted order ${existing.orderCode}` });
  res.sendStatus(204);
});

router.post("/orders/:id/assign", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { riderId } = req.body;
  if (!riderId) { res.status(400).json({ error: "riderId required" }); return; }
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, riderId));
  if (!rider) { res.status(400).json({ error: "Rider not found" }); return; }
  const [order] = await db.update(ordersTable)
    .set({ riderId, status: "assigned" })
    .where(eq(ordersTable.id, id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  await db.insert(orderStatusHistoryTable).values({ orderId: id, status: "assigned", changedBy: userId, note: `Assigned to ${rider.name}` });
  if (rider.userId) {
    await createNotification({ userId: rider.userId, title: "New Order Assigned", message: `Order ${order.orderCode} has been assigned to you`, type: "order_assigned", relatedId: id });
  }
  await createAuditLog({ userId, action: "assign", entity: "order", entityId: id, description: `Assigned order ${order.orderCode} to ${rider.name}` });
  res.json(await formatOrder(order));
});

router.post("/orders/:id/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, comment, followupDate } = req.body;
  if (!status) { res.status(400).json({ error: "status required" }); return; }

  const validStatuses = ["new", "duplicate_flagged", "under_review", "confirmed", "assigned", "picked_for_delivery", "out_for_delivery", "delivered", "partial_delivered", "failed_delivery", "followup", "reschedule", "return_pending", "returned", "cancelled", "payment_pending", "payment_released"];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const updateData: Record<string, unknown> = { status };
  if (status === "delivered") updateData.deliveredAt = new Date();
  if ((status === "followup" || status === "reschedule") && followupDate) {
    updateData.followupDate = new Date(followupDate);
  } else if (status !== "followup" && status !== "reschedule") {
    updateData.followupDate = null;
  }

  const [order] = await db.update(ordersTable).set(updateData as any).where(eq(ordersTable.id, id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  await db.insert(orderStatusHistoryTable).values({ orderId: id, status, changedBy: userId, note: comment ?? null });

  if (comment) {
    await db.insert(orderCommentsTable).values({ orderId: id, userId, content: comment, visibility: "all" });
  }

  await createAuditLog({ userId, action: "status_change", entity: "order", entityId: id, description: `Changed order ${order.orderCode} status to ${status}` });

  // Notify vendor on delivery + auto-deduct from rider inventory
  if (status === "delivered") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, order.vendorId));
    if (vendor?.userId) {
      await createNotification({ userId: vendor.userId, title: "Order Delivered", message: `Order ${order.orderCode} has been delivered`, type: "order_delivered", relatedId: id });
    }

    // Auto-create commission for rider
    if (order.riderId) {
      const [riderData] = await db.select().from(ridersTable).where(eq(ridersTable.id, order.riderId));
      if (riderData && Number(riderData.commissionRate ?? 0) > 0) {
        await db.insert(riderCommissionsTable).values({
          riderId: order.riderId,
          orderId: id,
          orderCode: order.orderCode,
          amount: riderData.commissionRate!.toString(),
          status: "earned",
        });
      }
    }

    // Auto-deduct from rider inventory: match by rider + productName/SKU
    if (order.riderId) {
      const riderInventories = await db.select().from(riderInventoryTable)
        .where(eq(riderInventoryTable.riderId, order.riderId));

      for (const inv of riderInventories) {
        const [stockItem] = await db.select().from(stockTable).where(eq(stockTable.id, inv.stockId));
        const nameMatch = stockItem && stockItem.productName.toLowerCase() === order.productName.toLowerCase();
        const skuMatch = stockItem && order.productSku && stockItem.productSku && stockItem.productSku.toLowerCase() === order.productSku.toLowerCase();
        if (nameMatch || skuMatch) {
          const qty = order.quantity ?? 1;
          const currentQty = inv.assignedQty - inv.deliveredQty - inv.returnedQty;
          if (currentQty > 0) {
            await db.update(riderInventoryTable)
              .set({ deliveredQty: sql`${riderInventoryTable.deliveredQty} + ${Math.min(qty, currentQty)}` })
              .where(eq(riderInventoryTable.id, inv.id));
          }
          break;
        }
      }
    }
  }

  res.json(await formatOrder(order));
});

router.post("/orders/:id/duplicate-action", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { action, note } = req.body;

  let newStatus: string;
  if (action === "approve") newStatus = "confirmed";
  else if (action === "reject") newStatus = "cancelled";
  else if (action === "continue") newStatus = "confirmed";
  else { res.status(400).json({ error: "action must be approve, reject, or continue" }); return; }

  const [order] = await db.update(ordersTable)
    .set({ status: newStatus, duplicateFlag: false })
    .where(eq(ordersTable.id, id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  await db.insert(orderStatusHistoryTable).values({ orderId: id, status: newStatus, changedBy: userId, note: note ?? `Duplicate ${action}ed` });
  await createAuditLog({ userId, action: `duplicate_${action}`, entity: "order", entityId: id, description: `${action}ed duplicate order ${order.orderCode}` });

  res.json(await formatOrder(order));
});

router.get("/orders/:orderId/comments", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const orderId = parseInt(raw, 10);
  const comments = await db.select().from(orderCommentsTable).where(eq(orderCommentsTable.orderId, orderId));
  const formatted = await Promise.all(comments.map(async (c) => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, c.userId));
    return { id: c.id, orderId: c.orderId, userId: c.userId, userName: u?.name ?? "Unknown", userRole: u?.role ?? "unknown", content: c.content, visibility: c.visibility, createdAt: c.createdAt.toISOString() };
  }));
  res.json(formatted);
});

router.post("/orders/:orderId/comments", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const orderId = parseInt(raw, 10);
  const { content, visibility } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }
  const [comment] = await db.insert(orderCommentsTable).values({
    orderId, userId, content, visibility: visibility ?? "all",
  }).returning();
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  // Cross-party comment notifications
  const [commentedOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (commentedOrder) {
    const commenterRole = u?.role;
    const snippet = content.length > 60 ? content.slice(0, 60) + "…" : content;

    if (commenterRole === "rider") {
      // Rider commenting → notify vendor
      const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, commentedOrder.vendorId));
      if (vendor?.userId) {
        await createNotification({
          userId: vendor.userId,
          title: "New Comment from Rider",
          message: `${u?.name ?? "Rider"} commented on order ${commentedOrder.orderCode}: "${snippet}"`,
          type: "new_comment",
          relatedId: orderId,
        });
      }
    } else if (commenterRole === "vendor") {
      // Vendor commenting → notify rider
      if (commentedOrder.riderId) {
        const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, commentedOrder.riderId));
        if (rider?.userId) {
          await createNotification({
            userId: rider.userId,
            title: "New Comment from Vendor",
            message: `${u?.name ?? "Vendor"} commented on order ${commentedOrder.orderCode}: "${snippet}"`,
            type: "new_comment",
            relatedId: orderId,
          });
        }
      }
    }
  }

  res.status(201).json({ id: comment.id, orderId: comment.orderId, userId: comment.userId, userName: u?.name ?? "Unknown", userRole: u?.role ?? "unknown", content: comment.content, visibility: comment.visibility, createdAt: comment.createdAt.toISOString() });
});

export default router;
