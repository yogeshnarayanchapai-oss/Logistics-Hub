import { Router, type IRouter } from "express";
import { eq, and, sum, count, desc } from "drizzle-orm";
import { db, riderCommissionsTable, ridersTable, riderPaymentRequestsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

// GET /rider-commissions — rider sees own, admin/manager sees all or by riderId
router.get("/rider-commissions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { riderId } = req.query as Record<string, string>;

  let targetRiderId: number | null = null;

  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider) { res.json({ entries: [], summary: { totalEarned: 0, totalReleased: 0, pendingBalance: 0, totalOrders: 0 } }); return; }
    targetRiderId = rider.id;
  } else if (riderId) {
    targetRiderId = parseInt(riderId, 10);
  }

  const entries = targetRiderId
    ? await db.select().from(riderCommissionsTable)
        .where(eq(riderCommissionsTable.riderId, targetRiderId))
        .orderBy(desc(riderCommissionsTable.createdAt))
    : await db.select().from(riderCommissionsTable).orderBy(desc(riderCommissionsTable.createdAt));

  // Summary
  const rId = targetRiderId;
  const [totalEarnedRow] = rId
    ? await db.select({ v: sum(riderCommissionsTable.amount) }).from(riderCommissionsTable).where(eq(riderCommissionsTable.riderId, rId))
    : await db.select({ v: sum(riderCommissionsTable.amount) }).from(riderCommissionsTable);

  const [totalCountRow] = rId
    ? await db.select({ c: count() }).from(riderCommissionsTable).where(eq(riderCommissionsTable.riderId, rId))
    : await db.select({ c: count() }).from(riderCommissionsTable);

  // Released = sum of approvedAmount of released payment requests for this rider
  const [totalReleasedRow] = rId
    ? await db.select({ v: sum(riderPaymentRequestsTable.approvedAmount) }).from(riderPaymentRequestsTable)
        .where(and(eq(riderPaymentRequestsTable.riderId, rId), eq(riderPaymentRequestsTable.status, "released")))
    : await db.select({ v: sum(riderPaymentRequestsTable.approvedAmount) }).from(riderPaymentRequestsTable)
        .where(eq(riderPaymentRequestsTable.status, "released"));

  const totalEarned = Number(totalEarnedRow?.v ?? 0);
  const totalReleased = Number(totalReleasedRow?.v ?? 0);

  res.json({
    entries: entries.map(e => ({
      id: e.id,
      riderId: e.riderId,
      orderId: e.orderId,
      orderCode: e.orderCode,
      amount: Number(e.amount),
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
    summary: {
      totalEarned,
      totalReleased,
      pendingBalance: totalEarned - totalReleased,
      totalOrders: Number(totalCountRow?.c ?? 0),
    },
  });
});

export default router;
