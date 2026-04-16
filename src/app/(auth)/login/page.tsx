"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // First-time setup state
  const [showSetup, setShowSetup] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [setupPassword, setSetupPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = activeTab === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/first-time-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode, password: setupPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-accent text-2xl font-semibold tracking-wide">
            Character Forge
          </h1>
          <p className="text-muted text-xs mt-1">AI Character Dataset Manager</p>
        </div>

        {!showSetup ? (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1">
              <button
                onClick={() => { setActiveTab("login"); setError(null); }}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === "login"
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-text"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => { setActiveTab("register"); setError(null); }}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === "register"
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-text"
                }`}
              >
                Register
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={activeTab === "register" ? "Min 8 characters" : "Your password"}
                  required
                  minLength={activeTab === "register" ? 8 : undefined}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              </div>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {loading ? "..." : activeTab === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* First-time setup link */}
            <div className="mt-6 text-center">
              <button
                onClick={() => { setShowSetup(true); setError(null); }}
                className="text-xs text-muted/50 hover:text-muted transition-colors"
              >
                First time setup (owner)
              </button>
            </div>
          </>
        ) : (
          <>
            {/* First-time setup form */}
            <div className="mb-4">
              <h2 className="text-sm text-accent font-medium mb-1">Owner Setup</h2>
              <p className="text-xs text-muted">Enter the access code and choose your password.</p>
            </div>

            <form onSubmit={handleFirstTimeSetup} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Access Code</label>
                <input
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors font-mono"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">New Password</label>
                <input
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              </div>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Activate Account"}
              </button>

              <button
                type="button"
                onClick={() => { setShowSetup(false); setError(null); }}
                className="w-full py-2 rounded-lg border border-border text-muted hover:text-text text-sm transition-colors"
              >
                Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
