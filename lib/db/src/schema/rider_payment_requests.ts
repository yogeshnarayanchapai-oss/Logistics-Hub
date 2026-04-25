import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riderPaymentRequestsTable = pgTable("rider_payment_requests", {
  id: serial("id").primaryKey(),
  riderId: integer("rider_id").notNull(),
  bankAccountId: integer("bank_account_id").notNull(),
  requestedAmount: numeric("requested_amount", { precision: 10, scale: 2 }).notNull(),
  approvedAmount: numeric("approved_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  releaseNote: text("release_note"),
  referenceId: text("reference_id"),
  paymentDate: text("payment_date"),
  reviewedBy: integer("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRiderPaymentRequestSchema = createInsertSchema(riderPaymentRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRiderPaymentRequest = z.infer<typeof insertRiderPaymentRequestSchema>;
export type RiderPaymentRequest = typeof riderPaymentRequestsTable.$inferSelect;
