import { Router, type IRouter } from "express";
import { eq, ilike, and, count } from "drizzle-orm";
import { db, ticketsTable, ticketMessagesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

async function formatTicket(t: typeof ticketsTable.$inferSelect) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, t.createdBy));
  let assignedToName: string | null = null;
  if (t.assignedTo) {
    const [a] = await db.select().from(usersTable).where(eq(usersTable.id, t.assignedTo));
    assignedToName = a?.name ?? null;
  }
  const [{ count: mc }] = await db.select({ count: count() }).from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, t.id));
  return {
    id: t.id, subject: t.subject, category: t.category,
    priority: t.priority, status: t.status,
    createdBy: t.createdBy,
    createdByName: u?.name ?? "Unknown",
    createdByRole: u?.role ?? "unknown",
    assignedTo: t.assignedTo, assignedToName,
    messageCount: Number(mc),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get("/tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const userRole = (req as any).userRole as string;
  const { status, category, priority, search } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (!["admin", "manager"].includes(userRole)) conditions.push(eq(ticketsTable.createdBy, userId));
  if (status) conditions.push(eq(ticketsTable.status, status));
  if (category) conditions.push(eq(ticketsTable.category, category));
  if (priority) conditions.push(eq(ticketsTable.priority, priority));
  if (search) conditions.push(ilike(ticketsTable.subject, `%${search}%`));

  const tickets = conditions.length > 0
    ? await db.select().from(ticketsTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await db.select().from(ticketsTable);

  res.json(await Promise.all(tickets.map(formatTicket)));
});

router.post("/tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const { subject, category, priority, message } = req.body;
  if (!subject || !category || !priority || !message) {
    res.status(400).json({ error: "subject, category, priority, message required" }); return;
  }
  const [ticket] = await db.insert(ticketsTable).values({
    subject, category, priority, createdBy: userId,
  }).returning();
  await db.insert(ticketMessagesTable).values({ ticketId: ticket.id, userId, message });
  res.status(201).json(await formatTicket(ticket));
});

router.get("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  const messages = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, id));
  const formatted = await Promise.all(messages.map(async (m) => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, m.userId));
    return { id: m.id, ticketId: m.ticketId, userId: m.userId, userName: u?.name ?? "Unknown", userRole: u?.role ?? "unknown", message: m.message, createdAt: m.createdAt.toISOString() };
  }));
  res.json({ ticket: await formatTicket(ticket), messages: formatted });
});

router.patch("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const { status, assignedTo } = req.body;
  if (status) updates.status = status;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  const [ticket] = await db.update(ticketsTable).set(updates as any).where(eq(ticketsTable.id, id)).returning();
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatTicket(ticket));
});

router.post("/tickets/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }
  const [msg] = await db.insert(ticketMessagesTable).values({ ticketId: id, userId, message }).returning();
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  // Update ticket status to waiting_reply
  await db.update(ticketsTable).set({ status: "waiting_reply" }).where(eq(ticketsTable.id, id));
  res.status(201).json({ id: msg.id, ticketId: msg.ticketId, userId: msg.userId, userName: u?.name ?? "Unknown", userRole: u?.role ?? "unknown", message: msg.message, createdAt: msg.createdAt.toISOString() });
});

export default router;
