import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
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

export default router;
