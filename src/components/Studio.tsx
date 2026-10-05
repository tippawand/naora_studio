"use client";

import { usd } from "@/lib/pricing";
import { useEffect, useMemo, useRef, useState } from "react";
import DynamicForm, { type InputSchema } from "./DynamicForm";
import GenerationCard, { type Gen } from "./GenerationCard";
import { MODE_LABELS, modeOf, type Mode } from "@/lib/model-mode";

type Model = {
  id: string;
  name: string;
  provider: string | null;
  category: "image" | "video" | "audio";
  description: string | null;
  docUrl: string;
  isNew: boolean;
  inputSchema: InputSchema;
};
type Stats = Record<string, { avg: number; n: number }>;

const CATS = [
  ["image", "Images"],
  ["video", "Vidéos"],
  ["audio", "Audio"],
] as const;

export default function Studio({ models: initialModels, stats, favorites }: { models: Model[]; stats: Stats; favorites: string[] }) {
  const [models, setModels] = useState(initialModels);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState("");
  const [cat, setCat] = useState<Model["category"]>("image");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode | "all">("all");
  const [sel, setSel] = useState<Model | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [gens, setGens] = useState<Gen[]>([]);
  const [favs, setFavs] = useState(() => new Set(favorites));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const gensRef = useRef(gens);
  gensRef.current = gens;

  async function resync() {
    if (!sel) return;
    setResyncing(true);
    setResyncMsg("");
    try {
      const r = await fetch("/api/models/resync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sel.id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      const patch = { name: j.name, description: j.description, inputSchema: j.inputSchema };
      setModels((c) => c.map((m) => (m.id === sel.id ? { ...m, ...patch } : m)));
      setSel((c) => (c ? { ...c, ...patch } : c));
      setResyncMsg("Paramètres à jour ✓");
    } catch (e) {
      setResyncMsg((e as Error).message);
    } finally {
      setResyncing(false);
    }
  }

  const withMode = useMemo(() => models.map((m) => ({ ...m, mode: modeOf(m) })), [models]);
  const inCat = useMemo(() => withMode.filter((m) => m.category === cat), [withMode, cat]);
  const modes = useMemo(() => [...new Set(inCat.map((m) => m.mode))], [inCat]);
  const filtered = useMemo(
    () =>
      inCat.filter(
        (m) => (mode === "all" || m.mode === mode) && `${m.name} ${m.provider} ${m.id}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [inCat, mode, q],
  );
  const favList = filtered.filter((m) => favs.has(m.id));
  // Le reste est regroupé par famille (Seedream, Kling, Google…)
  const groups = useMemo(() => {
    const g = new Map<string, typeof filtered>();
    for (const m of filtered.filter((m) => !favs.has(m.id))) {
      const k = m.provider || "Autres";
      g.set(k, [...(g.get(k) ?? []), m]);
    }
    return [...g.entries()];
  }, [filtered, favs]);

  async function toggleFav(id: string) {
    const on = !favs.has(id);
    setFavs((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    const r = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: id, on }),
    });
    if (!r.ok) setFavs((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; }); // annule
  }

  const row = (m: Model & { mode: Mode }) => (
    <div key={m.id} className={`flex items-center rounded-lg ${sel?.id === m.id ? "bg-white/15" : "hover:bg-white/5"}`}>
      <button onClick={() => (setSel(m), setValues({}))} className="min-w-0 flex-1 px-3 py-2 text-left text-sm">
        <div className="flex items-center gap-2">
          <span className="truncate">{m.name}</span>
          {m.isNew && <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 text-[10px] font-medium uppercase text-emerald-300">Nouveau</span>}
        </div>
        <div className="text-[11px] text-white/40">{MODE_LABELS[m.mode]}</div>
      </button>
      <button
        onClick={() => toggleFav(m.id)}
        title={favs.has(m.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={`px-3 py-2 text-base ${favs.has(m.id) ? "text-yellow-400" : "text-white/25 hover:text-white/60"}`}
      >
        {favs.has(m.id) ? "★" : "☆"}
      </button>
    </div>
  );

  // Polling des générations en cours (le webhook met la base à jour aussi, mais ça couvre localhost).
  useEffect(() => {
    const t = setInterval(async () => {
      for (const g of gensRef.current.filter((g) => !["success", "fail"].includes(g.state))) {
        const r = await fetch(`/api/generations/${g.id}`);
        if (r.ok) {
          const n = await r.json();
          setGens((cur) => cur.map((c) => (c.id === n.id ? { ...c, ...n } : c)));
        }
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);

  async function generate() {
    if (!sel) return;
    setBusy(true);
    setError("");
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: sel.id, input: values }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setError(j.error);
    setGens((g) => [j, ...g]);
  }

  return (
    <div className="grid min-h-[calc(100vh-49px)] grid-cols-1 lg:grid-cols-[280px_380px_1fr]">
      <aside className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex gap-1">
          {CATS.map(([k, l]) => (
            <button key={k} onClick={() => (setCat(k), setMode("all"))} className={`flex-1 rounded-md py-1.5 text-sm ${cat === k ? "bg-violet-500" : "bg-white/5 hover:bg-white/10"}`}>
              {l}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un modèle…" className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
        {modes.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {(["all", ...modes] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${mode === k ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
              >
                {k === "all" ? "Tous" : MODE_LABELS[k]}
              </button>
            ))}
          </div>
        )}
        <div className="max-h-[40vh] space-y-1 overflow-auto lg:max-h-[calc(100vh-220px)]">
          {favList.length > 0 && (
            <>
              <p className="px-3 pt-1 text-[11px] uppercase tracking-wide text-white/50"><span className="text-yellow-400">★</span> Favoris</p>
              {favList.map(row)}
            </>
          )}
          {groups.map(([provider, list]) => (
            <div key={provider}>
              <p className="px-3 pb-0.5 pt-3 text-[11px] uppercase tracking-wide text-white/40">{provider}</p>
              {list.map(row)}
            </div>
          ))}
          {filtered.length === 0 && <p className="p-3 text-sm text-white/40">Aucun modèle. L&apos;admin doit lancer une synchro (Admin &gt; Modèles).</p>}
        </div>
      </aside>

      <section className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
        {sel ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">{sel.name}</h2>
              <p className="text-xs text-white/40">
                {sel.id} · {MODE_LABELS[modeOf(sel)]}
              </p>
              {sel.description && <p className="mt-2 line-clamp-6 text-xs text-white/60">{sel.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {stats[sel.id] ? (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">
                    ≈ {usd(stats[sel.id].avg)} · {Math.round(stats[sel.id].avg * 100) / 100} crédits / génération ({stats[sel.id].n} essai{stats[sel.id].n > 1 ? "s" : ""})
                  </span>
                ) : (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-white/50">Coût connu après la 1ʳᵉ génération</span>
                )}
                <a href={sel.docUrl.replace(/\.md$/, "")} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">
                  Documentation Kie ↗
                </a>
                <button type="button" onClick={resync} disabled={resyncing} className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20 disabled:opacity-50">
                  {resyncing ? "Mise à jour…" : "↻ Resynchroniser ce modèle"}
                </button>
                {resyncMsg && <span className="text-white/50">{resyncMsg}</span>}
              </div>
            </div>
            <DynamicForm key={sel.id} schema={sel.inputSchema} values={values} onChange={setValues} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button disabled={busy} onClick={generate} className="w-full rounded-lg bg-violet-500 py-2.5 font-medium hover:bg-violet-400 disabled:opacity-50">
              {busy ? "Envoi…" : "Générer"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-white/40">Choisissez un modèle à gauche.</p>
        )}
      </section>

      <section className="p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          {gens.map((g) => (
            <GenerationCard
              key={g.id}
              gen={g}
              onChange={(n) => setGens((c) => c.map((x) => (x.id === n.id ? { ...x, ...n } : x)))}
              onDelete={(id) => setGens((c) => c.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
