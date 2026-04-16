import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderCommentsTable = pgTable("order_comments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  visibility: text("visibility").notNull().default("all"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderCommentSchema = createInsertSchema(orderCommentsTable).omit({ id: true, createdAt: true });
export type InsertOrderComment = z.infer<typeof insertOrderCommentSchema>;
export type OrderComment = typeof orderCommentsTable.$inferSelect;
