"use client";

import { useActionState, useState, useTransition } from "react";
import { createTokenAction, createUserAction, deleteUserAction, revokeTokenAction, saveSettingsAction, toggleModelAction } from "@/app/actions";

const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-violet-400";
const card = "rounded-2xl border border-white/10 bg-white/[0.03] p-5";

type F = { key: string; label: string; secret: boolean; set: boolean; preview?: string };
type U = { id: string; email: string; name: string | null; role: "admin" | "member" };
type T = { id: string; name: string; prefix: string; email: string; lastUsedAt: string | null; createdAt: string };
type M = { id: string; name: string; provider: string | null; category: string; enabled: boolean };

export default function AdminPanel({ meId, fields, users, models, tokens }: { meId: string; fields: F[]; users: U[]; models: M[]; tokens: T[] }) {
  const [sState, sAction, sPending] = useActionState(saveSettingsAction, undefined);
  const [uState, uAction, uPending] = useActionState(createUserAction, undefined);
  const [tState, tAction, tPending] = useActionState(createTokenAction, undefined);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [, start] = useTransition();

  async function sync() {
    setSyncing(true);
    setSyncMsg("");
    const r = await fetch("/api/models/sync", { method: "POST" });
    const j = await r.json();
    setSyncing(false);
    if (!r.ok) return setSyncMsg(j.error);
    setSyncMsg(
      `${j.added.length} ajouté(s), ${j.updated} mis à jour, ${j.failed} ignoré(s)` +
        (j.remaining ? ` — ${j.remaining} restants, relancez la synchro.` : ""),
    );
    setTimeout(() => location.reload(), 1500);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <section className={card}>
        <h2 className="mb-1 font-semibold">Clés API &amp; réglages</h2>
        <p className="mb-4 text-xs text-white/50">Stockés chiffrés (AES-256-GCM). Laisser un champ vide conserve la valeur actuelle.</p>
        <form action={sAction} className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="flex items-center gap-2 text-xs text-white/70">
                {f.label}
                {f.set && <span className="rounded bg-emerald-500/20 px-1.5 text-emerald-300">configuré{f.preview ? ` : ${f.preview}` : ""}</span>}
                {f.set && (
                  <label className="ml-auto flex items-center gap-1 text-red-300">
                    <input type="checkbox" name={`clear_${f.key}`} /> effacer
                  </label>
                )}
              </label>
              <input name={f.key} type={f.secret ? "password" : "text"} autoComplete="off" placeholder={f.set ? "••••••••" : ""} className={input} />
            </div>
          ))}
          {sState?.ok && <p className="text-sm text-emerald-300">{sState.ok}</p>}
          <button disabled={sPending} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium hover:bg-violet-400 disabled:opacity-50">Enregistrer</button>
        </form>
      </section>

      <section className={card}>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-semibold">Modèles ({models.length})</h2>
          <button onClick={sync} disabled={syncing} className="ml-auto rounded-lg bg-violet-500 px-3 py-1.5 text-sm hover:bg-violet-400 disabled:opacity-50">
            {syncing ? "Synchro…" : "Synchroniser avec Kie"}
          </button>
        </div>
        <p className="mb-3 text-xs text-white/50">Synchro automatique chaque jour (cron). Nouveaux modèles Kie = ajoutés tout seuls, formulaire inclus.</p>
        {syncMsg && <p className="mb-3 text-sm text-white/70">{syncMsg}</p>}
        <div className="max-h-96 divide-y divide-white/5 overflow-auto text-sm">
          {models.map((m) => (
            <label key={m.id} className="flex items-center gap-3 py-1.5">
              <input type="checkbox" checked={m.enabled} onChange={(e) => start(() => toggleModelAction(m.id, e.target.checked))} />
              <span>{m.name}</span>
              <span className="text-xs text-white/40">{m.provider}</span>
              <span className="ml-auto rounded bg-white/10 px-1.5 text-xs">{m.category}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-semibold">Accès MCP / passerelle</h2>
        <p className="mb-3 text-xs text-white/50">
          Permet à Claude, ChatGPT, Cursor… d&apos;utiliser l&apos;outil sans que l&apos;équipe ne voie la clé Kie. Un jeton par personne, révocable.
        </p>
        <code className="mb-3 block rounded-lg bg-black/40 p-2 text-xs">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/mcp
        </code>
        <div className="mb-4 divide-y divide-white/5 text-sm">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-1.5">
              <span>{t.name}</span>
              <span className="text-xs text-white/40">{t.email} · {t.prefix}…</span>
              <span className="text-xs text-white/40">{t.lastUsedAt ? `utilisé ${new Date(t.lastUsedAt).toLocaleString("fr-FR")}` : "jamais utilisé"}</span>
              <button onClick={() => confirm("Révoquer ce jeton ?") && start(() => revokeTokenAction(t.id))} className="ml-auto text-red-300">Révoquer</button>
            </div>
          ))}
          {tokens.length === 0 && <p className="py-1.5 text-white/40">Aucun jeton.</p>}
        </div>
        <form action={tAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select name="userId" className={input} defaultValue={meId}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
          <input name="name" placeholder="Nom (ex. Claude Desktop)" className={input} />
          <button disabled={tPending} className="rounded-lg bg-white/10 px-4 text-sm hover:bg-white/20">Créer un jeton</button>
        </form>
        {tState?.error && <p className="mt-2 text-sm text-red-400">{tState.error}</p>}
        {tState?.token && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <p className="mb-1 text-emerald-300">{tState.ok}</p>
            <code className="block break-all rounded bg-black/40 p-2 text-xs">{tState.token}</code>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Équipe</h2>
        <div className="mb-4 divide-y divide-white/5 text-sm">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-1.5">
              <span>{u.name || u.email}</span>
              <span className="text-xs text-white/40">{u.email}</span>
              <span className="rounded bg-white/10 px-1.5 text-xs">{u.role}</span>
              {u.id !== meId && (
                <button onClick={() => confirm("Supprimer ?") && start(() => deleteUserAction(u.id))} className="ml-auto text-red-300">
                  Supprimer
                </button>
              )}
            </div>
          ))}
        </div>
        <form action={uAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <input name="name" placeholder="Nom" className={input} />
          <input name="email" type="email" required placeholder="Email" className={input} />
          <input name="password" type="text" required placeholder="Mot de passe (10+)" className={input} />
          <select name="role" className={input}>
            <option value="member">Membre</option>
            <option value="admin">Admin</option>
          </select>
          <button disabled={uPending} className="rounded-lg bg-white/10 px-4 text-sm hover:bg-white/20">Ajouter</button>
        </form>
        {uState?.error && <p className="mt-2 text-sm text-red-400">{uState.error}</p>}
        {uState?.ok && <p className="mt-2 text-sm text-emerald-300">{uState.ok}</p>}
      </section>
    </main>
  );
}
