import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, stationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

router.get("/settings/branding", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "branding"));

  if (rows.length === 0) {
    res.json({
      companyName: "SwiftShip",
      primaryColor: "#dc2626",
      secondaryColor: "#f3f4f6",
      logoUrl: null,
      faviconUrl: null,
    });
    return;
  }

  try {
    const parsed = JSON.parse(rows[0].value);
    res.json(parsed);
  } catch {
    res.json({
      companyName: "SwiftShip",
      primaryColor: "#dc2626",
      secondaryColor: "#f3f4f6",
      logoUrl: null,
      faviconUrl: null,
    });
  }
});

router.put("/settings/branding", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { companyName, primaryColor, secondaryColor, logoUrl, faviconUrl } = req.body;

  const value = JSON.stringify({
    companyName: companyName ?? "SwiftShip",
    primaryColor: primaryColor ?? "#dc2626",
    secondaryColor: secondaryColor ?? "#f3f4f6",
    logoUrl: logoUrl ?? null,
    faviconUrl: faviconUrl ?? null,
  });

  await db
    .insert(appSettingsTable)
    .values({ key: "branding", value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });

  res.json({ success: true });
});

const GENERAL_DEFAULTS = {
  companyName: "SwiftShip Logistics",
  supportEmail: "support@swiftship.com",
  autoAssign: true,
  strictDuplicateCheck: true,
  rateMode: "default" as "default" | "custom",
  defaultDeliveryCharge: 100,
};

router.get("/settings/general", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "general"));
  if (rows.length === 0) { res.json(GENERAL_DEFAULTS); return; }
  try { res.json({ ...GENERAL_DEFAULTS, ...JSON.parse(rows[0].value) }); }
  catch { res.json(GENERAL_DEFAULTS); }
});

router.put("/settings/general", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const companyName = (req.body.companyName as string | undefined)?.trim() || "SwiftShip Logistics";
  const supportEmail = (req.body.supportEmail as string | undefined)?.trim() || "support@swiftship.com";
  const autoAssign = req.body.autoAssign !== false;
  const strictDuplicateCheck = req.body.strictDuplicateCheck !== false;
  const rateMode: "default" | "custom" = req.body.rateMode === "custom" ? "custom" : "default";
  const defaultDeliveryCharge = Math.max(0, Number(req.body.defaultDeliveryCharge ?? 100));

  const value = JSON.stringify({ companyName, supportEmail, autoAssign, strictDuplicateCheck, rateMode, defaultDeliveryCharge });
  await db.insert(appSettingsTable).values({ key: "general", value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });

  if (rateMode === "default") {
    await db.update(stationsTable).set({ deliveryCharge: defaultDeliveryCharge });
  }

  res.json({ success: true, companyName, supportEmail, autoAssign, strictDuplicateCheck, rateMode, defaultDeliveryCharge });
});

export default router;
