import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, riderBankAccountsTable, ridersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /rider-bank-accounts
router.get("/rider-bank-accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { riderId } = req.query as Record<string, string>;

  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider) { res.json([]); return; }
    const accounts = await db.select().from(riderBankAccountsTable).where(eq(riderBankAccountsTable.riderId, rider.id));
    res.json(accounts); return;
  }

  if (riderId) {
    const accounts = await db.select().from(riderBankAccountsTable).where(eq(riderBankAccountsTable.riderId, parseInt(riderId, 10)));
    res.json(accounts); return;
  }

  const accounts = await db.select().from(riderBankAccountsTable);
  res.json(accounts);
});

// POST /rider-bank-accounts
router.post("/rider-bank-accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { accountHolderName, bankName, branch, accountNumber, walletMethod, remarks, isDefault } = req.body;

  if (!accountHolderName || !bankName || !accountNumber) {
    res.status(400).json({ error: "accountHolderName, bankName, and accountNumber are required" }); return;
  }

  let targetRiderId: number;
  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }
    targetRiderId = rider.id;
  } else {
    if (!req.body.riderId) { res.status(400).json({ error: "riderId required for admin" }); return; }
    targetRiderId = parseInt(req.body.riderId, 10);
  }

  if (isDefault) {
    await db.update(riderBankAccountsTable)
      .set({ isDefault: false })
      .where(eq(riderBankAccountsTable.riderId, targetRiderId));
  }

  const [account] = await db.insert(riderBankAccountsTable).values({
    riderId: targetRiderId,
    accountHolderName,
    bankName,
    branch: branch || null,
    accountNumber,
    walletMethod: walletMethod || null,
    remarks: remarks || null,
    isDefault: !!isDefault,
  }).returning();

  res.status(201).json(account);
});

// DELETE /rider-bank-accounts/:id
router.delete("/rider-bank-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const id = parseInt(req.params.id, 10);

  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider) { res.status(403).json({ error: "Forbidden" }); return; }
    await db.delete(riderBankAccountsTable).where(and(eq(riderBankAccountsTable.id, id), eq(riderBankAccountsTable.riderId, rider.id)));
  } else {
    await db.delete(riderBankAccountsTable).where(eq(riderBankAccountsTable.id, id));
  }

  res.json({ success: true });
});

export default router;
