import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, stationsTable, ridersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

async function formatStation(station: typeof stationsTable.$inferSelect) {
  const [{ count: rc }] = await db
    .select({ count: count() })
    .from(ridersTable)
    .where(eq(ridersTable.stationId, station.id));
  return {
    id: station.id,
    name: station.name,
    code: station.code,
    address: station.address,
    areaCoverage: station.areaCoverage,
    deliveryCharge: station.deliveryCharge ?? 0,
    status: station.status,
    riderCount: Number(rc),
    createdAt: station.createdAt.toISOString(),
  };
}

router.get("/stations", requireAuth, async (req, res): Promise<void> => {
  const stations = await db.select().from(stationsTable);
  const formatted = await Promise.all(stations.map(formatStation));
  res.json(formatted);
});

router.post("/stations", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const { name, code, address, areaCoverage, deliveryCharge } = req.body;
  if (!name || !code) { res.status(400).json({ error: "name and code required" }); return; }
  const [station] = await db.insert(stationsTable).values({ name, code, address, areaCoverage, deliveryCharge: deliveryCharge ? Number(deliveryCharge) : 0 }).returning();
  await createAuditLog({ userId, action: "create", entity: "station", entityId: station.id, description: `Created station ${station.name}` });
  res.status(201).json(await formatStation(station));
});

router.get("/stations/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, id));
  if (!station) { res.status(404).json({ error: "Station not found" }); return; }
  res.json(await formatStation(station));
});

router.patch("/stations/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { name, code, address, areaCoverage, deliveryCharge, status } = req.body;
  if (name) updates.name = name;
  if (code) updates.code = code;
  if (address !== undefined) updates.address = address;
  if (areaCoverage !== undefined) updates.areaCoverage = areaCoverage;
  if (deliveryCharge !== undefined) updates.deliveryCharge = Number(deliveryCharge);
  if (status) updates.status = status;
  const [station] = await db.update(stationsTable).set(updates as any).where(eq(stationsTable.id, id)).returning();
  if (!station) { res.status(404).json({ error: "Station not found" }); return; }
  await createAuditLog({ userId, action: "update", entity: "station", entityId: id, description: `Updated station ${station.name}` });
  res.json(await formatStation(station));
});

router.delete("/stations/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [station] = await db.delete(stationsTable).where(eq(stationsTable.id, id)).returning();
  if (!station) { res.status(404).json({ error: "Station not found" }); return; }
  await createAuditLog({ userId, action: "delete", entity: "station", entityId: id, description: `Deleted station ${station.name}` });
  res.sendStatus(204);
});

export default router;
