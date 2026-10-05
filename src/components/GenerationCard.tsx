"use client";

import { usd } from "@/lib/pricing";
import { useState } from "react";
import Media from "./Media";

export type Gen = {
  id: string;
  modelId: string;
  state: string;
  input: Record<string, unknown>;
  resultUrls: string[] | null;
  storedUrls: string[] | null;
  error: string | null;
  kept: boolean;
  credits?: number | null;
  createdAt: string;
  userName?: string | null;
};

export default function GenerationCard({
  gen,
  onChange,
  onDelete,
}: {
  gen: Gen;
  onChange?: (g: Gen) => void;
  onDelete?: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const urls = gen.storedUrls?.length ? gen.storedUrls : (gen.resultUrls ?? []);
  const prompt = typeof gen.input.prompt === "string" ? gen.input.prompt : "";

  async function keep() {
    setBusy(true);
    setMsg("");
    const r = await fetch(`/api/generations/${gen.id}/keep`, { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error);
    if (!j.storage) setMsg("Gardé — stockage non configuré : téléchargez avant 24h.");
    onChange?.(j);
  }
  async function remove() {
    if (!confirm("Supprimer cette génération ?")) return;
    await fetch(`/api/generations/${gen.id}`, { method: "DELETE" });
    onDelete?.(gen.id);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {gen.state === "success" ? (
        <div className="grid gap-1 bg-black/30">
          {urls.map((u) => (
            <Media key={u} url={u} className="max-h-96 w-full object-contain" />
          ))}
        </div>
      ) : gen.state === "fail" ? (
        <p className="p-4 text-sm text-red-400">{gen.error}</p>
      ) : (
        <div className="flex h-40 items-center justify-center text-sm text-white/50">
          <span className="animate-pulse">Génération en cours ({gen.state})…</span>
        </div>
      )}
      <div className="space-y-2 p-3 text-xs">
        <div className="flex items-center gap-2 text-white/50">
          <span className="rounded bg-white/10 px-1.5 py-0.5">{gen.modelId}</span>
          {gen.userName && <span>{gen.userName}</span>}
          {typeof gen.credits === "number" && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{gen.credits} cr. · {usd(gen.credits)}</span>}
          <span className="ml-auto">{new Date(gen.createdAt).toLocaleString("fr-FR")}</span>
        </div>
        {prompt && <p className="line-clamp-3 text-white/70" title={prompt}>{prompt}</p>}
        {msg && <p className="text-amber-300">{msg}</p>}
        {gen.state === "success" && (
          <div className="flex flex-wrap gap-2">
            {!gen.kept && (
              <button disabled={busy} onClick={keep} className="rounded-md bg-violet-500 px-2.5 py-1 hover:bg-violet-400 disabled:opacity-50">
                {busy ? "Copie…" : "Garder"}
              </button>
            )}
            {gen.kept && <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-emerald-300">Gardé</span>}
            {urls.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" download className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20">
                Télécharger{urls.length > 1 ? ` ${i + 1}` : ""}
              </a>
            ))}
            {onDelete && (
              <button onClick={remove} className="ml-auto rounded-md px-2.5 py-1 text-red-300 hover:bg-red-500/10">
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
