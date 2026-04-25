import { Router, type IRouter } from "express";
import { eq, and, count, sum, sql, desc, gte, lt, inArray, lte, isNotNull } from "drizzle-orm";
import { db, ordersTable, vendorsTable, ridersTable, ticketsTable, paymentRequestsTable, riderCommissionsTable, riderPaymentRequestsTable, stationsTable, usersTable, orderCommentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/admin-summary", requireAuth, async (req, res): Promise<void> => {
  const [totalOrders] = await db.select({ count: count() }).from(ordersTable);
  const [pendingOrders] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "new"));
  const [assignedOrders] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "assigned"));
  const [deliveredOrders] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "delivered"));
  const [failedOrders] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "failed_delivery"));
  const [returnedOrders] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "returned"));
  const [duplicateFlagged] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.duplicateFlag, true));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [codToday] = await db.select({ total: sum(ordersTable.codAmount) }).from(ordersTable)
    .where(and(eq(ordersTable.status, "delivered"), gte(ordersTable.deliveredAt, today)));

  const [totalPayable] = await db.select({ total: sum(ordersTable.vendorPayable) }).from(ordersTable)
    .where(and(eq(ordersTable.status, "delivered"), eq(ordersTable.paymentReleaseStatus, "pending")));

  const [totalReleased] = await db.select({ total: sum(paymentRequestsTable.approvedAmount) }).from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.status, "released"));

  const [activeVendors] = await db.select({ count: count() }).from(vendorsTable).where(eq(vendorsTable.status, "active"));
  const [activeRiders] = await db.select({ count: count() }).from(ridersTable).where(eq(ridersTable.status, "active"));
  const [openTickets] = await db.select({ count: count() }).from(ticketsTable).where(eq(ticketsTable.status, "open"));

  res.json({
    totalOrders: Number(totalOrders.count),
    pendingOrders: Number(pendingOrders.count),
    assignedOrders: Number(assignedOrders.count),
    deliveredOrders: Number(deliveredOrders.count),
    failedOrders: Number(failedOrders.count),
    returnedOrders: Number(returnedOrders.count),
    duplicateFlagged: Number(duplicateFlagged.count),
    codCollectedToday: Number(codToday.total ?? 0),
    totalVendorPayable: Number(totalPayable.total ?? 0),
    totalReleasedPayments: Number(totalReleased.total ?? 0),
    activeVendors: Number(activeVendors.count),
    activeRiders: Number(activeRiders.count),
    openTickets: Number(openTickets.count),
  });
});

