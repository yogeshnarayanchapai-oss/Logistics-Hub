import { db, usersTable, stationsTable, vendorsTable, ridersTable, ordersTable, stockTable, orderCommentsTable, orderStatusHistoryTable, ticketsTable, ticketMessagesTable, bankAccountsTable, notificationsTable } from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "swiftship_salt").digest("hex");
}

function generateOrderCode(): string {
  const prefix = "SS";
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

async function seed() {
  console.log("Seeding database...");

  // Create stations
  const [ktm, ltp, bkt] = await db.insert(stationsTable).values([
    { name: "Kathmandu", code: "KTM", address: "New Road, Kathmandu", areaCoverage: "Thamel, New Road, Baneshwor, Koteshwor" },
    { name: "Lalitpur", code: "LTP", address: "Lagankhel, Lalitpur", areaCoverage: "Lagankhel, Jawalakhel, Mangalbazar" },
    { name: "Bhaktapur", code: "BKT", address: "Suryabinayak, Bhaktapur", areaCoverage: "Suryabinayak, Durbar Square, Kamalbinayak" },
  ]).returning();

  console.log("Stations created:", ktm.name, ltp.name, bkt.name);

  // Create admin user
  const [adminUser] = await db.insert(usersTable).values({
    name: "Super Admin",
    email: "admin@swiftship.com",
    passwordHash: hashPassword("Admin@123"),
    phone: "9800000001",
    role: "admin",
    status: "active",
  }).returning();

  // Create manager user
  const [managerUser] = await db.insert(usersTable).values({
    name: "Operations Manager",
    email: "manager@swiftship.com",
    passwordHash: hashPassword("Manager@123"),
    phone: "9800000002",
    role: "manager",
    status: "active",
    stationId: ktm.id,
  }).returning();

  // Create vendor users
  const [vendor1User] = await db.insert(usersTable).values({
    name: "Vedaz Skincare",
    email: "vendor1@swiftship.com",
    passwordHash: hashPassword("Vendor@123"),
    phone: "9800000003",
    role: "vendor",
    status: "active",
  }).returning();

  const [vendor2User] = await db.insert(usersTable).values({
    name: "NepalMart Store",
    email: "vendor2@swiftship.com",
    passwordHash: hashPassword("Vendor@123"),
    phone: "9800000004",
    role: "vendor",
    status: "active",
  }).returning();

  // Create rider users
  const riderNames = ["Ram Bahadur", "Sita Tamang", "Krishna Shrestha", "Anil Gurung", "Puja Maharjan"];
  const riderUsers = await db.insert(usersTable).values(
    riderNames.map((name, i) => ({
      name,
      email: `rider${i + 1}@swiftship.com`,
      passwordHash: hashPassword("Rider@123"),
      phone: `980000010${i + 1}`,
      role: "rider" as const,
      status: "active" as const,
      stationId: [ktm.id, ktm.id, ltp.id, ltp.id, bkt.id][i],
    }))
  ).returning();

  console.log("Users created:", riderUsers.length, "riders");

  // Create vendors
  const [vendor1] = await db.insert(vendorsTable).values({
    name: "Vedaz Skincare",
    businessName: "Vedaz Natural Products Pvt. Ltd.",
    email: "vedaz@example.com",
    phone: "9744638103",
    address: "Sinamangal, Kathmandu",
    vendorCode: "vedaz01",
    deliveryCharge: "100",
    status: "active",
    userId: vendor1User.id,
  }).returning();

  const [vendor2] = await db.insert(vendorsTable).values({
    name: "NepalMart",
    businessName: "NepalMart Online Store",
    email: "nepalmart@example.com",
    phone: "9812345678",
    address: "New Road, Kathmandu",
    vendorCode: "nplmrt01",
    deliveryCharge: "80",
    status: "active",
    userId: vendor2User.id,
  }).returning();

  // Create riders
  const riders = await db.insert(ridersTable).values([
    { name: "Ram Bahadur", email: "rider1@swiftship.com", phone: "9801001001", vehicleNumber: "BA 1 CHA 2345", stationId: ktm.id, status: "active", userId: riderUsers[0].id },
    { name: "Sita Tamang", email: "rider2@swiftship.com", phone: "9801001002", vehicleNumber: "BA 2 CHA 3456", stationId: ktm.id, status: "active", userId: riderUsers[1].id },
    { name: "Krishna Shrestha", email: "rider3@swiftship.com", phone: "9801001003", vehicleNumber: "BA 3 PA 4567", stationId: ltp.id, status: "active", userId: riderUsers[2].id },
    { name: "Anil Gurung", email: "rider4@swiftship.com", phone: "9801001004", vehicleNumber: "BA 4 PA 5678", stationId: ltp.id, status: "active", userId: riderUsers[3].id },
    { name: "Puja Maharjan", email: "rider5@swiftship.com", phone: "9801001005", vehicleNumber: "BA 5 JA 6789", stationId: bkt.id, status: "active", userId: riderUsers[4].id },
  ]).returning();

  console.log("Riders created:", riders.length);

  // Create stock
  await db.insert(stockTable).values([
    { vendorId: vendor1.id, productName: "Vitigo Bee Venom Treatment Cream", productSku: "VBV-001", openingStock: 50, receivedStock: 50, deliveredStock: 20, returnedStock: 2, damagedStock: 1 },
    { vendorId: vendor1.id, productName: "Vitamin C Serum", productSku: "VCS-001", openingStock: 30, receivedStock: 30, deliveredStock: 10, returnedStock: 0, damagedStock: 0 },
    { vendorId: vendor2.id, productName: "Organic Honey 500g", productSku: "ORH-001", openingStock: 100, receivedStock: 100, deliveredStock: 45, returnedStock: 5, damagedStock: 2 },
    { vendorId: vendor2.id, productName: "Yak Cheese 200g", productSku: "YKC-001", openingStock: 40, receivedStock: 40, deliveredStock: 15, returnedStock: 1, damagedStock: 0 },
  ]);

  // Sample orders
  const sampleOrders = [
    { customerName: "Ansan Baniya", customerPhone: "9744638103", productName: "Vitigo Bee Venom Treatment Cream", codAmount: "1000", address: "Sinamangal, Kathmandu", stationId: ktm.id, riderId: riders[0].id, status: "delivered", vendorId: vendor1.id, deliveryCharge: "100", vendorPayable: "900" },
    { customerName: "Ramesh Thapa", customerPhone: "9812345671", productName: "Vitamin C Serum", codAmount: "1500", address: "Baneshwor, Kathmandu", stationId: ktm.id, riderId: riders[1].id, status: "out_for_delivery", vendorId: vendor1.id, deliveryCharge: "100", vendorPayable: "1400" },
    { customerName: "Sunita Rai", customerPhone: "9823456712", productName: "Organic Honey 500g", codAmount: "800", address: "Jawalakhel, Lalitpur", stationId: ltp.id, riderId: riders[2].id, status: "assigned", vendorId: vendor2.id, deliveryCharge: "80", vendorPayable: "720" },
    { customerName: "Bikram Shah", customerPhone: "9834567123", productName: "Yak Cheese 200g", codAmount: "600", address: "Suryabinayak, Bhaktapur", stationId: bkt.id, riderId: riders[4].id, status: "new", vendorId: vendor2.id, deliveryCharge: "80", vendorPayable: "520" },
    { customerName: "Priya Gurung", customerPhone: "9845671234", productName: "Vitigo Bee Venom Treatment Cream", codAmount: "1000", address: "Thamel, Kathmandu", stationId: ktm.id, riderId: null, status: "new", vendorId: vendor1.id, deliveryCharge: "100", vendorPayable: "900" },
    { customerName: "Dipak Karki", customerPhone: "9856712345", productName: "Organic Honey 500g", codAmount: "1600", address: "Mangalbazar, Lalitpur", stationId: ltp.id, riderId: riders[3].id, status: "failed_delivery", vendorId: vendor2.id, deliveryCharge: "80", vendorPayable: "1520" },
    { customerName: "Ansan Baniya", customerPhone: "9744638103", productName: "Vitigo Bee Venom Treatment Cream", codAmount: "1000", address: "Sinamangal, Kathmandu", stationId: ktm.id, riderId: null, status: "duplicate_flagged", duplicateFlag: true, duplicateReason: "Matched fields: phone, product, address", matchedOrderId: null, duplicateConfidence: "high", vendorId: vendor1.id, deliveryCharge: "100", vendorPayable: "900" },
    { customerName: "Maya Shrestha", customerPhone: "9867123456", productName: "Vitamin C Serum", codAmount: "1500", address: "Patan Dhoka, Lalitpur", stationId: ltp.id, riderId: riders[2].id, status: "returned", vendorId: vendor1.id, deliveryCharge: "100", vendorPayable: "1400" },
  ];

  const insertedOrders = await db.insert(ordersTable).values(
    sampleOrders.map((o) => ({
      orderCode: generateOrderCode(),
      vendorId: o.vendorId,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      productName: o.productName,
      quantity: 1,
      codAmount: o.codAmount,
      deliveryCharge: o.deliveryCharge,
      vendorPayable: o.vendorPayable,
      address: o.address,
      stationId: o.stationId,
      riderId: o.riderId ?? null,
      status: o.status,
      duplicateFlag: (o as any).duplicateFlag ?? false,
      duplicateReason: (o as any).duplicateReason ?? null,
      duplicateConfidence: (o as any).duplicateConfidence ?? null,
      paymentReleaseStatus: o.status === "delivered" ? "pending" : "pending",
      priority: "normal",
      createdBy: adminUser.id,
      deliveredAt: o.status === "delivered" ? new Date() : null,
    }))
  ).returning();

  // Fix duplicate match
  if (insertedOrders[6]) {
    await db.update(ordersTable)
      .set({ matchedOrderId: insertedOrders[0].id })
      .where(db.$eq ? undefined : undefined);
  }

  // Comments
  await db.insert(orderCommentsTable).values([
    { orderId: insertedOrders[1].id, userId: riders[1].userId!, content: "Customer is not picking up the phone", visibility: "all" },
    { orderId: insertedOrders[1].id, userId: vendor1User.id, content: "Please try calling the alternate number 9811111111", visibility: "all" },
    { orderId: insertedOrders[5].id, userId: riders[3].userId!, content: "Address not found, gate locked", visibility: "all" },
    { orderId: insertedOrders[5].id, userId: managerUser.id, content: "Reschedule for tomorrow morning", visibility: "internal" },
  ]);

  // Status history
  await db.insert(orderStatusHistoryTable).values([
    { orderId: insertedOrders[0].id, status: "new", changedBy: adminUser.id },
    { orderId: insertedOrders[0].id, status: "assigned", changedBy: managerUser.id, note: "Assigned to Ram Bahadur" },
    { orderId: insertedOrders[0].id, status: "delivered", changedBy: riderUsers[0].id, note: "Delivered successfully" },
    { orderId: insertedOrders[1].id, status: "new", changedBy: vendor1User.id },
    { orderId: insertedOrders[1].id, status: "assigned", changedBy: managerUser.id },
    { orderId: insertedOrders[1].id, status: "out_for_delivery", changedBy: riderUsers[1].id },
  ]);

  // Bank accounts
  const [bankAccount1] = await db.insert(bankAccountsTable).values({
    vendorId: vendor1.id,
    accountHolderName: "Vedaz Natural Products Pvt. Ltd.",
    bankName: "Nabil Bank",
    branch: "New Road Branch",
    accountNumber: "1234567890",
    isDefault: true,
  }).returning();

  await db.insert(bankAccountsTable).values({
    vendorId: vendor2.id,
    accountHolderName: "NepalMart Online Store",
    bankName: "NIC Asia Bank",
    branch: "Thamel Branch",
    accountNumber: "0987654321",
    isDefault: true,
  });

  // Tickets
  const [ticket1] = await db.insert(ticketsTable).values({
    subject: "Payment not received for last month",
    category: "payment",
    priority: "high",
    status: "open",
    createdBy: vendor1User.id,
  }).returning();

  const [ticket2] = await db.insert(ticketsTable).values({
    subject: "Wrong delivery address for order SS-001",
    category: "delivery",
    priority: "medium",
    status: "in_progress",
    createdBy: vendor2User.id,
    assignedTo: managerUser.id,
  }).returning();

  await db.insert(ticketMessagesTable).values([
    { ticketId: ticket1.id, userId: vendor1User.id, message: "I have not received payment for deliveries made last month. Please check." },
    { ticketId: ticket1.id, userId: managerUser.id, message: "We are looking into this. Will get back to you within 24 hours." },
    { ticketId: ticket2.id, userId: vendor2User.id, message: "The delivery address for order SS-001 was wrong. Customer complained." },
  ]);

  // Notifications
  await db.insert(notificationsTable).values([
    { userId: vendor1User.id, title: "Order Delivered", message: "Your order has been delivered successfully", type: "order_delivered", relatedId: insertedOrders[0].id, isRead: false },
    { userId: managerUser.id, title: "Duplicate Order Flagged", message: "A duplicate order has been detected for Ansan Baniya", type: "duplicate_flagged", relatedId: insertedOrders[6].id, isRead: false },
    { userId: riderUsers[0].id, title: "New Order Assigned", message: `Order ${insertedOrders[2].orderCode} has been assigned to you`, type: "order_assigned", relatedId: insertedOrders[2].id, isRead: false },
  ]);

  console.log("Seed completed successfully!");
  console.log("\nDemo Credentials:");
  console.log("Admin:   admin@swiftship.com / Admin@123");
  console.log("Manager: manager@swiftship.com / Manager@123");
  console.log("Vendor1: vendor1@swiftship.com / Vendor@123");
  console.log("Vendor2: vendor2@swiftship.com / Vendor@123");
  console.log("Rider1:  rider1@swiftship.com / Rider@123");
  console.log("Rider2:  rider2@swiftship.com / Rider@123");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); });
