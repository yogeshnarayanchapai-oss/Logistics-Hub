import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, stockTable, vendorsTable, stockMovementsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

async function formatStock(s: typeof stockTable.$inferSelect) {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, s.vendorId));
  const currentStock = s.openingStock + s.receivedStock - s.deliveredStock + s.returnedStock - s.damagedStock;
  return {
    id: s.id,
    vendorId: s.vendorId,
    vendorName: vendor?.name ?? "Unknown",
    productName: s.productName,
    productSku: s.productSku,
    openingStock: s.openingStock,
    receivedStock: s.receivedStock,
    deliveredStock: s.deliveredStock,
    returnedStock: s.returnedStock,
    damagedStock: s.damagedStock,
    currentStock,
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function logMovement(opts: {
  stockId: number;
  productName: string;
  vendorId: number;
  movementType: string;
  qty: number;
  riderId?: number | null;
  riderName?: string | null;
  note?: string | null;
  performedByUserId?: number | null;
  performedByName?: string | null;
}) {
  await db.insert(stockMovementsTable).values({
    stockId: opts.stockId,
    productName: opts.productName,
    vendorId: opts.vendorId,
    movementType: opts.movementType,
    qty: opts.qty,
    riderId: opts.riderId ?? null,
    riderName: opts.riderName ?? null,
    note: opts.note ?? null,
    performedByUserId: opts.performedByUserId ?? null,
    performedByName: opts.performedByName ?? null,
  });
}

router.get("/stock", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { vendorId, search } = req.query as Record<string, string>;

  const conditions: any[] = [];

  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (vendor) conditions.push(eq(stockTable.vendorId, vendor.id));
    else { res.json([]); return; }
  } else if (vendorId) {
    conditions.push(eq(stockTable.vendorId, parseInt(vendorId, 10)));
  }

  if (search) conditions.push(ilike(stockTable.productName, `%${search}%`));

  const stocks = conditions.length > 0
    ? await db.select().from(stockTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await db.select().from(stockTable);

  res.json(await Promise.all(stocks.map(formatStock)));
});

// Allow admin, manager, and vendor to create stock entries
router.post("/stock", requireAuth, requireRole("admin", "manager", "vendor"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  let { vendorId, productName, productSku, openingStock } = req.body;

  if (!productName) { res.status(400).json({ error: "productName required" }); return; }

  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor) { res.status(403).json({ error: "Vendor profile not found" }); return; }
    vendorId = vendor.id;
  }

  if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  const [s] = await db.insert(stockTable).values({
    vendorId: Number(vendorId),
    productName,
    productSku: productSku ?? null,
    openingStock: openingStock ?? 0,
    receivedStock: openingStock ?? 0,
  }).returning();

  if ((openingStock ?? 0) > 0) {
    await logMovement({
      stockId: s.id, productName, vendorId: Number(vendorId),
      movementType: "vendor_in", qty: openingStock ?? 0,
      note: "Initial stock entry",
      performedByUserId: userId, performedByName: user?.name ?? null,
    });
  }

  res.status(201).json(await formatStock(s));
});

// PATCH: "stock-in" and "stock-out" movements — INCREMENT existing totals, never replace
router.patch("/stock/:id", requireAuth, requireRole("admin", "manager", "vendor"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(stockTable).where(eq(stockTable.id, id));
  if (!existing) { res.status(404).json({ error: "Stock entry not found" }); return; }

  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor || vendor.id !== existing.vendorId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }

  const { type, qty, productName, productSku, note } = req.body;
  const quantity = Number(qty) || 0;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (productName !== undefined || productSku !== undefined) {
    const infoUpdates: any = {};
    if (productName) infoUpdates.productName = productName;
    if (productSku !== undefined) infoUpdates.productSku = productSku;
    await db.update(stockTable).set(infoUpdates).where(eq(stockTable.id, id));
  }

  if (type === "in" && quantity > 0) {
    await db.update(stockTable)
      .set({ receivedStock: sql`${stockTable.receivedStock} + ${quantity}` })
      .where(eq(stockTable.id, id));
    await logMovement({
      stockId: id, productName: existing.productName, vendorId: existing.vendorId,
      movementType: "vendor_in", qty: quantity,
      note: note ?? null,
      performedByUserId: userId, performedByName: user?.name ?? null,
    });
  } else if (type === "out" && quantity > 0) {
    await db.update(stockTable)
      .set({ damagedStock: sql`${stockTable.damagedStock} + ${quantity}` })
      .where(eq(stockTable.id, id));
    await logMovement({
      stockId: id, productName: existing.productName, vendorId: existing.vendorId,
      movementType: "stock_out", qty: quantity,
      note: note ?? "Damaged / written off",
      performedByUserId: userId, performedByName: user?.name ?? null,
    });
  }

  const [updated] = await db.select().from(stockTable).where(eq(stockTable.id, id));
  if (!updated) { res.status(404).json({ error: "Stock entry not found" }); return; }
  res.json(await formatStock(updated));
});

router.delete("/stock/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [s] = await db.delete(stockTable).where(eq(stockTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Stock entry not found" }); return; }
  res.json({ success: true });
});

export default router;
