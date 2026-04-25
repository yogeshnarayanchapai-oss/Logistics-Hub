import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";
import { db, bankAccountsTable, paymentRequestsTable, vendorsTable, usersTable, ordersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { createAuditLog } from "../lib/audit";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

function formatBankAccount(b: typeof bankAccountsTable.$inferSelect) {
  return {
    id: b.id, vendorId: b.vendorId,
    accountHolderName: b.accountHolderName,
    bankName: b.bankName, branch: b.branch,
    accountNumber: b.accountNumber,
    walletMethod: b.walletMethod,
    remarks: b.remarks,
    isDefault: b.isDefault,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/bank-accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { vendorId } = req.query as Record<string, string>;

  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor) { res.json([]); return; }
    const accounts = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.vendorId, vendor.id));
    res.json(accounts.map(formatBankAccount));
    return;
  }

  if (vendorId) {
    const accounts = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.vendorId, parseInt(vendorId, 10)));
    res.json(accounts.map(formatBankAccount));
    return;
  }

  const accounts = await db.select().from(bankAccountsTable);
  res.json(accounts.map(formatBankAccount));
});

router.post("/bank-accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { vendorId, accountHolderName, bankName, branch, accountNumber, walletMethod, remarks, isDefault } = req.body;

  let resolvedVendorId = vendorId;
  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor) { res.status(403).json({ error: "Forbidden" }); return; }
    resolvedVendorId = vendor.id;
  }

  if (!resolvedVendorId || !accountHolderName || !bankName || !accountNumber) {
    res.status(400).json({ error: "vendorId, accountHolderName, bankName, accountNumber required" }); return;
  }

  const [account] = await db.insert(bankAccountsTable).values({
    vendorId: resolvedVendorId, accountHolderName, bankName,
    branch: branch ?? null, accountNumber,
    walletMethod: walletMethod ?? null,
    remarks: remarks ?? null,
    isDefault: isDefault ?? false,
  }).returning();

  res.status(201).json(formatBankAccount(account));
});

router.patch("/bank-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { accountHolderName, bankName, branch, accountNumber, walletMethod, remarks, isDefault } = req.body;
  if (accountHolderName) updates.accountHolderName = accountHolderName;
  if (bankName) updates.bankName = bankName;
  if (branch !== undefined) updates.branch = branch;
  if (accountNumber) updates.accountNumber = accountNumber;
  if (walletMethod !== undefined) updates.walletMethod = walletMethod;
  if (remarks !== undefined) updates.remarks = remarks;
  if (isDefault !== undefined) updates.isDefault = isDefault;
  const [account] = await db.update(bankAccountsTable).set(updates as any).where(eq(bankAccountsTable.id, id)).returning();
  if (!account) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatBankAccount(account));
});

router.delete("/bank-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [account] = await db.delete(bankAccountsTable).where(eq(bankAccountsTable.id, id)).returning();
  if (!account) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

async function formatPaymentRequest(p: typeof paymentRequestsTable.$inferSelect) {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, p.vendorId));
  const [account] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, p.bankAccountId));
  let reviewedByName: string | null = null;
  if (p.reviewedBy) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, p.reviewedBy));
    reviewedByName = u?.name ?? null;
  }
  return {
    id: p.id, vendorId: p.vendorId,
    vendorName: vendor?.name ?? "Unknown",
    bankAccountId: p.bankAccountId,
    bankAccountInfo: account ? `${account.bankName} - ${account.accountNumber}` : "Unknown",
    bankName: account?.bankName ?? null,
    bankBranch: account?.branch ?? null,
    accountHolderName: account?.accountHolderName ?? null,
    accountNumber: account?.accountNumber ?? null,
    walletMethod: account?.walletMethod ?? null,
    requestedAmount: Number(p.requestedAmount),
    approvedAmount: p.approvedAmount ? Number(p.approvedAmount) : null,
    status: p.status, note: p.note, adminNote: p.adminNote,
    releaseNote: p.releaseNote, referenceId: p.referenceId,
    paymentDate: p.paymentDate,
    reviewedBy: p.reviewedBy, reviewedByName,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/payment-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { vendorId, status, dateFrom, dateTo } = req.query as Record<string, string>;

  const conditions: any[] = [];

  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (vendor) conditions.push(eq(paymentRequestsTable.vendorId, vendor.id));
    else { res.json([]); return; }
  } else if (vendorId) {
    conditions.push(eq(paymentRequestsTable.vendorId, parseInt(vendorId, 10)));
  }

  if (status) conditions.push(eq(paymentRequestsTable.status, status));
  if (dateFrom) conditions.push(gte(paymentRequestsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(paymentRequestsTable.createdAt, new Date(dateTo)));

  const reqs = conditions.length > 0
    ? await db.select().from(paymentRequestsTable).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(desc(paymentRequestsTable.createdAt))
    : await db.select().from(paymentRequestsTable).orderBy(desc(paymentRequestsTable.createdAt));

  res.json(await Promise.all(reqs.map(formatPaymentRequest)));
});

