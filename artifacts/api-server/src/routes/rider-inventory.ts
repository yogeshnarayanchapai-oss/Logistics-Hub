import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, riderInventoryTable, ridersTable, stockTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

async function formatEntry(e: typeof riderInventoryTable.$inferSelect) {
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, e.riderId));
  const [stock] = await db.select().from(stockTable).where(eq(stockTable.id, e.stockId));
  const currentQty = e.assignedQty - e.deliveredQty - e.returnedQty;
  return {
    id: e.id,
    riderId: e.riderId,
    riderName: rider?.name ?? "Unknown",
    stockId: e.stockId,
    productName: e.productName,
    productSku: stock?.productSku ?? null,
    assignedQty: e.assignedQty,
    deliveredQty: e.deliveredQty,
    returnedQty: e.returnedQty,
    currentQty,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

// GET /rider-inventory — admin/manager sees all (optionally by riderId), rider sees own
router.get("/rider-inventory", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { riderId } = req.query as Record<string, string>;

  const conditions: any[] = [];

  if (userRole === "rider") {
    const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, userId));
    if (!rider) { res.json([]); return; }
    conditions.push(eq(riderInventoryTable.riderId, rider.id));
  } else if (riderId) {
    conditions.push(eq(riderInventoryTable.riderId, parseInt(riderId, 10)));
  }

  const entries = conditions.length > 0
    ? await db.select().from(riderInventoryTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await db.select().from(riderInventoryTable);

  res.json(await Promise.all(entries.map(formatEntry)));
});

// POST /rider-inventory/assign — admin/manager assigns stock qty to a rider
router.post("/rider-inventory/assign", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { riderId, stockId, qty, note } = req.body;
  if (!riderId || !stockId || !qty || qty <= 0) {
    res.status(400).json({ error: "riderId, stockId, and qty (> 0) are required" }); return;
  }

  const [stock] = await db.select().from(stockTable).where(eq(stockTable.id, parseInt(stockId, 10)));
  if (!stock) { res.status(404).json({ error: "Stock item not found" }); return; }

  // Check if an entry already exists for this rider+stock
  const [existing] = await db.select().from(riderInventoryTable).where(
    and(
      eq(riderInventoryTable.riderId, parseInt(riderId, 10)),
      eq(riderInventoryTable.stockId, parseInt(stockId, 10))
    )
  );

  if (existing) {
    // Increment assignedQty
    const [updated] = await db.update(riderInventoryTable)
      .set({
        assignedQty: sql`${riderInventoryTable.assignedQty} + ${parseInt(qty, 10)}`,
        productName: stock.productName,
        note: note || existing.note,
      })
      .where(eq(riderInventoryTable.id, existing.id))
      .returning();
    res.status(200).json(await formatEntry(updated));
  } else {
    const [entry] = await db.insert(riderInventoryTable).values({
      riderId: parseInt(riderId, 10),
      stockId: parseInt(stockId, 10),
      productName: stock.productName,
      assignedQty: parseInt(qty, 10),
      note: note || null,
    }).returning();
    res.status(201).json(await formatEntry(entry));
  }
});

// POST /rider-inventory/return — admin/manager records a return from rider
router.post("/rider-inventory/return", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { entryId, qty } = req.body;
  if (!entryId || !qty || qty <= 0) {
    res.status(400).json({ error: "entryId and qty (> 0) are required" }); return;
  }

  const [existing] = await db.select().from(riderInventoryTable).where(eq(riderInventoryTable.id, parseInt(entryId, 10)));
  if (!existing) { res.status(404).json({ error: "Entry not found" }); return; }

  const currentQty = existing.assignedQty - existing.deliveredQty - existing.returnedQty;
  const returnQty = Math.min(parseInt(qty, 10), currentQty);
  if (returnQty <= 0) { res.status(400).json({ error: "No inventory available to return" }); return; }

  const [updated] = await db.update(riderInventoryTable)
    .set({ returnedQty: sql`${riderInventoryTable.returnedQty} + ${returnQty}` })
    .where(eq(riderInventoryTable.id, existing.id))
    .returning();
  res.json(await formatEntry(updated));
});

export default router;
