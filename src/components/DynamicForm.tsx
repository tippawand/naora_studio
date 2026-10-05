"use client";

import { useState } from "react";

type Prop = {
  type?: string;
  description?: string;
  enum?: (string | number)[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  format?: string;
  items?: Prop;
  maxItems?: number;
  properties?: Record<string, Prop>;
  required?: string[];
};
export type InputSchema = { properties: Record<string, Prop>; required?: string[] };

const field =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-violet-400";

// ---------- Aides : descriptions, libellés d'enum, aperçus, langues ----------

// Les descriptions Kie contiennent parfois des entités HTML (&lt; &gt;…)
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s<>)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-violet-300 hover:underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/** Description complète (jamais tronquée) : 1er paragraphe visible, le reste dans « Plus de détails ». */
function Desc({ text }: { text?: string }) {
  if (!text) return null;
  const [head, ...rest] = decode(text).trim().split(/\n\s*\n/);
  const more = rest.join("\n\n");
  return (
    <div className="text-[11px] leading-relaxed text-white/45">
      <p className="whitespace-pre-line">{linkify(head)}</p>
      {more && (
        <details className="mt-1">
          <summary className="cursor-pointer text-violet-300/80">Plus de détails</summary>
          <p className="mt-1 max-h-60 overflow-auto whitespace-pre-line">{linkify(more)}</p>
        </details>
      )}
    </div>
  );
}

/**
 * Kie décrit souvent les valeurs d'un enum dans la description :
 *   « EkK5…ZcX - James - Husky, Engaging and Bold »  ou  « - Tutor: Bodi, Lumi, … »
 * On en tire un libellé lisible ; la valeur envoyée à Kie reste l'ID d'origine.
 */
function enumLabels(p: Prop): Record<string, string> {
  const out: Record<string, string> = {};
  if (!p.enum || !p.description) return out;
  const values = new Set(p.enum.map(String));
  for (const line of decode(p.description).split("\n")) {
    const l = line.trim().replace(/^[-*]\s*/, "");
    const byId = l.match(/^(\S+)\s+-\s+(.+)$/);
    if (byId && values.has(byId[1])) {
      out[byId[1]] = byId[2].trim().replace(/\s+-\s+/g, " — ");
      continue;
    }
    const group = l.match(/^([^:]{2,40}):\s*(.+)$/);
    if (group) {
      for (const n of group[2].split(/,\s*/)) if (values.has(n.trim())) out[n.trim()] = `${n.trim()} · ${group[1]}`;
    }
  }
  return out;
}

/** URL d'aperçu du type https://…/voice/<voice_id>.mp3 trouvée dans la description. */
function previewUrl(p: Prop, value: unknown): string | null {
  if (!p.description || !value) return null;
  const tpl = decode(p.description).match(/https?:\/\/\S*<[^>\s]+>\S*?\.(?:mp3|wav|mp4|webm)/);
  return tpl ? tpl[0].replace(/<[^>]+>/, String(value)) : null;
}

const LANG_COMMON = ["ar", "bg", "cs", "da", "de", "el", "en", "es", "fi", "fil", "fr", "hi", "hr", "hu", "id", "it", "ja", "ko", "ms", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sv", "ta", "tr", "uk", "vi", "zh"];
const LANG_TOP = ["fr", "en", "es", "de", "it", "pt"];
const isLanguage = (name: string, p: Prop) => /^(language|language_code|lang)$/i.test(name) && p.type === "string";

function langOptions(codes: string[]) {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["fr"], { type: "language" });
  } catch {}
  const label = (c: string) => {
    const n = names?.of(c);
    return n && n !== c ? `${n.charAt(0).toUpperCase()}${n.slice(1)} (${c})` : c;
  };
  const all = [...new Set(codes)].map((c) => ({ value: c, label: label(c) }));
  const top = LANG_TOP.map((c) => all.find((o) => o.value === c)).filter((o): o is { value: string; label: string } => !!o);
  const rest = all.filter((o) => !LANG_TOP.includes(o.value)).sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return [...top, ...rest];
}

const isFileUrl = (name: string, p: Prop) =>
  p.format === "uri" || (/(image|video|audio|file|frame|reference|mask)s?_?(url|input)?s?$/i.test(name) && p.type === "string");
const isFileList = (name: string, p: Prop) =>
  p.type === "array" &&
  p.items?.type !== "object" &&
  (p.items?.format === "uri" || (p.items?.type === "string" && /(url|image|video|audio|input|reference)/i.test(name)));

async function upload(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Upload échoué");
  return j.url;
}

