import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function formatNotification(n: typeof notificationsTable.$inferSelect) {
  return { id: n.id, userId: n.userId, title: n.title, message: n.message, type: n.type, relatedId: n.relatedId, isRead: n.isRead, createdAt: n.createdAt.toISOString() };
}

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const { unreadOnly } = req.query as Record<string, string>;
  const conditions: any[] = [eq(notificationsTable.userId, userId)];
  if (unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));
  const notes = await db.select().from(notificationsTable).where(and(...conditions));
  res.json(notes.map(formatNotification));
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, userId));
  res.json({ success: true });
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id));
  res.json({ success: true });
});

export default router;