router.get("/dashboard/vendor-summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

  const vId = vendor.id;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const staleThreshold = new Date(); staleThreshold.setDate(staleThreshold.getDate() - 3);

  const processingStatuses = ["new", "assigned", "picked_up", "at_station", "out_for_delivery"];

  // Package counts
  const [total] = await db.select({ c: count() }).from(ordersTable).where(eq(ordersTable.vendorId, vId));
  const [delivered] = await db.select({ c: count() }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "delivered")));
  const [returned] = await db.select({ c: count() }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "returned")));
  const [processing] = await db.select({ c: count() }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), inArray(ordersTable.status, processingStatuses)));
  const [hold] = await db.select({ c: count() }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "hold")));
  const [cancelled] = await db.select({ c: count() }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "cancelled")));
  const [failed] = await db.select({ c: count() }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "failed_delivery")));

  // Package values (COD)
  const [totalVal] = await db.select({ v: sum(ordersTable.codAmount) }).from(ordersTable).where(eq(ordersTable.vendorId, vId));
  const [deliveredVal] = await db.select({ v: sum(ordersTable.codAmount) }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "delivered")));
  const [returnedVal] = await db.select({ v: sum(ordersTable.codAmount) }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "returned")));
  const [processingVal] = await db.select({ v: sum(ordersTable.codAmount) }).from(ordersTable).where(and(eq(ordersTable.vendorId, vId), inArray(ordersTable.status, processingStatuses)));

  // COD Details
  const [codPending] = await db.select({ v: sum(ordersTable.vendorPayable) }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "delivered"), eq(ordersTable.paymentReleaseStatus, "pending")));
  const [lastPayment] = await db.select().from(paymentRequestsTable)
    .where(and(eq(paymentRequestsTable.vendorId, vId), eq(paymentRequestsTable.status, "released")))
    .orderBy(desc(paymentRequestsTable.createdAt)).limit(1);
  const [deliveryChargesTotal] = await db.select({ v: sum(ordersTable.deliveryCharge) }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "delivered")));

  // Today's stats
  const [todayDelivered] = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "delivered"), gte(ordersTable.deliveredAt, today)));
  const [todayReturned] = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vId), eq(ordersTable.status, "returned"), gte(ordersTable.updatedAt, today)));
  const [todayCreated] = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vId), gte(ordersTable.createdAt, today)));

  // Today's comments on vendor's orders
  const vendorOrders = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.vendorId, vId));
  const vendorOrderIds = vendorOrders.map(o => o.id);
  let todayComments = 0;
  if (vendorOrderIds.length > 0) {
    const [tc] = await db.select({ c: count() }).from(orderCommentsTable)
      .where(and(inArray(orderCommentsTable.orderId, vendorOrderIds), gte(orderCommentsTable.createdAt, today)));
    todayComments = Number(tc.c);
  }

  // Stale orders (processing but older than 3 days)
  const [stale] = await db.select({ c: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vId), inArray(ordersTable.status, processingStatuses), lt(ordersTable.createdAt, staleThreshold)));

  // Sales statistics
  const totalCount = Number(total.c);
  const deliveredCount = Number(delivered.c);
  const returnedCount = Number(returned.c);

  res.json({
    packages: {
      total: totalCount,
      delivered: deliveredCount,
      returned: returnedCount,
      processing: Number(processing.c),
      hold: Number(hold.c),
      cancelled: Number(cancelled.c),
      failed: Number(failed.c),
    },
    packageValues: {
      total: Number(totalVal.v ?? 0),
      delivered: Number(deliveredVal.v ?? 0),
      returned: Number(returnedVal.v ?? 0),
      processing: Number(processingVal.v ?? 0),
    },
    cod: {
      pending: Number(codPending.v ?? 0),
      deliveryCharges: Number(deliveryChargesTotal.v ?? 0),
      lastCodAmount: lastPayment ? Number(lastPayment.approvedAmount ?? 0) : 0,
      lastTransferDate: lastPayment?.createdAt?.toISOString() ?? null,
    },
    today: {
      delivered: Number(todayDelivered.c),
      returned: Number(todayReturned.c),
      created: Number(todayCreated.c),
      comments: todayComments,
      hold: Number(hold.c),
      stale: Number(stale.c),
      rtv: returnedCount,
    },
    sales: {
      successRate: totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0,
      returnRate: totalCount > 0 ? Math.round((returnedCount / totalCount) * 100) : 0,
      processingRate: totalCount > 0 ? Math.round((Number(processing.c) / totalCount) * 100) : 0,
    },
    // legacy fields
    todayOrders: Number(todayCreated.c),
    pendingOrders: Number(processing.c),
    deliveredOrders: deliveredCount,
    failedOrders: Number(failed.c),
    codCollected: Number(deliveredVal.v ?? 0),
    payableBalance: Number(codPending.v ?? 0),
    releasedPayments: lastPayment ? Number(lastPayment.approvedAmount ?? 0) : 0,
    stockInHand: 0,
  });
});

router.get("/dashboard/vendor-comments", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const vendorOrders = await db.select({ id: ordersTable.id, orderCode: ordersTable.orderCode })
    .from(ordersTable).where(eq(ordersTable.vendorId, vendor.id));

  if (vendorOrders.length === 0) { res.json([]); return; }

  const orderMap = new Map(vendorOrders.map(o => [o.id, o.orderCode]));
  const orderIds = vendorOrders.map(o => o.id);

  // All today's comments for vendor orders
  const comments = await db.select().from(orderCommentsTable)
    .where(and(inArray(orderCommentsTable.orderId, orderIds), gte(orderCommentsTable.createdAt, today)))
    .orderBy(desc(orderCommentsTable.createdAt));

  // Group by orderId — keep only latest comment per order
  const latestByOrder = new Map<number, typeof comments[0]>();
  for (const c of comments) {
    if (!latestByOrder.has(c.orderId)) latestByOrder.set(c.orderId, c);
  }

  // Fetch commenter roles
  const result = await Promise.all(
    Array.from(latestByOrder.values()).map(async (c, i) => {
      const [commenter] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, c.userId));
      const commenterRole = commenter?.role ?? "unknown";
      // Pending: if last comment is from rider → vendor needs to reply; if from vendor → rider needs to reply
      const pendingFor = commenterRole === "rider" ? "vendor" : commenterRole === "vendor" ? "rider" : null;
      return {
        sno: i + 1,
        id: c.id,
        orderId: c.orderId,
        orderCode: orderMap.get(c.orderId) ?? "",
        comment: c.content,
        addedOn: c.createdAt.toISOString(),
        commenterRole,
        pendingFor,
      };
    })
  );

  res.json(result);
});