// ---------- Composants de champs ----------

function UrlList({ value, onChange, max }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      {value.map((u, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="truncate text-white/60">{u}</span>
          <button type="button" className="ml-auto text-red-300" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      {(!max || value.length < max) && (
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Coller une URL…" className={field} />
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 text-sm"
            onClick={() => draft && (onChange([...value, draft]), setDraft(""))}
          >
            +
          </button>
          <label className="cursor-pointer whitespace-nowrap rounded-lg bg-white/10 px-3 py-2 text-sm">
            {busy ? "…" : "Fichier"}
            <input
              type="file"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setErr("");
                try {
                  onChange([...value, await upload(f)]);
                } catch (x) {
                  setErr((x as Error).message);
                }
                setBusy(false);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  emptyLabel,
}: {
  value: unknown;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
  emptyLabel: string;
}) {
  return (
    <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} className={field}>
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Liste d'objets (ex. interlocuteurs, répliques de dialogue) : un petit formulaire par élément. */
function ObjectList({ name, p, value, set }: { name: string; p: Prop; value: unknown; set: (v: unknown) => void }) {
  const items = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const itemSchema = p.items!;
  const props = Object.entries(itemSchema.properties ?? {});
  const req = new Set(itemSchema.required ?? []);

  const add = () => {
    const base: Record<string, unknown> = {};
    for (const [k, v] of props) {
      if (v.default !== undefined && v.default !== "") base[k] = v.default;
      if (k === "speaker_id" && !v.enum) base[k] = `Speaker ${items.length + 1}`; // format « Speaker N » demandé par Kie
    }
    set([...items, base]);
  };
  const patch = (i: number, k: string, v: unknown) =>
    set(
      items.map((it, j) => {
        if (j !== i) return it;
        const n = { ...it };
        if (v === undefined) delete n[k];
        else n[k] = v;
        return n;
      }),
    );
  const remove = (i: number) => set(items.length > 1 ? items.filter((_, j) => j !== i) : undefined);

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center text-xs text-white/50">
            <span>
              {name} #{i + 1}
            </span>
            <button type="button" onClick={() => remove(i)} className="ml-auto text-red-300">
              Retirer
            </button>
          </div>
          {props.map(([k, sp]) => (
            <div key={k} className="space-y-1">
              {sp.type !== "boolean" && (
                <label className="flex items-baseline gap-2 text-xs font-medium text-white/80">
                  {k}
                  {req.has(k) && <span className="text-violet-300">requis</span>}
                </label>
              )}
              <Field name={k} p={sp} value={it[k]} set={(v) => patch(i, k, v)} />
              <Desc text={sp.description} />
            </div>
          ))}
        </div>
      ))}
      {(!p.maxItems || items.length < p.maxItems) && (
        <button type="button" onClick={add} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
          + Ajouter
        </button>
      )}
    </div>
  );
}

const CUSTOM = "__custom__";

/** Voix : liste prédéfinie + option « Autre » pour saisir un voice ID personnalisé (ex. ElevenLabs). */
function VoiceField({ p, value, set }: { p: Prop; value: unknown; set: (v: unknown) => void }) {
  const options = (p.enum ?? []).map(String);
  const labels = enumLabels(p);
  const isCustomValue = typeof value === "string" && value !== "" && !options.includes(value);
  const [custom, setCustom] = useState(isCustomValue);
  const showCustom = custom || isCustomValue;
  const preview = previewUrl(p, value);
  return (
    <div className="space-y-2">
      <select
        value={showCustom ? CUSTOM : String(value ?? "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === CUSTOM) {
            setCustom(true);
            set(undefined);
          } else {
            setCustom(false);
            set(v === "" ? undefined : v);
          }
        }}
        className={field}
      >
        <option value="">{`(défaut${p.default !== undefined ? ` : ${labels[String(p.default)] ?? p.default}` : ""})`}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o] ?? o}
          </option>
        ))}
        <option value={CUSTOM}>Autre : saisir un voice ID…</option>
      </select>
      {showCustom && (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value.trim() || undefined)}
          placeholder="Voice ID (ex. N2lVS1w4EtoT3dr4eOWO)"
          className={field}
          autoFocus
        />
      )}
      {preview && <audio key={preview} src={preview} controls preload="none" className="h-9 w-full" />}
    </div>
  );
}

