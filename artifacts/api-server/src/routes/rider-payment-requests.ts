import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, riderPaymentRequestsTable, ridersTable, riderBankAccountsTable, riderCommissionsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

async function formatRequest(r: typeof riderPaymentRequestsTable.$inferSelect) {
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, r.riderId));
  const [bank] = r.bankAccountId ? await db.select().from(riderBankAccountsTable).where(eq(riderBankAccountsTable.id, r.bankAccountId)) : [null];
  return {
    id: r.id,
    riderId: r.riderId,
    riderName: rider?.name ?? "Unknown",
    riderEmail: rider?.email ?? "",
    bankAccountId: r.bankAccountId,
    bankName: bank?.bankName ?? "—",
    accountNumber: bank?.accountNumber ?? "—",
    requestedAmount: Number(r.requestedAmount),
    approvedAmount: r.approvedAmount ? Number(r.approvedAmount) : null,
    status: r.status,
    note: r.note,
    adminNote: r.adminNote,
    releaseNote: r.releaseNote,
    referenceId: r.referenceId,
    paymentDate: r.paymentDate,
    reviewedBy: r.reviewedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /rider-payment-requests
router.get("/rider-payment-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { riderId, status } = req.query as Record<string, string>;

  let conditions: any[] = [];

  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider) { res.json([]); return; }
    conditions.push(eq(riderPaymentRequestsTable.riderId, rider.id));
  } else {
    if (riderId) conditions.push(eq(riderPaymentRequestsTable.riderId, parseInt(riderId, 10)));
    if (status) conditions.push(eq(riderPaymentRequestsTable.status, status));
  }

  const rows = conditions.length > 0
    ? await db.select().from(riderPaymentRequestsTable).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(desc(riderPaymentRequestsTable.createdAt))
    : await db.select().from(riderPaymentRequestsTable).orderBy(desc(riderPaymentRequestsTable.createdAt));

  res.json(await Promise.all(rows.map(formatRequest)));
});

// POST /rider-payment-requests — rider requests a commission payout
router.post("/rider-payment-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { bankAccountId, requestedAmount, note } = req.body;

  if (!bankAccountId || !requestedAmount || Number(requestedAmount) <= 0) {
    res.status(400).json({ error: "bankAccountId and requestedAmount (>0) are required" }); return;
  }

  let targetRiderId: number;
  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }
    targetRiderId = rider.id;
  } else {
    if (!req.body.riderId) { res.status(400).json({ error: "riderId required" }); return; }
    targetRiderId = parseInt(req.body.riderId, 10);
  }

  const [bank] = await db.select().from(riderBankAccountsTable).where(eq(riderBankAccountsTable.id, parseInt(bankAccountId, 10)));
  if (!bank || bank.riderId !== targetRiderId) {
    res.status(400).json({ error: "Invalid bank account" }); return;
  }

  const [request] = await db.insert(riderPaymentRequestsTable).values({
    riderId: targetRiderId,
    bankAccountId: parseInt(bankAccountId, 10),
    requestedAmount: requestedAmount.toString(),
    status: "pending",
    note: note || null,
  }).returning();

  res.status(201).json(await formatRequest(request));
});

// PATCH /rider-payment-requests/:id — admin releases or rejects
router.patch("/rider-payment-requests/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const adminId = (req as any).userId as number;
  const id = parseInt(req.params.id, 10);
  const { status, approvedAmount, releaseNote, referenceId, paymentDate } = req.body;

  if (!status || !["released", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be released or rejected" }); return;
  }

  const updateData: any = { status, reviewedBy: adminId };
  if (releaseNote) updateData.releaseNote = releaseNote;
  if (referenceId) updateData.referenceId = referenceId;
  if (paymentDate) updateData.paymentDate = paymentDate;
  if (approvedAmount !== undefined) updateData.approvedAmount = approvedAmount.toString();

  const [updated] = await db.update(riderPaymentRequestsTable).set(updateData).where(eq(riderPaymentRequestsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Request not found" }); return; }

  // Notify the rider
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, updated.riderId));
  if (rider?.userId) {
    const msg = status === "released"
      ? `Your payment request of Rs. ${Number(updated.approvedAmount ?? updated.requestedAmount).toLocaleString()} has been released.`
      : `Your payment request has been rejected. ${releaseNote ?? ""}`;
    await createNotification({ userId: rider.userId, title: status === "released" ? "Payment Released" : "Payment Rejected", message: msg, type: "payment_released", relatedId: id });
  }

  res.json(await formatRequest(updated));
});

// POST /rider-payment-requests/:id/admin-note — send a note to rider without changing status
router.post("/rider-payment-requests/:id/admin-note", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { note } = req.body;
  if (!note || !note.trim()) { res.status(400).json({ error: "note is required" }); return; }

  const [updated] = await db.update(riderPaymentRequestsTable).set({ adminNote: note.trim() }).where(eq(riderPaymentRequestsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, updated.riderId));
  if (rider?.userId) {
    await createNotification({ userId: rider.userId, title: "Note on Payment Request", message: note.trim(), type: "payment_released", relatedId: id });
  }

  res.json(await formatRequest(updated));
});

export default router;