router.get("/dashboard/rider-summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
  if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [assigned] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.riderId, rider.id), gte(ordersTable.createdAt, today)));
  const [delivered] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.riderId, rider.id), eq(ordersTable.status, "delivered"), gte(ordersTable.deliveredAt, today)));
  const [pending] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.riderId, rider.id), eq(ordersTable.status, "assigned")));
  const [failed] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.riderId, rider.id), eq(ordersTable.status, "failed_delivery"), gte(ordersTable.createdAt, today)));
  const [cod] = await db.select({ total: sum(ordersTable.codAmount) }).from(ordersTable)
    .where(and(eq(ordersTable.riderId, rider.id), eq(ordersTable.status, "delivered"), gte(ordersTable.deliveredAt, today)));
  const [total] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.riderId, rider.id), eq(ordersTable.status, "delivered")));

  const [totalEarned] = await db.select({ v: sum(riderCommissionsTable.amount) }).from(riderCommissionsTable)
    .where(eq(riderCommissionsTable.riderId, rider.id));
  const [todayEarned] = await db.select({ v: sum(riderCommissionsTable.amount) }).from(riderCommissionsTable)
    .where(and(eq(riderCommissionsTable.riderId, rider.id), gte(riderCommissionsTable.createdAt, today)));
  const [totalReleased] = await db.select({ v: sum(riderPaymentRequestsTable.approvedAmount) }).from(riderPaymentRequestsTable)
    .where(and(eq(riderPaymentRequestsTable.riderId, rider.id), eq(riderPaymentRequestsTable.status, "released")));

  res.json({
    assignedToday: Number(assigned.count),
    deliveredToday: Number(delivered.count),
    pendingToday: Number(pending.count),
    failedToday: Number(failed.count),
    codCollectedToday: Number(cod.total ?? 0),
    totalDeliveredAllTime: Number(total.count),
    commissionRate: Number(rider.commissionRate ?? 0),
    commissionEarnedToday: Number(todayEarned?.v ?? 0),
    commissionEarnedTotal: Number(totalEarned?.v ?? 0),
    commissionReleased: Number(totalReleased?.v ?? 0),
    commissionPending: Number(totalEarned?.v ?? 0) - Number(totalReleased?.v ?? 0),
  });
});

router.get("/dashboard/rider-followups", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
  if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const orders = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.riderId, rider.id),
      eq(ordersTable.status, "followup"),
      isNotNull(ordersTable.followupDate),
      gte(ordersTable.followupDate, today),
      lt(ordersTable.followupDate, tomorrow),
    ))
    .orderBy(ordersTable.followupDate);

  res.json(orders.map((o) => ({
    id: o.id,
    orderCode: o.orderCode,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    address: o.address,
    area: o.area,
    city: o.city,
    followupDate: o.followupDate ? o.followupDate.toISOString() : null,
    codAmount: Number(o.codAmount),
    productName: o.productName,
  })));
});

router.get("/dashboard/order-trends", requireAuth, async (req, res): Promise<void> => {
  const { days = "7" } = req.query as Record<string, string>;
  const numDays = parseInt(days, 10);
  const points = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const [total] = await db.select({ count: count() }).from(ordersTable)
      .where(and(gte(ordersTable.createdAt, date), sql`${ordersTable.createdAt} < ${nextDate.toISOString()}`));
    const [delivered] = await db.select({ count: count() }).from(ordersTable)
      .where(and(eq(ordersTable.status, "delivered"), gte(ordersTable.createdAt, date), sql`${ordersTable.createdAt} < ${nextDate.toISOString()}`));
    const [failed] = await db.select({ count: count() }).from(ordersTable)
      .where(and(eq(ordersTable.status, "failed_delivery"), gte(ordersTable.createdAt, date), sql`${ordersTable.createdAt} < ${nextDate.toISOString()}`));

    points.push({
      date: date.toISOString().split("T")[0],
      total: Number(total.count),
      delivered: Number(delivered.count),
      failed: Number(failed.count),
    });
  }
  res.json(points);
});

