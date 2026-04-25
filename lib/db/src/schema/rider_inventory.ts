import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const riderInventoryTable = pgTable("rider_inventory", {
  id: serial("id").primaryKey(),
  riderId: integer("rider_id").notNull(),
  stockId: integer("stock_id").notNull(),
  productName: text("product_name").notNull(),
  assignedQty: integer("assigned_qty").notNull().default(0),
  deliveredQty: integer("delivered_qty").notNull().default(0),
  returnedQty: integer("returned_qty").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type RiderInventory = typeof riderInventoryTable.$inferSelect;
