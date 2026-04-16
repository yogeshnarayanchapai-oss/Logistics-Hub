import { createContext, useContext, useState, useEffect } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

// Ensure custom fetch uses our local storage token
setAuthTokenGetter(() => localStorage.getItem("authToken"));

export function getRoleHome(role: string): string {
  if (role === "vendor") return "/vendor/dashboard";
  if (role === "rider") return "/rider/dashboard";
  return "/admin/dashboard";
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("authToken"));
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  // After login, once user is loaded, redirect to their role-based home
  useEffect(() => {
    if (user && pendingRedirect) {
      setLocation(getRoleHome(user.role));
      setPendingRedirect(false);
    }
  }, [user, pendingRedirect]);

  const login = (newToken: string) => {
    localStorage.setItem("authToken", newToken);
    setToken(newToken);
    setPendingRedirect(true);
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
    queryClient.clear();
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading: !!token && isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
