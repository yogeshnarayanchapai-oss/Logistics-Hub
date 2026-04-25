import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db, stockMovementsTable, vendorsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /stock-movements — list with filters: dateFrom, dateTo, movementType, vendorId, stockId
router.get("/stock-movements", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { dateFrom, dateTo, movementType, vendorId, stockId } = req.query as Record<string, string>;

  const conditions: any[] = [];

  // Vendors only see their own stock movements
  if (userRole === "vendor") {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
    if (!vendor) { res.json([]); return; }
    conditions.push(eq(stockMovementsTable.vendorId, vendor.id));
  } else if (vendorId) {
    conditions.push(eq(stockMovementsTable.vendorId, parseInt(vendorId, 10)));
  }

  if (stockId) {
    conditions.push(eq(stockMovementsTable.stockId, parseInt(stockId, 10)));
  }

  if (movementType && movementType !== "all") {
    conditions.push(eq(stockMovementsTable.movementType, movementType));
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    conditions.push(gte(stockMovementsTable.createdAt, from));
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(stockMovementsTable.createdAt, to));
  }

  const rows = conditions.length > 0
    ? await db.select().from(stockMovementsTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(stockMovementsTable.createdAt))
        .limit(500)
    : await db.select().from(stockMovementsTable)
        .orderBy(desc(stockMovementsTable.createdAt))
        .limit(500);

  // Enrich with vendor names
  const vendorIds = [...new Set(rows.map(r => r.vendorId))];
  const vendors = vendorIds.length > 0
    ? await db.select().from(vendorsTable).where(
        vendorIds.length === 1
          ? eq(vendorsTable.id, vendorIds[0])
          : sql`${vendorsTable.id} = ANY(ARRAY[${sql.join(vendorIds.map(id => sql`${id}`), sql`, `)}])`
      )
    : [];

  const vendorMap: Record<number, string> = {};
  for (const v of vendors) vendorMap[v.id] = v.name;

  res.json(rows.map(r => ({
    id: r.id,
    stockId: r.stockId,
    productName: r.productName,
    vendorId: r.vendorId,
    vendorName: vendorMap[r.vendorId] ?? "Unknown",
    movementType: r.movementType,
    qty: r.qty,
    riderId: r.riderId,
    riderName: r.riderName,
    note: r.note,
    performedByName: r.performedByName,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
