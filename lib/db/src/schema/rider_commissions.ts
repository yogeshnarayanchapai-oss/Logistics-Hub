import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riderCommissionsTable = pgTable("rider_commissions", {
  id: serial("id").primaryKey(),
  riderId: integer("rider_id").notNull(),
  orderId: integer("order_id").notNull(),
  orderCode: text("order_code"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("earned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRiderCommissionSchema = createInsertSchema(riderCommissionsTable).omit({ id: true, createdAt: true });
export type InsertRiderCommission = z.infer<typeof insertRiderCommissionSchema>;
export type RiderCommission = typeof riderCommissionsTable.$inferSelect;
