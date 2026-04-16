import { serial, text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const supportContactsTable = pgTable("support_contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
