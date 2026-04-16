"use client";

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
  { id: "sheet", label: "Character Sheet" },
];

export default function TopBar({
  characterName,
  activeTab,
  onTabChange,
  onSettingsOpen,
  onMenuOpen,
}: TopBarProps) {
  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      {/* Left: Hamburger + Character name + tabs */}
      <div className="flex items-center gap-6 overflow-x-auto min-w-0">
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

      {/* Right: Settings */}
      <button
        onClick={onSettingsOpen}
        className="text-muted hover:text-accent transition-colors p-2 rounded hover:bg-bg/50 shrink-0"
        title="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  );
}
