import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id").notNull(),
  productName: text("product_name").notNull(),
  vendorId: integer("vendor_id").notNull(),
  movementType: text("movement_type").notNull(),
  qty: integer("qty").notNull(),
  riderId: integer("rider_id"),
  riderName: text("rider_name"),
  note: text("note"),
  performedByUserId: integer("performed_by_user_id"),
  performedByName: text("performed_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StockMovement = typeof stockMovementsTable.$inferSelect;
