import { Router, type IRouter } from "express";
import { eq, ilike, or, and } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

function formatVendor(v: typeof vendorsTable.$inferSelect) {
  return {
    id: v.id,
    name: v.name,
    businessName: v.businessName,
    email: v.email,
    phone: v.phone,
    address: v.address,
    vendorCode: v.vendorCode,
    deliveryCharge: Number(v.deliveryCharge),
    status: v.status,
    userId: v.userId,
    createdAt: v.createdAt.toISOString(),
  };
}

router.get("/vendors", requireAuth, async (req, res): Promise<void> => {
  const { status, search } = req.query as Record<string, string>;
  const conditions = [];
  if (status) conditions.push(eq(vendorsTable.status, status));
  if (search) conditions.push(or(ilike(vendorsTable.name, `%${search}%`), ilike(vendorsTable.vendorCode, `%${search}%`))!);
  const vendors = conditions.length > 0
    ? await db.select().from(vendorsTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await db.select().from(vendorsTable);
  res.json(vendors.map(formatVendor));
});

router.post("/vendors", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const { name, businessName, email, phone, address, vendorCode, deliveryCharge, linkUserId } = req.body;
  if (!name || !email || !vendorCode || deliveryCharge === undefined) {
    res.status(400).json({ error: "name, email, vendorCode, deliveryCharge required" });
    return;
  }
  const [vendor] = await db.insert(vendorsTable).values({
    name, businessName, email, phone, address, vendorCode,
    deliveryCharge: String(deliveryCharge),
    userId: linkUserId ?? null,
  }).returning();
  await createAuditLog({ userId, action: "create", entity: "vendor", entityId: vendor.id, description: `Created vendor ${vendor.name}` });
  res.status(201).json(formatVendor(vendor));
});

router.get("/vendors/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const userRole = (req as any).userRole as string;
  const reqUserId = (req as any).userId as number;

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

  if (userRole === "vendor" && vendor.userId !== reqUserId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  res.json(formatVendor(vendor));
});

router.patch("/vendors/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { name, businessName, email, phone, address, vendorCode, deliveryCharge, status, linkUserId } = req.body;
  if (name) updates.name = name;
  if (businessName !== undefined) updates.businessName = businessName;
  if (email) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (vendorCode) updates.vendorCode = vendorCode;
  if (deliveryCharge !== undefined) updates.deliveryCharge = String(deliveryCharge);
  if (status) updates.status = status;
  if (linkUserId !== undefined) updates.userId = linkUserId;
  const [vendor] = await db.update(vendorsTable).set(updates as any).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }
  await createAuditLog({ userId, action: "update", entity: "vendor", entityId: id, description: `Updated vendor ${vendor.name}` });
  res.json(formatVendor(vendor));
});

router.delete("/vendors/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [vendor] = await db.delete(vendorsTable).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }
  await createAuditLog({ userId, action: "delete", entity: "vendor", entityId: id, description: `Deleted vendor ${vendor.name}` });
  res.sendStatus(204);
});

export default router;
