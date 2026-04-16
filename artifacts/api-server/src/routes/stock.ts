import { Router, type IRouter } from "express";
import { eq, ilike, and } from "drizzle-orm";
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

router.post("/stock", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { vendorId, productName, productSku, openingStock, receivedStock } = req.body;
  if (!vendorId || !productName) { res.status(400).json({ error: "vendorId and productName required" }); return; }
  const [s] = await db.insert(stockTable).values({
    vendorId, productName, productSku: productSku ?? null,
    openingStock: openingStock ?? 0,
    receivedStock: receivedStock ?? 0,
  }).returning();
  res.status(201).json(await formatStock(s));
});

router.patch("/stock/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { receivedStock, damagedStock } = req.body;
  if (receivedStock !== undefined) updates.receivedStock = receivedStock;
  if (damagedStock !== undefined) updates.damagedStock = damagedStock;
  const [s] = await db.update(stockTable).set(updates as any).where(eq(stockTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Stock entry not found" }); return; }
  res.json(await formatStock(s));
});

router.delete("/stock/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [s] = await db.delete(stockTable).where(eq(stockTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Stock entry not found" }); return; }
  res.json({ success: true });
});

export default router;
