"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthGate";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initial = user.email.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center text-accent text-xs font-medium hover:bg-accent/25 transition-colors"
        title={user.email}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-lg shadow-xl z-50 animate-fade-in overflow-hidden">
          <div className="p-3 border-b border-border">
            <p className="text-sm text-text truncate">{user.email}</p>
            {user.role === "owner" && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold">
                Owner
              </span>
            )}
          </div>
          <div className="p-1">
            <button
              onClick={async () => {
                setOpen(false);
                await logout();
              }}
              className="w-full text-left px-3 py-2 rounded text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