router.get("/dashboard/station-performance", requireAuth, async (req, res): Promise<void> => {
  const stations = await db.select().from(stationsTable);
  const result = await Promise.all(stations.map(async (s) => {
    const [total] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.stationId, s.id));
    const [delivered] = await db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.stationId, s.id), eq(ordersTable.status, "delivered")));
    const [failed] = await db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.stationId, s.id), eq(ordersTable.status, "failed_delivery")));
    const t = Number(total.count);
    const d = Number(delivered.count);
    return {
      stationId: s.id, stationName: s.name,
      totalOrders: t, delivered: d,
      failed: Number(failed.count),
      deliveryRate: t > 0 ? Math.round((d / t) * 100) : 0,
    };
  }));
  res.json(result);
});

router.get("/dashboard/top-riders", requireAuth, async (req, res): Promise<void> => {
  const riders = await db.select().from(ridersTable).where(eq(ridersTable.status, "active"));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const result = await Promise.all(riders.map(async (r) => {
    const [total] = await db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.riderId, r.id), eq(ordersTable.status, "delivered")));
    const [todayDelivered] = await db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.riderId, r.id), eq(ordersTable.status, "delivered"), gte(ordersTable.deliveredAt, today)));
    const [assigned] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.riderId, r.id));
    const [cod] = await db.select({ total: sum(ordersTable.codAmount) }).from(ordersTable).where(and(eq(ordersTable.riderId, r.id), eq(ordersTable.status, "delivered")));
    let stationName: string | null = null;
    if (r.stationId) {
      const [s] = await db.select().from(stationsTable).where(eq(stationsTable.id, r.stationId));
      stationName = s?.name ?? null;
    }
    const totalCount = Number(assigned.count);
    const deliveredCount = Number(total.count);
    return {
      riderId: r.id, riderName: r.name, stationName,
      deliveredToday: Number(todayDelivered.count),
      deliveredTotal: deliveredCount,
      codCollected: Number(cod.total ?? 0),
      successRate: totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0,
    };
  }));

  result.sort((a, b) => b.deliveredTotal - a.deliveredTotal);
  res.json(result.slice(0, 10));
});

router.get("/dashboard/cod-summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { vendorId } = req.query as Record<string, string>;

  const conditions: any[] = [eq(ordersTable.status, "delivered")];
  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (vendor) conditions.push(eq(ordersTable.vendorId, vendor.id));
    else { res.json({ totalCodCollected: 0, totalDeliveryCharge: 0, totalVendorPayable: 0, totalReleased: 0, pendingRelease: 0 }); return; }
  } else if (vendorId) {
    conditions.push(eq(ordersTable.vendorId, parseInt(vendorId, 10)));
  }

  const [cod] = await db.select({ total: sum(ordersTable.codAmount) }).from(ordersTable).where(and(...conditions));
  const [dc] = await db.select({ total: sum(ordersTable.deliveryCharge) }).from(ordersTable).where(and(...conditions));
  const [vp] = await db.select({ total: sum(ordersTable.vendorPayable) }).from(ordersTable).where(and(...conditions));
  const [released] = await db.select({ total: sum(paymentRequestsTable.approvedAmount) }).from(paymentRequestsTable).where(eq(paymentRequestsTable.status, "released"));
  const [pending] = await db.select({ total: sum(ordersTable.vendorPayable) }).from(ordersTable).where(and(...conditions, eq(ordersTable.paymentReleaseStatus, "pending")));

  res.json({
    totalCodCollected: Number(cod.total ?? 0),
    totalDeliveryCharge: Number(dc.total ?? 0),
    totalVendorPayable: Number(vp.total ?? 0),
    totalReleased: Number(released.total ?? 0),
    pendingRelease: Number(pending.total ?? 0),
  });
});

export default router;
