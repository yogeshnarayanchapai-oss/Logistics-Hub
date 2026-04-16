import { Router, type IRouter } from "express";
import { eq, ilike, or, and, ne } from "drizzle-orm";
import { db, usersTable, stationsTable, vendorsTable, ridersTable } from "@workspace/db";
import { requireAuth, requireRole, hashPassword } from "../lib/auth";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

async function formatUser(user: typeof usersTable.$inferSelect) {
  let stationName: string | null = null;
  if (user.stationId) {
    const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, user.stationId));
    stationName = station?.name ?? null;
  }
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, user.id));
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, user.id));
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    stationId: user.stationId,
    stationName,
    vendorId: vendor?.id ?? null,
    riderId: rider?.id ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/users", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { role, status, search } = req.query as Record<string, string>;
  
  const conditions = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (status) conditions.push(eq(usersTable.status, status));
  if (search) conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))!);

  const users = conditions.length > 0
    ? await db.select().from(usersTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await db.select().from(usersTable);

  const formatted = await Promise.all(users.map(formatUser));
  res.json(formatted);
});

router.post("/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const { name, email, password, phone, role, stationId, vendorCode, deliveryCharge, businessName } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "name, email, password, and role are required" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(400).json({ error: "Email already exists" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    phone: phone ?? null,
    role,
    status: "active",
    stationId: stationId ?? null,
  }).returning();

  await createAuditLog({ userId: actorId, action: "create", entity: "user", entityId: user.id, description: `Created user ${user.name}` });

  // Auto-create linked rider profile
  if (role === "rider") {
    const [existingRider] = await db.select().from(ridersTable).where(eq(ridersTable.email, email.toLowerCase()));
    if (!existingRider) {
      const [rider] = await db.insert(ridersTable).values({
        name,
        email: email.toLowerCase(),
        phone: phone ?? null,
        userId: user.id,
      }).returning();
      await createAuditLog({ userId: actorId, action: "create", entity: "rider", entityId: rider.id, description: `Auto-created rider profile for ${name}` });
    } else {
      await db.update(ridersTable).set({ userId: user.id }).where(eq(ridersTable.id, existingRider.id));
    }
  }

  // Auto-create linked vendor profile
  if (role === "vendor") {
    if (!vendorCode) {
      res.status(400).json({ error: "vendorCode is required for vendor users" });
      return;
    }
    const [existingVendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.email, email.toLowerCase()));
    if (!existingVendor) {
      const [vendor] = await db.insert(vendorsTable).values({
        name,
        businessName: businessName ?? null,
        email: email.toLowerCase(),
        phone: phone ?? null,
        vendorCode,
        deliveryCharge: String(deliveryCharge ?? 100),
        userId: user.id,
      }).returning();
      await createAuditLog({ userId: actorId, action: "create", entity: "vendor", entityId: vendor.id, description: `Auto-created vendor profile for ${name}` });
    } else {
      await db.update(vendorsTable).set({ userId: user.id }).where(eq(vendorsTable.id, existingVendor.id));
    }
  }

  const formatted = await formatUser(user);
  res.status(201).json(formatted);
});

router.get("/users/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(await formatUser(user));
});

router.patch("/users/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  const { name, email, phone, role, status, stationId } = req.body;
  if (name) updates.name = name;
  if (email) updates.email = email.toLowerCase();
  if (phone !== undefined) updates.phone = phone;
  if (role) updates.role = role;
  if (status) updates.status = status;
  if (stationId !== undefined) updates.stationId = stationId;

  const [user] = await db.update(usersTable).set(updates as any).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Sync name/email/phone/status to linked vendor and rider profiles
  const profileUpdates: Record<string, unknown> = {};
  if (name) profileUpdates.name = name;
  if (email) profileUpdates.email = email.toLowerCase();
  if (phone !== undefined) profileUpdates.phone = phone;
  if (status) profileUpdates.status = status;

  if (Object.keys(profileUpdates).length > 0) {
    await db.update(vendorsTable).set(profileUpdates as any).where(eq(vendorsTable.userId, id));
    await db.update(ridersTable).set(profileUpdates as any).where(eq(ridersTable.userId, id));
  }

  await createAuditLog({ userId: actorId, action: "update", entity: "user", entityId: id, description: `Updated user ${user.name}` });
  res.json(await formatUser(user));
});

router.delete("/users/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }
  await db.delete(vendorsTable).where(eq(vendorsTable.userId, id));
  await db.delete(ridersTable).where(eq(ridersTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  await createAuditLog({ userId: actorId, action: "delete", entity: "user", entityId: id, description: `Deleted user ${existing.name}` });
  res.sendStatus(204);
});

router.post("/users/:id/reset-password", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { newPassword } = req.body;
  if (!newPassword) { res.status(400).json({ error: "newPassword required" }); return; }
  const [user] = await db.update(usersTable).set({ passwordHash: hashPassword(newPassword) }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await createAuditLog({ userId: actorId, action: "reset_password", entity: "user", entityId: id, description: `Reset password for ${user.name}` });
  res.json({ success: true });
});

export default router;
