import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riderBankAccountsTable = pgTable("rider_bank_accounts", {
  id: serial("id").primaryKey(),
  riderId: integer("rider_id").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  bankName: text("bank_name").notNull(),
  branch: text("branch"),
  accountNumber: text("account_number").notNull(),
  walletMethod: text("wallet_method"),
  remarks: text("remarks"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRiderBankAccountSchema = createInsertSchema(riderBankAccountsTable).omit({ id: true, createdAt: true });
export type InsertRiderBankAccount = z.infer<typeof insertRiderBankAccountSchema>;
export type RiderBankAccount = typeof riderBankAccountsTable.$inferSelect;
