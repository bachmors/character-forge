"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  _id: string;
  name: string;
  description: string;
  type: string;
  cover_image: string;
  character_ids: string[];
  updated_at?: string;
}

const PROJECT_TYPES = ["Short Film", "Feature", "Series", "Commercial", "Personal"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Personal");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error("Could not load projects");
        const data = await res.json();
        if (!cancelled) setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create");
        return;
      }
      setProjects((prev) => [data, ...prev]);
      setName("");
      setDescription("");
      setType("Personal");
      setShowForm(false);
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project? Characters won't be deleted, only the grouping.")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) setProjects((prev) => prev.filter((p) => p._id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link href="/" className="text-muted hover:text-text transition-colors text-sm shrink-0">
            ← Workspace
          </Link>
          <h1 className="font-serif text-accent text-lg md:text-xl font-semibold tracking-wide">
            Projects
          </h1>
          <span className="text-xs text-muted">{projects.length}</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors"
          >
            {showForm ? "Cancel" : "+ New project"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="border border-border rounded-lg bg-surface p-4 space-y-3"
          >
            <h2 className="text-sm text-accent font-medium">New project</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="PUSH, Short Film 2, Campaign X…"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create project"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="py-16 text-center text-muted animate-pulse-glow">Loading…</div>
        ) : error ? (
          <div className="py-16 text-center text-danger text-sm">{error}</div>
        ) : projects.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            No projects yet. Create one to group characters by film, series, or campaign.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p._id}
                href={`/projects/${p._id}`}
                className="border border-border rounded-lg bg-surface overflow-hidden hover:border-accent/40 transition-colors group"
              >
                <div className="aspect-video bg-bg overflow-hidden">
                  {p.cover_image ? (
                    <img src={p.cover_image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted/40 font-serif text-2xl">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-text truncate group-hover:text-accent transition-colors">
                      {p.name}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wide text-muted/70 shrink-0">
                      {p.type}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                    <span>
                      {p.character_ids?.length || 0} character
                      {(p.character_ids?.length || 0) === 1 ? "" : "s"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(p._id);
                      }}
                      className="text-muted hover:text-danger transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
