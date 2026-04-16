import { Router, type IRouter } from "express";
import { eq, and, count, sum, sql, desc, gte } from "drizzle-orm";
import { db, ordersTable, vendorsTable, ridersTable, ticketsTable, paymentRequestsTable, stationsTable, usersTable } from "@workspace/db";
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

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [todayOrders] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vendor.id), gte(ordersTable.createdAt, today)));
  const [pendingOrders] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.status, "new")));
  const [deliveredOrders] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.status, "delivered")));
  const [failedOrders] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.status, "failed_delivery")));
  const [codCollected] = await db.select({ total: sum(ordersTable.codAmount) }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.status, "delivered")));
  const [payable] = await db.select({ total: sum(ordersTable.vendorPayable) }).from(ordersTable)
    .where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.status, "delivered"), eq(ordersTable.paymentReleaseStatus, "pending")));
  const [released] = await db.select({ total: sum(paymentRequestsTable.approvedAmount) }).from(paymentRequestsTable)
    .where(and(eq(paymentRequestsTable.vendorId, vendor.id), eq(paymentRequestsTable.status, "released")));

  res.json({
    todayOrders: Number(todayOrders.count),
    pendingOrders: Number(pendingOrders.count),
    deliveredOrders: Number(deliveredOrders.count),
    failedOrders: Number(failedOrders.count),
    codCollected: Number(codCollected.total ?? 0),
    payableBalance: Number(payable.total ?? 0),
    releasedPayments: Number(released.total ?? 0),
    stockInHand: 0,
  });
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

  res.json({
    assignedToday: Number(assigned.count),
    deliveredToday: Number(delivered.count),
    pendingToday: Number(pending.count),
    failedToday: Number(failed.count),
    codCollectedToday: Number(cod.total ?? 0),
    totalDeliveredAllTime: Number(total.count),
  });
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
