import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ridersTable = pgTable("riders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  vehicleNumber: text("vehicle_number"),
  stationId: integer("station_id"),
  status: text("status").notNull().default("active"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRiderSchema = createInsertSchema(ridersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRider = z.infer<typeof insertRiderSchema>;
export type Rider = typeof ridersTable.$inferSelect;
