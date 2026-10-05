"use client";

import { useState } from "react";
import GenerationCard, { type Gen } from "./GenerationCard";

export default function GalleryGrid({ initial }: { initial: Gen[] }) {
  const [gens, setGens] = useState(initial);
  const [onlyKept, setOnlyKept] = useState(false);
  const shown = onlyKept ? gens.filter((g) => g.kept) : gens;
  return (
    <main className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Galerie de l&apos;équipe</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-white/60">
          <input type="checkbox" checked={onlyKept} onChange={(e) => setOnlyKept(e.target.checked)} />
          Gardés uniquement
        </label>
      </div>
      <p className="mb-4 text-xs text-white/40">Les médias non gardés expirent chez Kie après ~24h.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((g) => (
          <GenerationCard
            key={g.id}
            gen={g}
            onChange={(n) => setGens((c) => c.map((x) => (x.id === n.id ? { ...x, ...n } : x)))}
            onDelete={(id) => setGens((c) => c.filter((x) => x.id !== id))}
          />
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-white/40">Rien pour le moment.</p>}
    </main>
  );
}
