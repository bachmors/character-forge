"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import UserMenu from "./UserMenu";

interface TopBarProps {
  characterName: string | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsOpen: () => void;
  onMenuOpen: () => void;
}

const TABS = [
  { id: "dataset", label: "Dataset" },
  { id: "generate", label: "Generate" },
  { id: "sheet", label: "Sheet" },
  { id: "psychology", label: "Psychology" },
  { id: "story", label: "Story" },
  { id: "moodboard", label: "Mood Board" },
  { id: "relationships", label: "Relationships" },
];

export default function TopBar({
  characterName,
  activeTab,
  onTabChange,
  onSettingsOpen,
  onMenuOpen,
}: TopBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      // Show fade when there's overflow and we're not scrolled to the end.
      const hasOverflow = el.scrollWidth > el.clientWidth;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setShowRightFade(hasOverflow && !atEnd);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [characterName]);

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      {/* Left: Hamburger + Character name + tabs (with right-edge fade hint) */}
      <div className="relative flex-1 min-w-0 flex items-center">
        <div
          ref={scrollRef}
          className="flex items-center gap-6 overflow-x-auto min-w-0 w-full scrollbar-none"
        >
          <button
            onClick={onMenuOpen}
            className="md:hidden text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50 mr-2 shrink-0"
            title="Menu"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {characterName && (
            <h2 className="font-serif text-accent text-lg font-semibold shrink-0">{characterName}</h2>
          )}

          {characterName && (
            <nav className="flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-muted hover:text-text hover:bg-bg/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Right-edge fade hint when there's more content to scroll to */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute right-0 top-0 h-full w-10 transition-opacity duration-200 ${
            showRightFade ? "opacity-70" : "opacity-0"
          }`}
          style={{
            background: "linear-gradient(to right, transparent, var(--surface))",
          }}
        />
      </div>

      {/* Right: Gallery link + User menu + Settings */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <Link
          href="/projects"
          className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50"
          title="Projects"
          aria-label="Open projects"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </Link>
        <Link
          href="/gallery"
          className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50"
          title="Gallery"
          aria-label="Open gallery"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </Link>
        <Link
          href="/relationships"
          className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50"
          title="Relationships map"
          aria-label="Open relationships map"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="12" cy="18" r="2.5" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="7" y1="8" x2="11" y2="16" />
            <line x1="17" y1="8" x2="13" y2="16" />
          </svg>
        </Link>
        <Link
          href="/duo"
          className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50"
          title="Duo scene generator"
          aria-label="Open duo scene generator"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="3" />
            <circle cx="15" cy="9" r="3" />
            <path d="M3 21v-1a5 5 0 0 1 5-5h2" />
            <path d="M21 21v-1a5 5 0 0 0-5-5h-2" />
          </svg>
        </Link>
        <Link
          href="/scenes"
          className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50"
          title="Scenes & storyboard"
          aria-label="Open scenes and storyboard"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <line x1="2" y1="14" x2="22" y2="14" />
            <line x1="6" y1="6" x2="6" y2="18" />
            <line x1="18" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
        <Link
          href="/groups"
          className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50"
          title="Group scene generator"
          aria-label="Open group scene generator"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </Link>
        <UserMenu />
        <button
          onClick={onSettingsOpen}
          className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
