import { db, notificationsTable } from "@workspace/db";

export async function createNotification({
  userId,
  title,
  message,
  type,
  relatedId,
}: {
  userId: number;
  title: string;
  message: string;
  type: string;
  relatedId?: number;
}): Promise<void> {
  await db.insert(notificationsTable).values({
    userId,
    title,
    message,
    type,
    relatedId,
  });
}