function Field({ name, p, value, set }: { name: string; p: Prop; value: unknown; set: (v: unknown) => void }) {
  // Langue : sélecteur avec noms de langues au lieu de codes ISO bruts
  if (isLanguage(name, p)) {
    const codes = (p.enum?.map(String) ?? LANG_COMMON) as string[];
    return <Select value={value} options={langOptions(codes)} onChange={set} emptyLabel="Automatique / défaut" />;
  }
  if (p.enum && p.type === "string" && /voice/i.test(name) && /voice\s*id/i.test(decode(p.description ?? ""))) {
    return <VoiceField p={p} value={value} set={set} />;
  }
  if (p.enum) {
    const labels = enumLabels(p);
    const numeric = p.type === "number" || p.type === "integer";
    const preview = previewUrl(p, value);
    return (
      <div className="space-y-2">
        <Select
          value={value}
          options={p.enum.map((o) => ({ value: String(o), label: labels[String(o)] ? `${labels[String(o)]}` : String(o) }))}
          onChange={(v) => set(v === undefined ? undefined : numeric ? Number(v) : v)}
          emptyLabel={`(défaut${p.default !== undefined ? ` : ${labels[String(p.default)] ?? p.default}` : ""})`}
        />
        {preview && (
          // Aperçu audio de la voix sélectionnée (URL fournie par Kie)
          <audio key={preview} src={preview} controls preload="none" className="h-9 w-full" />
        )}
        {preview === null && p.description && /voice/i.test(name) && value === undefined && p.default !== undefined && (
          <p className="text-[11px] text-white/35">Sélectionnez une voix pour l&apos;écouter.</p>
        )}
      </div>
    );
  }
  if (p.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value ?? p.default ?? false)} onChange={(e) => set(e.target.checked)} />
        {name}
      </label>
    );
  }
  if (p.type === "integer" || p.type === "number") {
    return (
      <input
        type="number"
        value={(value as number | undefined) ?? ""}
        min={p.minimum}
        max={p.maximum}
        step={p.type === "integer" ? 1 : "any"}
        placeholder={p.default !== undefined ? String(p.default) : ""}
        onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
        className={field}
      />
    );
  }
  if (p.type === "array" && p.items?.type === "object" && p.items.properties) {
    return <ObjectList name={name} p={p} value={value} set={set} />;
  }
  if (isFileList(name, p)) {
    return <UrlList value={(value as string[]) ?? []} onChange={set} max={p.maxItems} />;
  }
  if (p.type === "string" && isFileUrl(name, p)) {
    return <UrlList value={value ? [value as string] : []} onChange={(v) => set(v[0])} max={1} />;
  }
  if (p.type === "string") {
    const long = /prompt|text|description|script|style|scene|context/i.test(name) || (p.maxLength ?? 0) > 300;
    return long ? (
      <textarea rows={4} maxLength={p.maxLength} value={(value as string) ?? ""} onChange={(e) => set(e.target.value || undefined)} className={field} />
    ) : (
      <input value={(value as string) ?? ""} maxLength={p.maxLength} onChange={(e) => set(e.target.value || undefined)} className={field} />
    );
  }
  // objets libres, tableaux atypiques : JSON brut
  return (
    <textarea
      rows={3}
      placeholder="JSON"
      defaultValue={value ? JSON.stringify(value) : ""}
      onChange={(e) => {
        try {
          set(e.target.value ? JSON.parse(e.target.value) : undefined);
        } catch {}
      }}
      className={`${field} font-mono text-xs`}
    />
  );
}

export default function DynamicForm({
  schema,
  values,
  onChange,
}: {
  schema: InputSchema;
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(schema.properties);
  const main = entries.filter(([k]) => required.has(k) || k === "prompt");
  const adv = entries.filter(([k]) => !required.has(k) && k !== "prompt");
  const set = (k: string) => (v: unknown) => {
    const next = { ...values };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(next);
  };
  const render = ([k, p]: [string, Prop]) => (
    <div key={k} className="space-y-1">
      {p.type !== "boolean" && (
        <label className="flex items-baseline gap-2 text-xs font-medium text-white/80">
          {k}
          {required.has(k) && <span className="text-violet-300">requis</span>}
        </label>
      )}
      <Field name={k} p={p} value={values[k]} set={set(k)} />
      <Desc text={p.description} />
    </div>
  );
  return (
    <div className="space-y-4">
      {main.map(render)}
      {adv.length > 0 && (
        <details className="rounded-lg border border-white/10 p-3">
          <summary className="cursor-pointer text-sm text-white/70">Options avancées ({adv.length})</summary>
          <div className="mt-3 space-y-4">{adv.map(render)}</div>
        </details>
      )}
    </div>
  );
}
