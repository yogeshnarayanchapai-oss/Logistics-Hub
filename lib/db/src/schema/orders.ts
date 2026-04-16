import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull().unique(),
  vendorId: integer("vendor_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  alternatePhone: text("alternate_phone"),
  productName: text("product_name").notNull(),
  productSku: text("product_sku"),
  quantity: integer("quantity").notNull().default(1),
  codAmount: numeric("cod_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  deliveryCharge: numeric("delivery_charge", { precision: 10, scale: 2 }).notNull().default("0"),
  vendorPayable: numeric("vendor_payable", { precision: 10, scale: 2 }).notNull().default("0"),
  address: text("address").notNull(),
  landmark: text("landmark"),
  area: text("area"),
  city: text("city"),
  district: text("district"),
  stationId: integer("station_id"),
  riderId: integer("rider_id"),
  priority: text("priority").notNull().default("normal"),
  requestedDeliveryTime: text("requested_delivery_time"),
  status: text("status").notNull().default("new"),
  duplicateFlag: boolean("duplicate_flag").notNull().default(false),
  duplicateReason: text("duplicate_reason"),
  matchedOrderId: integer("matched_order_id"),
  duplicateConfidence: text("duplicate_confidence"),
  paymentReleaseStatus: text("payment_release_status").notNull().default("pending"),
  notes: text("notes"),
  internalNote: text("internal_note"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
