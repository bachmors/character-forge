"use client";

import { useState } from "react";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
}

interface SidebarProps {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onCreateFromImage: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ characters, selectedId, onSelect, onCreateNew, onCreateFromImage, isOpen, onClose }: SidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = characters.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Overlay - solo móvil, solo cuando isOpen */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:relative
          top-0 left-0
          w-sidebar h-screen
          flex flex-col
          bg-surface border-r border-border
          overflow-hidden shrink-0
          z-50
          transition-transform duration-200 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="font-serif text-accent text-xl font-semibold tracking-wide">
            Character Forge
          </h1>
          <p className="text-muted text-xs mt-0.5">AI Character Dataset Manager</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <input
            type="text"
            placeholder="Search characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-border-strong transition-colors"
          />
        </div>

        {/* Character List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {filtered.length === 0 && (
            <p className="text-muted text-xs text-center py-8">
              {characters.length === 0 ? "No characters yet" : "No results"}
            </p>
          )}
          {filtered.map((char) => (
            <button
              key={char._id}
              onClick={() => {
                onSelect(char._id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 p-2 rounded-lg mb-1 text-left transition-all ${
                selectedId === char._id
                  ? "bg-bg border border-border-strong"
                  : "hover:bg-bg/50 border border-transparent"
              }`}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg bg-bg border border-border shrink-0 overflow-hidden">
                {char.base_image_url ? (
                  <img
                    src={char.base_image_url}
                    alt={char.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-lg">
                    {char.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Name */}
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    selectedId === char._id ? "text-accent" : "text-text"
                  }`}
                >
                  {char.name}
                </p>
                {char.description && (
                  <p className="text-xs text-muted truncate">{char.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Create Buttons */}
        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={() => {
              onCreateNew();
              onClose();
            }}
            className="w-full bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg py-2 text-sm font-medium transition-colors"
          >
            + New Character
          </button>
          <button
            onClick={() => {
              onCreateFromImage();
              onClose();
            }}
            className="w-full hover:bg-bg/50 text-muted hover:text-text border border-border rounded-lg py-2 text-xs transition-colors"
          >
            Create from Image
          </button>
        </div>
      </aside>
    </>
  );
}
