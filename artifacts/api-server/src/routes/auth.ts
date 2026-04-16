import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, stationsTable, vendorsTable, ridersTable } from "@workspace/db";
import { hashPassword, verifyPassword, createToken, parseToken, requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status !== "active") {
    res.status(401).json({ error: "Account is inactive" });
    return;
  }

  const token = createToken(user.id, user.role);

  let stationName: string | null = null;
  if (user.stationId) {
    const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, user.stationId));
    stationName = station?.name ?? null;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, user.id));
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, user.id));

  res.json({
    token,
    user: {
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
    },
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let stationName: string | null = null;
  if (user.stationId) {
    const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, user.stationId));
    stationName = station?.name ?? null;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, user.id));
  const [rider] = await db.select().from(ridersTable).where(eq(ridersTable.userId, user.id));

  res.json({
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
  });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const { currentPassword, newPassword } = req.body;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  await db.update(usersTable).set({ passwordHash: hashPassword(newPassword) }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

export default router;
