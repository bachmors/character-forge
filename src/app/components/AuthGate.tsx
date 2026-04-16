"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthUser {
  _id: string;
  email: string;
  role: "owner" | "user";
}

interface AuthContextType {
  user: AuthUser | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, logout: async () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else if (pathname !== "/login") {
          router.push("/login");
        }
      })
      .catch(() => {
        if (pathname !== "/login") router.push("/login");
      })
      .finally(() => setChecking(false));
  }, [pathname, router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-muted animate-pulse-glow">Loading...</div>
      </div>
    );
  }

  // On login page, render without requiring auth
  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!user) return null;

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
