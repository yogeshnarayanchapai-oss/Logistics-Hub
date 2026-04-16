import { useAuth } from "@/lib/auth";

export function useRolePrefix(): string {
  const { user } = useAuth();
  if (!user) return "/admin";
  if (user.role === "vendor") return "/vendor";
  if (user.role === "rider") return "/rider";
  return "/admin";
}
