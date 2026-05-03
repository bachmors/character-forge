"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import DatasetGrid from "./components/DatasetGrid";
import GeneratePanel from "./components/GeneratePanel";
import CharacterSheet from "./components/CharacterSheet";
import RelationshipsPanel from "./components/RelationshipsPanel";
import PsychologyPanel from "./components/PsychologyPanel";
import StoryPanel from "./components/StoryPanel";
import MoodBoardPanel from "./components/MoodBoardPanel";
import type { CharacterProfile } from "@/lib/profile";
import CreateCharacterModal from "./components/CreateCharacterModal";
import ImageModal from "./components/ImageModal";
import SettingsModal from "./components/SettingsModal";
import Lightbox from "./components/Lightbox";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
  profile?: CharacterProfile;
}

interface CharacterImage {
  _id: string;
  character_id: string;
  category: string;
  subcategory: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  selected: boolean;
  favorite: boolean;
  rating?: number;
  created_at: string;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const initialCharacterId = searchParams?.get("characterId") || null;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [images, setImages] = useState<CharacterImage[]>([]);
  const [activeTab, setActiveTab] = useState("dataset");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [viewingImage, setViewingImage] = useState<CharacterImage | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [createFromImage, setCreateFromImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedCharacter = characters.find((c) => c._id === selectedCharacterId) || null;

  // If the URL carries ?characterId=X (e.g. arriving from Gallery), pre-select
  // that character once the list has loaded. Runs once when characters arrive.
  useEffect(() => {
    if (
      initialCharacterId &&
      !selectedCharacterId &&
      characters.some((c) => c._id === initialCharacterId)
    ) {
      setSelectedCharacterId(initialCharacterId);
      setActiveTab("dataset");
    }
  }, [initialCharacterId, selectedCharacterId, characters]);

  // Fetch characters
  const fetchCharacters = useCallback(async () => {
    try {
      const res = await fetch("/api/characters");
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
      }
    } catch (err) {
      console.error("Failed to fetch characters:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch images for selected character
  const fetchImages = useCallback(async () => {
    if (!selectedCharacterId) {
      setImages([]);
      return;
    }
    try {
      const res = await fetch(`/api/images?characterId=${selectedCharacterId}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (err) {
      console.error("Failed to fetch images:", err);
    }
  }, [selectedCharacterId]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Create character
  const handleCreateCharacter = async (data: {
    name: string;
    description: string;
    base_image_url: string;
    traits: Record<string, string>;
  }) => {
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newChar = await res.json();
        setCharacters((prev) => [newChar, ...prev]);
        setSelectedCharacterId(newChar._id);
        setShowCreateModal(false);
        setActiveTab("sheet");
      }
    } catch (err) {
      console.error("Failed to create character:", err);
    }
  };

  // Update character
  const handleUpdateCharacter = (updated: Character) => {
    setCharacters((prev) =>
      prev.map((c) => (c._id === updated._id ? updated : c))
    );
  };

  // Toggle image selected
  const handleToggleSelect = async (imageId: string, selected: boolean) => {
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected }),
      });
      if (res.ok) {
        setImages((prev) =>
          prev.map((img) => (img._id === imageId ? { ...img, selected } : img))
        );
      }
    } catch (err) {
      console.error("Failed to update image:", err);
    }
  };

  // Toggle image favorite (only one favorite per pose type)
  const handleToggleFavorite = async (imageId: string, favorite: boolean) => {
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite }),
      });
      if (res.ok) {
        setImages((prev) => {
          const target = prev.find((img) => img._id === imageId);
          return prev.map((img) => {
            if (img._id === imageId) return { ...img, favorite };
            // Unset favorite for other images in same pose type
            if (
              favorite &&
              target &&
              img.category === target.category &&
              img.subcategory === target.subcategory
            ) {
              return { ...img, favorite: false };
            }
            return img;
          });
        });
      }
    } catch (err) {
      console.error("Failed to update image:", err);
    }
  };

  // Set image rating (0–5)
  const handleSetRating = async (imageId: string, rating: number) => {
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        setImages((prev) =>
          prev.map((img) => (img._id === imageId ? { ...img, rating } : img)),
        );
      }
    } catch (err) {
      console.error("Failed to set rating:", err);
    }
  };

  // Delete image
  const handleDeleteImage = async (imageId: string) => {
    try {
      const res = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      if (res.ok) {
        setImages((prev) => prev.filter((img) => img._id !== imageId));
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        characters={characters}
        selectedId={selectedCharacterId}
        onSelect={(id) => {
          setSelectedCharacterId(id);
          setActiveTab("dataset");
        }}
        onCreateNew={() => { setCreateFromImage(false); setShowCreateModal(true); }}
        onCreateFromImage={() => { setCreateFromImage(true); setShowCreateModal(true); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          characterName={selectedCharacter?.name || null}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSettingsOpen={() => setShowSettingsModal(true)}
          onMenuOpen={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted animate-pulse-glow">Loading...</div>
            </div>
          ) : !selectedCharacter ? (
            /* Welcome screen */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <h2 className="font-serif text-accent text-2xl font-semibold mb-3">
                  Character Forge
                </h2>
                <p className="text-muted text-sm mb-6 leading-relaxed">
                  Create consistent AI character datasets for video generation.
                  Manage poses, expressions, and body shots — all from one place.
                </p>
                {characters.length === 0 ? (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-accent text-bg px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors"
                  >
                    Create Your First Character
                  </button>
                ) : (
                  <p className="text-muted/60 text-xs">
                    Select a character from the sidebar to get started
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Character view */
            <>
              {activeTab === "dataset" && (
                <DatasetGrid
                  images={images}
                  characterName={selectedCharacter.name}
                  baseImageUrl={selectedCharacter.base_image_url}
                  onImageClick={setViewingImage}
                  onLightboxOpen={setLightboxSrc}
                  onToggleSelect={handleToggleSelect}
                  onToggleFavorite={handleToggleFavorite}
                  onSetRating={handleSetRating}
                  onDeleteImage={handleDeleteImage}
                />
              )}
              {activeTab === "generate" && (
                <GeneratePanel
                  character={selectedCharacter}
                  images={images}
                  onImageGenerated={fetchImages}
                  onLightboxOpen={setLightboxSrc}
                />
              )}
              {activeTab === "sheet" && (
                <CharacterSheet
                  character={selectedCharacter}
                  onUpdate={handleUpdateCharacter}
                  onLightboxOpen={setLightboxSrc}
                />
              )}
              {activeTab === "psychology" && (
                <PsychologyPanel
                  character={selectedCharacter}
                  onUpdate={handleUpdateCharacter}
                />
              )}
              {activeTab === "story" && (
                <StoryPanel
                  character={selectedCharacter}
                  onUpdate={handleUpdateCharacter}
                />
              )}
              {activeTab === "moodboard" && (
                <MoodBoardPanel
                  character={selectedCharacter}
                  onUpdate={handleUpdateCharacter}
                  onLightboxOpen={setLightboxSrc}
                />
              )}
              {activeTab === "relationships" && (
                <RelationshipsPanel
                  character={selectedCharacter}
                  allCharacters={characters}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateCharacterModal
        open={showCreateModal}
        fromImage={createFromImage}
        onClose={() => { setShowCreateModal(false); setCreateFromImage(false); }}
        onCreate={handleCreateCharacter}
      />
      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      <ImageModal
        image={viewingImage}
        characterName={selectedCharacter?.name || "character"}
        baseImageUrl={selectedCharacter?.base_image_url}
        onClose={() => setViewingImage(null)}
        onImageSaved={fetchImages}
      />
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
