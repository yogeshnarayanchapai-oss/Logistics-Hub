import { Router, type IRouter } from "express";
import { eq, ilike, and, count, sql, sum } from "drizzle-orm";
import { db, ridersTable, stationsTable, ordersTable, usersTable, riderCommissionsTable, riderPaymentRequestsTable } from "@workspace/db";
import { requireAuth, requireRole, hashPassword } from "../lib/auth";
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

  const [totalEarned] = await db.select({ v: sum(riderCommissionsTable.amount) }).from(riderCommissionsTable).where(eq(riderCommissionsTable.riderId, r.id));
  const [totalReleased] = await db.select({ v: sum(riderPaymentRequestsTable.approvedAmount) }).from(riderPaymentRequestsTable).where(and(eq(riderPaymentRequestsTable.riderId, r.id), eq(riderPaymentRequestsTable.status, "released")));

  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    vehicleNumber: r.vehicleNumber,
    stationId: r.stationId,
    stationName,
    status: r.status,
    coverageArea: r.coverageArea ?? null,
    commissionRate: Number(r.commissionRate ?? 0),
    userId: r.userId,
    assignedCount: Number(assignedResult.count),
    deliveredToday: Number(deliveredResult.count),
    totalCommissionEarned: Number(totalEarned?.v ?? 0),
    totalCommissionReleased: Number(totalReleased?.v ?? 0),
    pendingCommission: Number(totalEarned?.v ?? 0) - Number(totalReleased?.v ?? 0),
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
  const actorId = (req as any).userId as number;
  const { name, email, phone, vehicleNumber, stationId, password, coverageArea, commissionRate } = req.body;
  if (!name || !email) { res.status(400).json({ error: "name and email required" }); return; }

  // Check if a user already exists with this email
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  let linkedUserId: number | null = null;

  if (existingUser) {
    // Link to existing user (update role to rider if not already)
    if (existingUser.role !== "rider") {
      await db.update(usersTable).set({ role: "rider" }).where(eq(usersTable.id, existingUser.id));
    }
    linkedUserId = existingUser.id;
  } else {
    // Auto-create a user account
    if (!password) { res.status(400).json({ error: "password required to create user account" }); return; }
    const [newUser] = await db.insert(usersTable).values({
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      phone: phone ?? null,
      role: "rider",
      status: "active",
    }).returning();
    linkedUserId = newUser.id;
    await createAuditLog({ userId: actorId, action: "create", entity: "user", entityId: newUser.id, description: `Auto-created user account for rider ${name}` });
  }

  const [rider] = await db.insert(ridersTable).values({
    name, email, phone, vehicleNumber,
    stationId: stationId ?? null,
    coverageArea: coverageArea || null,
    commissionRate: commissionRate ? commissionRate.toString() : "0",
    userId: linkedUserId,
  }).returning();

  // Also update the linked user's userId reference if needed
  await createAuditLog({ userId: actorId, action: "create", entity: "rider", entityId: rider.id, description: `Created rider ${rider.name}` });
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
  const actorId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { name, email, phone, vehicleNumber, stationId, status, coverageArea, commissionRate } = req.body;
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (vehicleNumber !== undefined) updates.vehicleNumber = vehicleNumber;
  if (stationId !== undefined) updates.stationId = stationId;
  if (status) updates.status = status;
  if (coverageArea !== undefined) updates.coverageArea = coverageArea || null;
  if (commissionRate !== undefined) updates.commissionRate = commissionRate.toString();
  const [rider] = await db.update(ridersTable).set(updates as any).where(eq(ridersTable.id, id)).returning();
  if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }

  // Sync to linked user
  if (rider.userId) {
    const userUpdates: Record<string, unknown> = {};
    if (name) userUpdates.name = name;
    if (email) userUpdates.email = email.toLowerCase();
    if (phone !== undefined) userUpdates.phone = phone;
    if (status) userUpdates.status = status;
    if (Object.keys(userUpdates).length > 0) {
      await db.update(usersTable).set(userUpdates as any).where(eq(usersTable.id, rider.userId));
    }
  }

  await createAuditLog({ userId: actorId, action: "update", entity: "rider", entityId: id, description: `Updated rider ${rider.name}` });
  res.json(await formatRider(rider));
});

router.delete("/riders/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.id, id));
  if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }
  await db.delete(ridersTable).where(eq(ridersTable.id, id));
  // Also delete linked user
  if (rider.userId) {
    await db.delete(usersTable).where(eq(usersTable.id, rider.userId));
  }
  await createAuditLog({ userId: actorId, action: "delete", entity: "rider", entityId: id, description: `Deleted rider ${rider.name}` });
  res.sendStatus(204);
});

export default router;
