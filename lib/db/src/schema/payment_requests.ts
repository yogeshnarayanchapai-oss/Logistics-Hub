import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentRequestsTable = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  bankAccountId: integer("bank_account_id").notNull(),
  requestedAmount: numeric("requested_amount", { precision: 10, scale: 2 }).notNull(),
  approvedAmount: numeric("approved_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  releaseNote: text("release_note"),
  adminNote: text("admin_note"),
  referenceId: text("reference_id"),
  paymentDate: text("payment_date"),
  reviewedBy: integer("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentRequestSchema = createInsertSchema(paymentRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type PaymentRequest = typeof paymentRequestsTable.$inferSelect;
