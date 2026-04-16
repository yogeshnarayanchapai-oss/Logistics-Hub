import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count, desc } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/audit-logs", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { userId, action, dateFrom, dateTo, page = "1", limit = "50" } = req.query as Record<string, string>;
  
  const conditions: any[] = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, parseInt(userId, 10)));
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (dateFrom) conditions.push(gte(auditLogsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(auditLogsTable.createdAt, new Date(dateTo)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const [{ total }] = await db.select({ total: count() }).from(auditLogsTable).where(whereClause);
  const logs = await db.select().from(auditLogsTable).where(whereClause)
    .orderBy(desc(auditLogsTable.createdAt)).limit(limitNum).offset(offset);

  const formatted = await Promise.all(logs.map(async (l) => {
    let userName: string | null = null;
    let userRole: string | null = null;
    if (l.userId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, l.userId));
      userName = u?.name ?? null;
      userRole = u?.role ?? null;
    }
    return { id: l.id, userId: l.userId, userName, userRole, action: l.action, entity: l.entity, entityId: l.entityId, description: l.description, metadata: l.metadata, createdAt: l.createdAt.toISOString() };
  }));

  res.json({ logs: formatted, total: Number(total), page: pageNum, limit: limitNum });
});

export default router;