router.post("/payment-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { bankAccountId, requestedAmount, note } = req.body;
  if (!bankAccountId || !requestedAmount) { res.status(400).json({ error: "bankAccountId and requestedAmount required" }); return; }

  const [account] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, bankAccountId));
  if (!account) { res.status(400).json({ error: "Bank account not found" }); return; }

  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor || vendor.id !== account.vendorId) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const [pr] = await db.insert(paymentRequestsTable).values({
    vendorId: account.vendorId, bankAccountId,
    requestedAmount: String(requestedAmount),
    note: note ?? null,
  }).returning();

  // Lock all the vendor's pending-payment delivered orders to this request
  await db.update(ordersTable)
    .set({ paymentRequestId: pr.id })
    .where(and(
      eq(ordersTable.vendorId, account.vendorId),
      eq(ordersTable.status, "delivered"),
      eq(ordersTable.paymentReleaseStatus, "pending"),
      isNull(ordersTable.paymentRequestId)
    ));

  await createAuditLog({ userId, action: "create", entity: "payment_request", entityId: pr.id, description: `Payment request Rs.${requestedAmount} submitted` });

  res.status(201).json(await formatPaymentRequest(pr));
});

router.get("/payment-requests/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [pr] = await db.select().from(paymentRequestsTable).where(eq(paymentRequestsTable.id, id));
  if (!pr) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatPaymentRequest(pr));
});

// GET /payment-requests/:id/orders — fetch orders linked to this payment request
router.get("/payment-requests/:id/orders", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const linkedOrders = await db.select().from(ordersTable).where(eq(ordersTable.paymentRequestId, id));

  const result = await Promise.all(linkedOrders.map(async (o) => {
    let riderName: string | null = null;
    if (o.riderId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, o.riderId));
      riderName = u?.name ?? null;
    }
    return {
      id: o.id,
      orderCode: o.orderCode,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      productName: o.productName,
      codAmount: Number(o.codAmount),
      deliveryCharge: Number(o.deliveryCharge),
      vendorPayable: Number(o.vendorPayable),
      riderName,
      paymentReleaseStatus: o.paymentReleaseStatus,
      status: o.status,
    };
  }));

  res.json(result);
});

router.patch("/payment-requests/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, approvedAmount, releaseNote, referenceId, paymentDate } = req.body;

  const updates: Record<string, unknown> = { reviewedBy: userId };
  if (status) updates.status = status;
  if (approvedAmount !== undefined) updates.approvedAmount = String(approvedAmount);
  if (releaseNote !== undefined) updates.releaseNote = releaseNote;
  if (referenceId !== undefined) updates.referenceId = referenceId;
  if (paymentDate !== undefined) updates.paymentDate = paymentDate;

  const [pr] = await db.update(paymentRequestsTable).set(updates as any).where(eq(paymentRequestsTable.id, id)).returning();
  if (!pr) { res.status(404).json({ error: "Not found" }); return; }

  // On release: mark all linked orders as payment_released
  if (status === "released") {
    await db.update(ordersTable)
      .set({ paymentReleaseStatus: "released" })
      .where(eq(ordersTable.paymentRequestId, id));
  }

  await createAuditLog({ userId, action: `payment_${status}`, entity: "payment_request", entityId: id, description: `Payment request ${status}` });

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, pr.vendorId));
  if (vendor?.userId) {
    await createNotification({ userId: vendor.userId, title: `Payment Request ${status}`, message: `Your payment request has been ${status}`, type: "payment_update", relatedId: id });
  }

  res.json(await formatPaymentRequest(pr));
});

// POST /payment-requests/:id/admin-note — send a note to vendor without changing status
router.post("/payment-requests/:id/admin-note", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id, 10);
  const { note } = req.body;
  if (!note || !note.trim()) { res.status(400).json({ error: "note is required" }); return; }

  const [pr] = await db.update(paymentRequestsTable).set({ adminNote: note.trim() }).where(eq(paymentRequestsTable.id, id)).returning();
  if (!pr) { res.status(404).json({ error: "Not found" }); return; }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, pr.vendorId));
  if (vendor?.userId) {
    await createNotification({ userId: vendor.userId, title: "Note on Payment Request", message: note.trim(), type: "payment_update", relatedId: id });
  }
  await createAuditLog({ userId, action: "admin_note", entity: "payment_request", entityId: id, description: `Admin note added` });

  res.json(await formatPaymentRequest(pr));
});

export default router;
