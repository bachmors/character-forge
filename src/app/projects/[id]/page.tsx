"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface CharacterStat {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  last_image_url: string | null;
  image_count: number;
  ages: number[];
}

interface Project {
  _id: string;
  name: string;
  description: string;
  type: string;
  cover_image: string;
  character_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch("/api/characters/stats"),
      ]);
      if (!pRes.ok) throw new Error("Could not load project");
      const p = await pRes.json();
      const c = cRes.ok ? await cRes.json() : [];
      setProject(p);
      setAllCharacters(Array.isArray(c) ? c : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const projectCharacters = useMemo(() => {
    if (!project) return [];
    const set = new Set(project.character_ids);
    return allCharacters.filter((c) => set.has(c._id));
  }, [project, allCharacters]);

  const totalGenerations = useMemo(
    () => projectCharacters.reduce((acc, c) => acc + (c.image_count || 0), 0),
    [projectCharacters],
  );
  const allAges = useMemo(() => {
    const set = new Set<number>();
    for (const c of projectCharacters) for (const a of c.ages || []) set.add(a);
    return Array.from(set).sort((a, b) => a - b);
  }, [projectCharacters]);

  const updateCharacterIds = async (next: string[]) => {
    if (!project) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_ids: next }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProject(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  const removeCharacter = (charId: string) => {
    if (!project) return;
    updateCharacterIds(project.character_ids.filter((id) => id !== charId));
  };
  const addCharacter = (charId: string) => {
    if (!project) return;
    if (project.character_ids.includes(charId)) return;
    updateCharacterIds([...project.character_ids, charId]);
  };
  const setCover = (src: string) => {
    if (!project) return;
    fetch(`/api/projects/${project._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_image: src }),
    }).then(async (res) => {
      if (res.ok) {
        const updated = await res.json();
        setProject(updated);
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-muted animate-pulse-glow">Loading project…</div>
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-danger text-sm">{error || "Project not found"}</div>
      </div>
    );
  }

  const charactersAvailableToAdd = allCharacters.filter(
    (c) => !project.character_ids.includes(c._id),
  );

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link href="/projects" className="text-muted hover:text-text transition-colors text-sm shrink-0">
            ← Projects
          </Link>
          <h1 className="font-serif text-accent text-lg md:text-xl font-semibold tracking-wide truncate">
            {project.name}
          </h1>
          <span className="text-[10px] uppercase tracking-wide text-muted/70 shrink-0">
            {project.type}
          </span>
          <a
            href={`/projects/${project._id}/bible`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto px-3 py-1.5 rounded-lg border border-accent/30 text-accent text-sm hover:bg-accent/10 transition-colors"
            title="Open the printable project bible"
          >
            Export Bible
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        {/* Cover + description */}
        <section className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-72 aspect-video rounded-lg border border-border bg-bg overflow-hidden shrink-0">
            {project.cover_image ? (
              <img src={project.cover_image} alt={project.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted/40 font-serif text-3xl">
                {project.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {project.description && (
              <p className="text-text/90 leading-relaxed">{project.description}</p>
            )}
            <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-muted/70 uppercase tracking-wide">Characters</dt>
                <dd className="text-accent text-base mt-0.5">{projectCharacters.length}</dd>
              </div>
              <div>
                <dt className="text-muted/70 uppercase tracking-wide">Total generations</dt>
                <dd className="text-accent text-base mt-0.5">{totalGenerations}</dd>
              </div>
              {allAges.length > 0 && (
                <div>
                  <dt className="text-muted/70 uppercase tracking-wide">Age range</dt>
                  <dd className="text-accent text-base mt-0.5">
                    {allAges[0] === allAges[allAges.length - 1]
                      ? `${allAges[0]}`
                      : `${allAges[0]}–${allAges[allAges.length - 1]}`}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        {/* Characters in project */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-serif text-accent text-lg font-semibold">
              Characters
              <span className="ml-2 text-xs text-muted">{projectCharacters.length}</span>
              {saving && <span className="ml-2 text-xs text-muted italic">saving…</span>}
            </h2>
            <button
              onClick={() => setShowAddPicker((v) => !v)}
              disabled={charactersAvailableToAdd.length === 0}
              className="px-3 py-1.5 rounded-lg border border-accent/30 text-accent text-sm hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {showAddPicker ? "Cancel" : "+ Add character"}
            </button>
          </div>

          {showAddPicker && charactersAvailableToAdd.length > 0 && (
            <div className="border border-accent/30 bg-accent/5 rounded-lg p-3">
              <p className="text-xs text-muted mb-2">Pick characters to add to this project:</p>
              <div className="flex flex-wrap gap-2">
                {charactersAvailableToAdd.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => addCharacter(c._id)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg border border-border bg-surface hover:border-accent/40 transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-bg border border-border overflow-hidden">
                      {c.base_image_url || c.last_image_url ? (
                        <img
                          src={c.base_image_url || c.last_image_url || ""}
                          alt={c.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-muted">{c.name.charAt(0)}</span>
                      )}
                    </div>
                    <span className="text-xs text-text">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {projectCharacters.length === 0 ? (
            <p className="text-muted text-sm italic">
              No characters in this project yet. Click + Add character above.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {projectCharacters.map((c) => {
                const thumb = c.last_image_url || c.base_image_url;
                return (
                  <div
                    key={c._id}
                    className="border border-border rounded-lg bg-surface overflow-hidden group"
                  >
                    <Link href={`/?characterId=${c._id}`}>
                      <div className="aspect-square bg-bg overflow-hidden cursor-pointer">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={c.name}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted/40 font-serif text-3xl">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/?characterId=${c._id}`}
                          className="text-text font-medium truncate hover:text-accent transition-colors"
                        >
                          {c.name}
                        </Link>
                        <span className="text-muted shrink-0">{c.image_count}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                        <button
                          onClick={() => removeCharacter(c._id)}
                          className="hover:text-danger transition-colors"
                        >
                          Remove
                        </button>
                        {thumb && (
                          <button
                            onClick={() => setCover(thumb)}
                            className="hover:text-text transition-colors"
                            title="Use as project cover"
                          >
                            Set cover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
