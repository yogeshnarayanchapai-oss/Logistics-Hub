import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "swiftship_salt").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function createToken(userId: number, role: string): string {
  const payload = { userId, role, iat: Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function parseToken(token: string): { userId: number; role: string } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const parsed = parseToken(token);
  if (!parsed) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  (req as any).userId = parsed.userId;
  (req as any).userRole = parsed.role;
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userRole = (req as any).userRole;
    if (!roles.includes(userRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
