import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stockTable = pgTable("stock", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  productName: text("product_name").notNull(),
  productSku: text("product_sku"),
  openingStock: integer("opening_stock").notNull().default(0),
  receivedStock: integer("received_stock").notNull().default(0),
  deliveredStock: integer("delivered_stock").notNull().default(0),
  returnedStock: integer("returned_stock").notNull().default(0),
  damagedStock: integer("damaged_stock").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStockSchema = createInsertSchema(stockTable).omit({ id: true, updatedAt: true });
export type InsertStock = z.infer<typeof insertStockSchema>;
export type Stock = typeof stockTable.$inferSelect;
