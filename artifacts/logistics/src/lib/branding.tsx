import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface Branding {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const DEFAULT_BRANDING: Branding = {
  companyName: "SwiftShip",
  primaryColor: "#dc2626",
  secondaryColor: "#f3f4f6",
  logoUrl: null,
  faviconUrl: null,
};

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyBranding(b: Branding) {
  const root = document.documentElement;

  if (b.primaryColor && /^#[0-9a-fA-F]{6}$/.test(b.primaryColor)) {
    const hsl = hexToHsl(b.primaryColor);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
  }

  if (b.secondaryColor && /^#[0-9a-fA-F]{6}$/.test(b.secondaryColor)) {
    const hsl = hexToHsl(b.secondaryColor);
    root.style.setProperty("--secondary", hsl);
    root.style.setProperty("--muted", hsl);
    root.style.setProperty("--accent", hsl);
  }

  if (b.companyName) {
    document.title = b.companyName;
  }

  if (b.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = b.faviconUrl;
  }
}

const BrandingContext = createContext<{
  branding: Branding;
  setBranding: (b: Branding) => void;
}>({ branding: DEFAULT_BRANDING, setBranding: () => {} });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBrandingState] = useState<Branding>(DEFAULT_BRANDING);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    fetch(`${base}/api/settings/branding`)
      .then((r) => r.json())
      .then((data: Branding) => {
        setBrandingState(data);
        applyBranding(data);
      })
      .catch(() => {});
  }, []);

  const setBranding = (b: Branding) => {
    setBrandingState(b);
    applyBranding(b);
  };

  return (
    <BrandingContext.Provider value={{ branding, setBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
