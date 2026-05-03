"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isDirectional } from "../components/RelationshipsPanel";

interface CharacterStat {
  _id: string;
  name: string;
  base_image_url: string;
  last_image_url: string | null;
}

interface Relationship {
  _id: string;
  from_character_id: string;
  to_character_id: string;
  type: string;
}

// Circular layout — fine for the small character counts this app produces
// (typically <30). Nodes are arranged on a circle starting from the top.
const VIEW_W = 1000;
const VIEW_H = 800;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;
const NODE_R = 36;

function nodePosition(index: number, total: number, radius: number) {
  if (total === 1) return { x: CENTER_X, y: CENTER_Y };
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y + radius * Math.sin(angle),
  };
}

export default function RelationshipsMapPage() {
  const [characters, setCharacters] = useState<CharacterStat[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, rRes] = await Promise.all([
          fetch("/api/characters/stats"),
          fetch("/api/relationships"),
        ]);
        if (!cRes.ok) throw new Error("Could not load characters");
        if (!rRes.ok) throw new Error("Could not load relationships");
        const c = await cRes.json();
        const r = await rRes.json();
        if (cancelled) return;
        setCharacters(Array.isArray(c) ? c : []);
        setRelationships(Array.isArray(r) ? r : []);
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

  // Compute layout positions for every character.
  const nodes = useMemo(() => {
    const total = characters.length;
    const radius = total <= 1 ? 0 : Math.min(VIEW_W, VIEW_H) * 0.34;
    return characters.map((c, i) => ({ ...c, ...nodePosition(i, total, radius) }));
  }, [characters]);

  const nodeById = useMemo(() => {
    const m = new Map<string, (typeof nodes)[number]>();
    for (const n of nodes) m.set(n._id, n);
    return m;
  }, [nodes]);

  // Drop edges that reference a character we can't render (deleted etc.).
  const edges = useMemo(
    () =>
      relationships.filter(
        (r) => nodeById.has(r.from_character_id) && nodeById.has(r.to_character_id),
      ),
    [relationships, nodeById],
  );

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Toolbar */}
      <header className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="text-muted hover:text-text transition-colors text-sm shrink-0"
          >
            ← Workspace
          </Link>
          <h1 className="font-serif text-accent text-lg md:text-xl font-semibold tracking-wide">
            Relationships
          </h1>
          <span className="text-xs text-muted">
            {characters.length} character{characters.length === 1 ? "" : "s"} ·{" "}
            {edges.length} link{edges.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-2 md:px-8 py-6">
        {loading ? (
          <div className="py-24 text-center text-muted animate-pulse-glow">
            Loading map…
          </div>
        ) : error ? (
          <div className="py-24 text-center text-danger text-sm">{error}</div>
        ) : characters.length < 2 ? (
          <div className="py-24 text-center text-muted text-sm">
            Need at least 2 characters to show a relationship map.
          </div>
        ) : edges.length === 0 ? (
          <div className="py-24 text-center text-muted text-sm">
            No relationships yet. Open a character&apos;s “Relationships” tab to add one.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full h-auto"
              role="img"
              aria-label="Character relationships map"
            >
              <defs>
                {/* Arrowhead for directional edges */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#c4a35a" />
                </marker>
                {/* Per-character circular avatar clip + pattern */}
                {nodes.map((n) => {
                  const src = n.last_image_url || n.base_image_url;
                  if (!src) return null;
                  return (
                    <pattern
                      key={`pat-${n._id}`}
                      id={`avatar-${n._id}`}
                      patternUnits="userSpaceOnUse"
                      x={n.x - NODE_R}
                      y={n.y - NODE_R}
                      width={NODE_R * 2}
                      height={NODE_R * 2}
                    >
                      <image
                        href={src}
                        x="0"
                        y="0"
                        width={NODE_R * 2}
                        height={NODE_R * 2}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </pattern>
                  );
                })}
              </defs>

              {/* Edges first so nodes paint on top */}
              {edges.map((e) => {
                const a = nodeById.get(e.from_character_id)!;
                const b = nodeById.get(e.to_character_id)!;
                // Trim line endpoints so the line doesn't visually enter the
                // node circles (and the arrow marker sits at the boundary).
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / len;
                const uy = dy / len;
                const x1 = a.x + ux * NODE_R;
                const y1 = a.y + uy * NODE_R;
                const x2 = b.x - ux * NODE_R;
                const y2 = b.y - uy * NODE_R;
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const directional = isDirectional(e.type);
                return (
                  <g key={e._id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#c4a35a"
                      strokeOpacity={0.4}
                      strokeWidth={1.5}
                      markerEnd={directional ? "url(#arrow)" : undefined}
                    />
                    {/* Label background */}
                    <rect
                      x={mx - e.type.length * 3.5 - 6}
                      y={my - 9}
                      width={e.type.length * 7 + 12}
                      height={18}
                      rx={4}
                      ry={4}
                      fill="#12121a"
                      stroke="#c4a35a"
                      strokeOpacity={0.25}
                    />
                    <text
                      x={mx}
                      y={my + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#c4a35a"
                      style={{ fontFamily: "var(--font-sans, sans-serif)" }}
                    >
                      {e.type}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((n) => {
                const src = n.last_image_url || n.base_image_url;
                return (
                  <g key={n._id}>
                    <Link href={`/?characterId=${n._id}`}>
                      <g style={{ cursor: "pointer" }}>
                        {/* Outer ring */}
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={NODE_R + 2}
                          fill="none"
                          stroke="#c4a35a"
                          strokeOpacity={0.4}
                          strokeWidth={1.5}
                        />
                        {/* Avatar */}
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={NODE_R}
                          fill={src ? `url(#avatar-${n._id})` : "#1a1a25"}
                          stroke="#c4a35a"
                          strokeOpacity={0.6}
                          strokeWidth={1.5}
                        />
                        {!src && (
                          <text
                            x={n.x}
                            y={n.y + 8}
                            textAnchor="middle"
                            fontSize="22"
                            fill="#c4a35a"
                            style={{ fontFamily: "var(--font-serif, serif)" }}
                          >
                            {n.name.charAt(0).toUpperCase()}
                          </text>
                        )}
                        {/* Name label */}
                        <text
                          x={n.x}
                          y={n.y + NODE_R + 18}
                          textAnchor="middle"
                          fontSize="14"
                          fill="#e8e4df"
                          style={{ fontFamily: "var(--font-sans, sans-serif)", fontWeight: 500 }}
                        >
                          {n.name}
                        </text>
                      </g>
                    </Link>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <p className="text-xs text-muted/60 text-center mt-4">
          Click a character to open it in the workspace.
        </p>
      </main>
    </div>
  );
}
