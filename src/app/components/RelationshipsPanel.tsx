"use client";

import { useEffect, useMemo, useState } from "react";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
}

interface Relationship {
  _id: string;
  user_id: string;
  from_character_id: string;
  to_character_id: string;
  type: string;
  created_at: string;
}

interface Props {
  character: Character;
  allCharacters: Character[];
}

/**
 * Predefined relationship types. `directional` indicates whether the edge is
 * meaningfully one-way (e.g. parent → child). The relationships map page uses
 * this to decide whether to draw an arrowhead.
 */
export const RELATIONSHIP_TYPES = [
  { id: "Parent", directional: true },
  { id: "Child", directional: true },
  { id: "Sibling", directional: false },
  { id: "Partner", directional: false },
  { id: "Rival", directional: false },
  { id: "Mentor", directional: true },
  { id: "Friend", directional: false },
  { id: "Colleague", directional: false },
] as const;

export function isDirectional(type: string): boolean {
  return RELATIONSHIP_TYPES.find((t) => t.id === type)?.directional ?? false;
}

export default function RelationshipsPanel({ character, allCharacters }: Props) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [toCharacterId, setToCharacterId] = useState<string>("");
  const [type, setType] = useState<string>("Sibling");
  const [customType, setCustomType] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const fetchRelationships = async () => {
    try {
      const res = await fetch("/api/relationships");
      if (!res.ok) throw new Error("Could not load relationships");
      const data = await res.json();
      setRelationships(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelationships();
  }, []);

  // Edges where this character is on either side
  const myRelationships = useMemo(
    () =>
      relationships.filter(
        (r) =>
          r.from_character_id === character._id || r.to_character_id === character._id,
      ),
    [relationships, character._id],
  );

  const charById = useMemo(() => {
    const m = new Map<string, Character>();
    for (const c of allCharacters) m.set(c._id, c);
    return m;
  }, [allCharacters]);

  // Default the "to" picker to the first other character once data is ready.
  useEffect(() => {
    if (!toCharacterId) {
      const first = allCharacters.find((c) => c._id !== character._id);
      if (first) setToCharacterId(first._id);
    }
  }, [allCharacters, character._id, toCharacterId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const finalType = type === "__custom__" ? customType.trim() : type;
    if (!toCharacterId || !finalType) return;
    setAdding(true);
    try {
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_character_id: character._id,
          to_character_id: toCharacterId,
          type: finalType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add relationship");
        return;
      }
      setRelationships((prev) => [data, ...prev]);
      setCustomType("");
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this relationship?")) return;
    try {
      const res = await fetch(`/api/relationships/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRelationships((prev) => prev.filter((r) => r._id !== id));
      }
    } catch {
      // ignore
    }
  };

  const otherCharacters = allCharacters.filter((c) => c._id !== character._id);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h3 className="font-serif text-accent text-lg font-semibold">Relationships</h3>
        <a
          href="/relationships"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 text-sm font-medium transition-colors"
          title="Open visual relationship map"
        >
          View Map
        </a>
      </div>

      {/* Existing relationships */}
      <div className="mb-6">
        <h4 className="text-sm text-accent font-medium mb-3">
          Connected to{" "}
          <span className="text-muted text-xs">({myRelationships.length})</span>
        </h4>

        {loading ? (
          <p className="text-muted text-sm animate-pulse-glow">Loading...</p>
        ) : myRelationships.length === 0 ? (
          <p className="text-muted text-sm italic">
            No relationships yet. Add one below.
          </p>
        ) : (
          <ul className="space-y-2">
            {myRelationships.map((rel) => {
              const isFrom = rel.from_character_id === character._id;
              const otherId = isFrom ? rel.to_character_id : rel.from_character_id;
              const other = charById.get(otherId);
              const directional = isDirectional(rel.type);
              // For directional relationships, show direction relative to this
              // character: e.g. "Parent of Bob" vs "Child of Bob's parent record"
              const arrow = directional ? (isFrom ? "→" : "←") : "↔";
              return (
                <li
                  key={rel._id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-bg/40"
                >
                  <div className="w-10 h-10 rounded-lg bg-bg border border-border shrink-0 overflow-hidden">
                    {other?.base_image_url ? (
                      <img
                        src={other.base_image_url}
                        alt={other.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                        {other?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted text-xs">{arrow}</span>
                      <span className="text-accent font-medium">{rel.type}</span>
                    </div>
                    <p className="text-sm text-text truncate">
                      {other?.name || <span className="italic text-muted">unknown character</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(rel._id)}
                    className="text-muted hover:text-danger transition-colors p-1"
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add new */}
      <div className="border-t border-border pt-5">
        <h4 className="text-sm text-accent font-medium mb-3">Add a relationship</h4>

        {otherCharacters.length === 0 ? (
          <p className="text-xs text-muted italic">
            You need at least one other character to create a relationship.
          </p>
        ) : (
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1">
                {character.name} is…
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
              >
                {RELATIONSHIP_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id}
                  </option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {type === "__custom__" && (
                <input
                  type="text"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g. Sworn enemy"
                  maxLength={80}
                  required
                  className="mt-2 w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              )}
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">…of</label>
              <select
                value={toCharacterId}
                onChange={(e) => setToCharacterId(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
              >
                {otherCharacters.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-2 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={adding || !toCharacterId || (type === "__custom__" && !customType.trim())}
              className="w-full py-2 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? "Adding..." : "Add Relationship"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
