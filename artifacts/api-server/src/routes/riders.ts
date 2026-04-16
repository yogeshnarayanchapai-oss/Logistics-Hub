import { Router, type IRouter } from "express";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import { db, ridersTable, stationsTable, ordersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

async function formatRider(r: typeof ridersTable.$inferSelect) {
  let stationName: string | null = null;
  if (r.stationId) {
    const [s] = await db.select().from(stationsTable).where(eq(stationsTable.id, r.stationId));
    stationName = s?.name ?? null;
  }

  const [assignedResult] = await db.select({ count: count() }).from(ordersTable)
    .where(eq(ordersTable.riderId, r.id));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [deliveredResult] = await db.select({ count: count() }).from(ordersTable)
    .where(and(eq(ordersTable.riderId, r.id), eq(ordersTable.status, "delivered"),
      sql`${ordersTable.deliveredAt} >= ${today.toISOString()}`));

  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    vehicleNumber: r.vehicleNumber,
    stationId: r.stationId,
    stationName,
    status: r.status,
    userId: r.userId,
    assignedCount: Number(assignedResult.count),
    deliveredToday: Number(deliveredResult.count),
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/riders", requireAuth, async (req, res): Promise<void> => {
  const { stationId, status, search } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (stationId) conditions.push(eq(ridersTable.stationId, parseInt(stationId, 10)));
  if (status) conditions.push(eq(ridersTable.status, status));
  if (search) conditions.push(ilike(ridersTable.name, `%${search}%`));
  const riders = conditions.length > 0
    ? await db.select().from(ridersTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await db.select().from(ridersTable);
  const formatted = await Promise.all(riders.map(formatRider));
  res.json(formatted);
});

router.post("/riders", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const { name, email, phone, vehicleNumber, stationId, linkUserId } = req.body;
  if (!name || !email) { res.status(400).json({ error: "name and email required" }); return; }
  const [rider] = await db.insert(ridersTable).values({
    name, email, phone, vehicleNumber,
    stationId: stationId ?? null,
    userId: linkUserId ?? null,
  }).returning();
  await createAuditLog({ userId, action: "create", entity: "rider", entityId: rider.id, description: `Created rider ${rider.name}` });
  res.status(201).json(await formatRider(rider));
});

router.get("/riders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, id));
  if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }
  res.json(await formatRider(rider));
});

router.patch("/riders/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { name, email, phone, vehicleNumber, stationId, status } = req.body;
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (vehicleNumber !== undefined) updates.vehicleNumber = vehicleNumber;
  if (stationId !== undefined) updates.stationId = stationId;
  if (status) updates.status = status;
  const [rider] = await db.update(ridersTable).set(updates as any).where(eq(ridersTable.id, id)).returning();
  if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }
  await createAuditLog({ userId, action: "update", entity: "rider", entityId: id, description: `Updated rider ${rider.name}` });
  res.json(await formatRider(rider));
});

router.delete("/riders/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [rider] = await db.delete(ridersTable).where(eq(ridersTable.id, id)).returning();
  if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }
  await createAuditLog({ userId, action: "delete", entity: "rider", entityId: id, description: `Deleted rider ${rider.name}` });
  res.sendStatus(204);
});

export default router;
