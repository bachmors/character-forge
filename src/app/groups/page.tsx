"use client";

import MultiSceneBuilder from "../components/MultiSceneBuilder";

export default function GroupsPage() {
  return (
    <MultiSceneBuilder
      mode="group"
      min={3}
      max={6}
      title="Group Scene"
      blurb="Generate a single image with 3–6 of your characters together."
    />
  );
}
