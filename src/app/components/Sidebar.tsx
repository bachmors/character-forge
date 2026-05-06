"use client";

import { useState, useRef } from "react";
import BuyMeCoffee from "./BuyMeCoffee";
import { type Collection, getCategoryInfo } from "./CollectionModal";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
}

interface SidebarProps {
  characters: Character[];
  collections: Collection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onCreateFromImage: () => void;
  onCreateCollection: () => void;
  onEditCollection: (collection: Collection) => void;
  onDeleteCollection: (collectionId: string) => void;
  onAddCharacterToCollection: (collectionId: string, characterId: string) => void;
  onRemoveCharacterFromCollection: (collectionId: string, characterId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  characters,
  collections,
  selectedId,
  onSelect,
  onCreateNew,
  onCreateFromImage,
  onCreateCollection,
  onEditCollection,
  onDeleteCollection,
  onAddCharacterToCollection,
  onRemoveCharacterFromCollection,
  isOpen,
  onClose,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"collections" | "all">("collections");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ collectionId: string; x: number; y: number } | null>(null);
  const [addPickerFor, setAddPickerFor] = useState<string | null>(null);
  const dragCharRef = useRef<{ charId: string; fromCollectionId: string | null } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const filtered = characters.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const allCollectionCharIds = new Set(collections.flatMap((col) => col.characterIds));
  const uncategorizedChars = filtered.filter((c) => !allCollectionCharIds.has(c._id));

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (charId: string, fromCollectionId: string | null) => {
    dragCharRef.current = { charId, fromCollectionId };
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverTarget(targetId);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDropOnCollection = (targetCollectionId: string) => {
    const drag = dragCharRef.current;
    if (!drag) return;
    onAddCharacterToCollection(targetCollectionId, drag.charId);
    setDragOverTarget(null);
    dragCharRef.current = null;
  };

  const handleDropOnUncategorized = () => {
    const drag = dragCharRef.current;
    if (!drag || !drag.fromCollectionId) return;
    onRemoveCharacterFromCollection(drag.fromCollectionId, drag.charId);
    setDragOverTarget(null);
    dragCharRef.current = null;
  };

  const CharacterButton = ({ char, collectionId }: { char: Character; collectionId: string | null }) => (
    <button
      draggable
      onDragStart={() => handleDragStart(char._id, collectionId)}
      onDragEnd={() => { setDragOverTarget(null); dragCharRef.current = null; }}
      onClick={() => { onSelect(char._id); onClose(); }}
      onContextMenu={(e) => {
        if (collectionId) {
          e.preventDefault();
          setContextMenu(null);
          setTimeout(() => {
            if (confirm(`Remove "${char.name}" from this collection?`)) {
              onRemoveCharacterFromCollection(collectionId, char._id);
            }
          }, 0);
        }
      }}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-all ${
        selectedId === char._id
          ? "bg-bg border border-border-strong"
          : "hover:bg-bg/50 border border-transparent"
      }`}
    >
      <div className="w-8 h-8 rounded-md bg-bg border border-border shrink-0 overflow-hidden">
        {char.base_image_url ? (
          <img src={char.base_image_url} alt={char.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">
            {char.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${selectedId === char._id ? "text-accent" : "text-text"}`}>
          {char.name}
        </p>
      </div>
    </button>
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`
          fixed md:relative top-0 left-0
          w-sidebar h-screen flex flex-col
          bg-surface border-r border-border overflow-hidden shrink-0
          z-50 transition-transform duration-200 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="font-serif text-accent text-xl font-semibold tracking-wide">Character Forge</h1>
          <p className="text-muted text-xs mt-0.5">AI Character Dataset Manager</p>
        </div>

        {/* View Toggle + Search */}
        <div className="px-3 pt-2 pb-1 space-y-2">
          <div className="flex items-center gap-1 bg-bg rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("collections")}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "collections" ? "bg-surface text-accent" : "text-muted hover:text-text"
              }`}
            >
              Collections
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "all" ? "bg-surface text-accent" : "text-muted hover:text-text"
              }`}
            >
              All Characters
            </button>
          </div>
          <input
            type="text"
            placeholder="Search characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-border-strong transition-colors"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {viewMode === "all" ? (
            <>
              {filtered.length === 0 && (
                <p className="text-muted text-xs text-center py-8">
                  {characters.length === 0 ? "No characters yet" : "No results"}
                </p>
              )}
              {filtered.map((char) => (
                <CharacterButton key={char._id} char={char} collectionId={null} />
              ))}
            </>
          ) : (
            <>
              {/* Collections header */}
              <div className="flex items-center justify-between px-1 py-1.5">
                <span className="text-xs text-muted font-medium uppercase tracking-wider">Collections</span>
                <button
                  onClick={onCreateCollection}
                  className="w-5 h-5 rounded flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                  title="New Collection"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {collections.length === 0 && uncategorizedChars.length === 0 && filtered.length === 0 && (
                <p className="text-muted text-xs text-center py-8">No collections yet</p>
              )}

              {collections.map((col) => {
                const catInfo = getCategoryInfo(col.category);
                const isCollapsed = collapsed[col._id];
                const colChars = (col.characterIds || [])
                  .map((cid) => filtered.find((c) => c._id === cid))
                  .filter(Boolean) as Character[];
                const isDragOver = dragOverTarget === col._id;

                return (
                  <div key={col._id} className="mb-1">
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                        isDragOver ? "bg-accent/10 border border-accent/30" : "hover:bg-bg/50 border border-transparent"
                      }`}
                      onClick={() => toggleCollapse(col._id)}
                      onDragOver={(e) => handleDragOver(e, col._id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => { e.preventDefault(); handleDropOnCollection(col._id); }}
                    >
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`shrink-0 text-muted transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-text truncate">{col.name}</span>
                          <span
                            className="shrink-0 px-1.5 py-0 rounded text-[9px] font-medium"
                            style={{ backgroundColor: catInfo.color + "20", color: catInfo.color }}
                          >
                            {catInfo.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted">{colChars.length} character{colChars.length !== 1 ? "s" : ""}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setContextMenu({ collectionId: col._id, x: rect.left, y: rect.bottom });
                        }}
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-text hover:bg-bg transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                    </div>

                    {!isCollapsed && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {colChars.length === 0 ? (
                          <p className="text-muted/50 text-[10px] px-2 py-2 italic">Drag characters here or click + to add</p>
                        ) : (
                          colChars.map((char) => (
                            <CharacterButton key={char._id} char={char} collectionId={col._id} />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Uncategorized */}
              {uncategorizedChars.length > 0 && (
                <div className="mt-2">
                  <div
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                      dragOverTarget === "uncategorized" ? "bg-accent/10" : ""
                    }`}
                    onDragOver={(e) => handleDragOver(e, "uncategorized")}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => { e.preventDefault(); handleDropOnUncategorized(); }}
                  >
                    <div className="flex-1 border-t border-border" />
                    <span className="text-[10px] text-muted/60 shrink-0">Uncategorized</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {uncategorizedChars.map((char) => (
                      <CharacterButton key={char._id} char={char} collectionId={null} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <div
              className="fixed z-50 bg-surface border border-border-strong rounded-lg shadow-lg py-1 w-44 animate-fade-in"
              style={{ left: Math.min(contextMenu.x, 200), top: contextMenu.y + 4 }}
            >
              <button onClick={() => { const col = collections.find((c) => c._id === contextMenu.collectionId); if (col) onEditCollection(col); setContextMenu(null); }}
                className="w-full px-3 py-1.5 text-left text-sm text-text hover:bg-bg/50 transition-colors">Edit Collection</button>
              <button onClick={() => { setAddPickerFor(contextMenu.collectionId); setContextMenu(null); }}
                className="w-full px-3 py-1.5 text-left text-sm text-text hover:bg-bg/50 transition-colors">Add Character</button>
              <button onClick={() => { if (confirm("Delete this collection? Characters will NOT be deleted.")) { onDeleteCollection(contextMenu.collectionId); } setContextMenu(null); }}
                className="w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger/10 transition-colors">Delete Collection</button>
            </div>
          </>
        )}

        {/* Add Character Picker */}
        {addPickerFor && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setAddPickerFor(null)} />
            <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-border-strong rounded-xl w-72 max-h-80 overflow-y-auto animate-fade-in">
              <div className="p-3 border-b border-border"><h3 className="text-sm text-accent font-medium">Add Character</h3></div>
              <div className="p-2">
                {(() => {
                  const col = collections.find((c) => c._id === addPickerFor);
                  const available = characters.filter((c) => !col?.characterIds.includes(c._id));
                  if (available.length === 0) return <p className="text-xs text-muted p-2">All characters already in this collection</p>;
                  return available.map((char) => (
                    <button key={char._id} onClick={() => { onAddCharacterToCollection(addPickerFor, char._id); setAddPickerFor(null); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-bg/50 transition-colors">
                      <div className="w-7 h-7 rounded-md bg-bg border border-border shrink-0 overflow-hidden">
                        {char.base_image_url ? <img src={char.base_image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted text-xs">{char.name.charAt(0)}</div>}
                      </div>
                      <span className="text-sm text-text truncate">{char.name}</span>
                    </button>
                  ));
                })()}
              </div>
            </div>
          </>
        )}

        {/* Create Buttons */}
        <div className="p-3 border-t border-border space-y-2">
          <BuyMeCoffee />
          <button onClick={() => { onCreateNew(); onClose(); }} className="w-full bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg py-2 text-sm font-medium transition-colors">+ New Character</button>
          <button onClick={() => { onCreateFromImage(); onClose(); }} className="w-full hover:bg-bg/50 text-muted hover:text-text border border-border rounded-lg py-2 text-xs transition-colors">Create from Image</button>
        </div>
      </aside>
    </>
  );
}
