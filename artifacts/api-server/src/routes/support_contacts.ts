import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, supportContactsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

router.get("/support-contacts", requireAuth, async (req, res): Promise<void> => {
  const contacts = await db.select().from(supportContactsTable).orderBy(supportContactsTable.createdAt);
  res.json(contacts);
});

router.post("/support-contacts", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const { name, department, phone } = req.body;
  if (!name || !department || !phone) {
    res.status(400).json({ error: "name, department, and phone are required" });
    return;
  }
  const [contact] = await db.insert(supportContactsTable).values({ name, department, phone }).returning();
  await createAuditLog({ userId: actorId, action: "create", entity: "support_contact", entityId: contact.id, description: `Added support contact ${contact.name}` });
  res.status(201).json(contact);
});

router.patch("/support-contacts/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const id = parseInt(req.params.id, 10);
  const { name, department, phone } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (department) updates.department = department;
  if (phone) updates.phone = phone;
  const [contact] = await db.update(supportContactsTable).set(updates as any).where(eq(supportContactsTable.id, id)).returning();
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  await createAuditLog({ userId: actorId, action: "update", entity: "support_contact", entityId: id, description: `Updated support contact ${contact.name}` });
  res.json(contact);
});

router.delete("/support-contacts/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const actorId = (req as any).userId as number;
  const id = parseInt(req.params.id, 10);
  const [contact] = await db.delete(supportContactsTable).where(eq(supportContactsTable.id, id)).returning();
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  await createAuditLog({ userId: actorId, action: "delete", entity: "support_contact", entityId: id, description: `Removed support contact ${contact.name}` });
  res.sendStatus(204);
});

export default router;
