import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, stockTable, vendorsTable } from "@workspace/db";
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

  // For vendors, auto-resolve their vendorId
  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor) { res.status(403).json({ error: "Vendor profile not found" }); return; }
    vendorId = vendor.id;
  }

  if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }

  const [s] = await db.insert(stockTable).values({
    vendorId: Number(vendorId),
    productName,
    productSku: productSku ?? null,
    openingStock: openingStock ?? 0,
    receivedStock: openingStock ?? 0,
  }).returning();
  res.status(201).json(await formatStock(s));
});

// PATCH: "stock-in" and "stock-out" movements — INCREMENT existing totals, never replace
router.patch("/stock/:id", requireAuth, requireRole("admin", "manager", "vendor"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  // Verify entry exists (and vendor can only touch their own)
  const [existing] = await db.select().from(stockTable).where(eq(stockTable.id, id));
  if (!existing) { res.status(404).json({ error: "Stock entry not found" }); return; }

  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor || vendor.id !== existing.vendorId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }

  const { type, qty, productName, productSku } = req.body;
  const quantity = Number(qty) || 0;

  // Allow updating product info
  if (productName !== undefined || productSku !== undefined) {
    const infoUpdates: any = {};
    if (productName) infoUpdates.productName = productName;
    if (productSku !== undefined) infoUpdates.productSku = productSku;
    await db.update(stockTable).set(infoUpdates).where(eq(stockTable.id, id));
  }

  // Stock movements — always INCREMENT
  if (type === "in" && quantity > 0) {
    await db.update(stockTable)
      .set({ receivedStock: sql`${stockTable.receivedStock} + ${quantity}` })
      .where(eq(stockTable.id, id));
  } else if (type === "out" && quantity > 0) {
    await db.update(stockTable)
      .set({ damagedStock: sql`${stockTable.damagedStock} + ${quantity}` })
      .where(eq(stockTable.id, id));
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
