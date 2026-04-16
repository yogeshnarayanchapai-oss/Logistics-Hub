import { db, auditLogsTable } from "@workspace/db";

export async function createAuditLog({
  userId,
  action,
  entity,
  entityId,
  description,
  metadata,
}: {
  userId?: number;
  action: string;
  entity: string;
  entityId?: number;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId,
    action,
    entity,
    entityId,
    description,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
}
