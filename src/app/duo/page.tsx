"use client";

import MultiSceneBuilder from "../components/MultiSceneBuilder";

export default function DuoPage() {
  return (
    <MultiSceneBuilder
      mode="duo"
      min={2}
      max={2}
      title="Duo Scene"
      blurb="Generate a single image with two of your characters together."
    />
  );
}
