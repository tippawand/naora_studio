/**
 * Corrige à la lecture les erreurs de la doc Kie (copier-coller, placeholders, noms de champs avec espaces…).
 * Appliqué après chaque lecture en base : une resynchronisation ne ré-introduit donc jamais les erreurs.
 *  - nettoyage générique : valable pour tous les modèles ;
 *  - corrections ciblées : uniquement des erreurs certaines, modèle par modèle.
 */

type Node = Record<string, any>;
type ModelLike = { id: string; name: string; description: string | null; inputSchema: any; requiredInputs: string[] };

// ---------- Nettoyage générique ----------

const decodeOnce = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const decodeAll = (s: string) => {
  let out = s;
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
};

const PLACEHOLDER = /^(select|radio|input|text|checkbox|number)\s+description$/i;
const BOILERPLATE_MODEL_DESC = /^\s*(##\s*(create task|query task)|use this endpoint)/i;
const INTERNAL_NOTE = /\b(the current project|the frontend|front-end)\b/i;

/** Retire les phrases d'une description qui vérifient `test`. */
const dropSentences = (text: string, test: RegExp) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !test.test(s))
    .join(" ")
    .trim();

function cleanText(text: string): string {
  let t = decodeAll(text);
  t = t.replace(/<\/?(Steps?|Note|Tip|Warning|Info|Check|Card|CardGroup|Tabs?|Accordion)\b[^>]*>/g, " ");
  t = dropSentences(t, INTERNAL_NOTE);
  t = t.replace(/\bYou Applicable\b/g, "Applicable");
  t = t.replace(/([a-z])\.\.(?!\.)/g, "$1.").replace(/([a-z])\.(If|Only|The|Note|When)\b/g, "$1. $2");
  t = t.replace(/[ \t]{2,}/g, " ");
  return t.trim();
}

function cleanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanSchema);
  if (!node || typeof node !== "object") return node;
  const out: Node = {};
  for (const [k, v] of Object.entries(node as Node)) {
    if (k.startsWith("x--")) continue; // métadonnées internes de l'éditeur de doc
    if (k === "description" && typeof v === "string") {
      const c = PLACEHOLDER.test(v.trim()) ? "" : cleanText(v);
      if (c) out.description = c;
    } else if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(Object.entries(v as Node).map(([pk, pv]) => [pk.trim(), cleanSchema(pv)]));
    } else if (k === "required" && Array.isArray(v)) {
      out.required = v.map((r) => (typeof r === "string" ? r.trim() : r));
    } else {
      out[k] = cleanSchema(v);
    }
  }
  return out;
}

// ---------- Outils pour les corrections ciblées ----------

/** Parcourt toutes les propriétés (imbriquées comprises) nommées `key`. */
function eachProp(schema: Node, fn: (key: string, p: Node) => void, only?: string | RegExp) {
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.properties && typeof n.properties === "object") {
      for (const [k, p] of Object.entries<Node>(n.properties)) {
        if (!only || (typeof only === "string" ? k === only : only.test(k))) fn(k, p);
        walk(p);
      }
    }
    if (n.items) walk(n.items);
  };
  walk(schema);
}

const setDesc = (p: Node, fn: (d: string) => string) => {
  if (typeof p.description === "string") {
    const d = fn(p.description).trim();
    if (d) p.description = d;
    else delete p.description;
  }
};

const removeRequired = (m: ModelLike, keys: string[]) => {
  m.requiredInputs = m.requiredInputs.filter((k) => !keys.includes(k));
  if (Array.isArray(m.inputSchema?.required)) m.inputSchema.required = m.inputSchema.required.filter((k: string) => !keys.includes(k));
};
const addRequired = (m: ModelLike, keys: string[]) => {
  m.requiredInputs = [...new Set([...m.requiredInputs, ...keys])];
  m.inputSchema.required = [...new Set([...(m.inputSchema.required ?? []), ...keys])];
};

// ---------- Corrections ciblées (erreurs certaines uniquement) ----------

const FIXES: Record<string, (m: ModelLike) => void> = {
  "topaz/image-upscale": (m) =>
    eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace("upscale the video by", "upscale the image by")), "upscale_factor"),

  // Phrases sur une « image d'entrée » / « auto » alors que le modèle n'en a pas
  ...Object.fromEntries(
    ["flux-2/pro-text-to-image", "flux-2/flex-text-to-image", "z-image"].map((id) => [
      id,
      (m: ModelLike) => eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => dropSentences(d, /\bauto\b|first input image|input image/i)), "aspect_ratio"),
    ]),
  ),

  "grok-imagine-image-2-0/image-edit": (m) =>
    eachProp(m.inputSchema, (_k, p) => {
      if (p.maxLength === 390000) p.maxLength = 8000;
    }, "prompt"),

  "grok-imagine/extend": (m) => {
    removeRequired(m, ["extend_at"]); // la description dit « optional » et un défaut existe
    if (typeof m.inputSchema?.description === "string") m.inputSchema.description = m.inputSchema.description.replace(/upscaling/i, "extension");
  },

  "ideogram/character": (m) =>
    eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/to fill the masked part of the image/i, "to generate the image with")), "prompt"),

  "qwen/image-edit": (m) => {
    eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/'none',\s*'regular'(?!,\s*'high')/, "'none', 'regular', 'high'")), "acceleration");
    eachProp(m.inputSchema, (_k, p) => {
      if (p.default === 25) setDesc(p, (d) => d.replace(/Default value:\s*30/i, "Default value: 25"));
    }, "num_inference_steps");
  },

  // Les champs « requis » annoncés en texte mais absents du schéma
  ...Object.fromEntries(
    ["bytedance/seedance-2", "bytedance/seedance-2-fast", "bytedance/seedance-2-mini", "bytedance/seedance-2-5"].map((id) => [
      id,
      (m: ModelLike) => {
        if (m.inputSchema?.properties?.prompt) addRequired(m, ["prompt"]);
        if (id === "bytedance/seedance-2-5") {
          eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/reference videos/g, "reference audios")), "reference_audio_urls");
          eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => dropSentences(d, /\bdraft\b/i)), "return_last_frame");
        }
      },
    ]),
  ),

  "bytedance/v1-pro-fast-image-to-video": (m) =>
    eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/480p[^,.;]*[,;]\s*/i, "")), "resolution"),

  // « 10 s non supporté en 1080p » alors que 1080p n'existe pas sur ces modèles
  ...Object.fromEntries(
    ["hailuo/02-image-to-video-standard", "hailuo/02-text-to-video-standard"].map((id) => [
      id,
      (m: ModelLike) => eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => dropSentences(d, /1080p/i)), "duration"),
    ]),
  ),

  "happyhorse-1-1/reference-to-video": (m) =>
    eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/the media array/gi, "the reference_image list")), "prompt"),

  "happyhorse-1-1/text-to-video": (m) =>
    eachProp(m.inputSchema, (_k, p) => {
      if (p.maxLength === 4999) p.maxLength = 5000;
    }, "prompt"),

  // « aspect ratio » cité alors que le modèle n'a pas ce paramètre
  ...Object.fromEntries(
    [
      "infinitalk/from-audio",
      "wan/2-2-a14b-image-to-video-turbo",
      "wan/2-2-a14b-speech-to-video-turbo",
      "wan/2-2-animate-move",
      "wan/2-2-animate-replace",
    ].map((id) => [
      id,
      (m: ModelLike) => {
        if (!m.inputSchema?.properties?.aspect_ratio) eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => dropSentences(d, /aspect ratio/i)), "image_url");
        if (id === "wan/2-2-a14b-speech-to-video-turbo") {
          eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => dropSentences(d, /adjust_fps_for_interpolation|interpolated/i)), "frames_per_second");
        }
      },
    ]),
  ),

  ...Object.fromEntries(
    ["wan/2-6-video-to-video", "wan/2-6-flash-video-to-video"].map((id) => [
      id,
      (m: ModelLike) =>
        eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/URL of the image used/i, "URL of the video(s) used")), "video_urls"),
    ]),
  ),

  // wan 3.0 : URLs déclarées comme objets vides, description « première frame » recopiée partout
  ...Object.fromEntries(
    ["wan/3-0-video", "wan/3-0-video-prime"].map((id) => [
      id,
      (m: ModelLike) => {
        eachProp(m.inputSchema, (k, p) => {
          if (k === "first_frame_url" || k === "last_frame_url") {
            if (p.type === "object") {
              p.type = "string";
              p.format = "uri";
              delete p.properties;
            }
            if (k === "last_frame_url") p.description = "URL of the last-frame image. Up to 1 image.";
          }
          const ref = k.match(/^reference_(\w+?)_urls$/);
          if (ref) {
            const kind = ref[1];
            if (p.type === "array") {
              if (!p.items || p.items.type === "object") p.items = { type: "string", format: "uri" };
              if (typeof p.description === "string" && /first-frame/i.test(p.description)) p.description = `URLs of reference ${kind} files.`;
            }
          }
        });
      },
    ]),
  ),

  "kling-3.0/video": (m) => removeRequired(m, ["multi_prompt"]), // conditionnel (si multi_shots = true)

  "kling-3.0-omni/reference-to-video": (m) =>
    eachProp(m.inputSchema, (_k, p) => {
      if (p.const === false) delete p.const;
    }, "audio"),

  ...Object.fromEntries(
    ["google/gemini-3-1-flash-tts", "google/gemini-3-8-flash-lite-tts", "google/gemini-3-8-flash-tts"].map((id) => [
      id,
      (m: ModelLike) => {
        m.description = "Text-to-speech generation with Google Gemini.";
        if (id === "google/gemini-3-1-flash-tts") {
          eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/\s*\(?e\.g\.,?\s*["“][^"”]*["”]\)?/gi, "")), /^(pace|style)$/);
        }
      },
    ]),
  ),

  "elevenlabs/text-to-dialogue-v3": (m) =>
    eachProp(
      m.inputSchema,
      (_k, p) => setDesc(p, (d) => d.replace(/Can be a preset voice name \(e\.g\.[^)]*\) or a voice ID/i, "Choose a voice from the list or enter a custom voice ID")),
      "voice",
    ),

  // Kie renvoie une erreur si ce paramètre est fourni sur ce modèle
  "elevenlabs/text-to-speech-multilingual-v2": (m) => {
    delete m.inputSchema?.properties?.language_code;
    removeRequired(m, ["language_code"]);
  },

  "qwen3/text-to-image": (m) => eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/\s+or edit\b/i, "")), "prompt"),
  "qwen3/pro-text-to-image": (m) => eachProp(m.inputSchema, (_k, p) => setDesc(p, (d) => d.replace(/\s+or edit\b/i, "")), "prompt"),
};

/** Modèle sans aucun paramètre : inutilisable (schéma vide côté doc Kie). */
export const hasNoParams = (m: Pick<ModelLike, "inputSchema">) => Object.keys(m.inputSchema?.properties ?? {}).length === 0;

export function fixModel<M extends ModelLike>(model: M): M {
  const m = structuredClone(model);
  m.inputSchema = cleanSchema(m.inputSchema) ?? {};
  m.requiredInputs = (m.requiredInputs ?? []).map((k) => k.trim());
  m.name = m.name.replace(/\s{2,}/g, " ").trim();
  if (m.description !== null) {
    const d = m.description.trim();
    m.description = !d || BOILERPLATE_MODEL_DESC.test(d) ? null : cleanText(d) || null;
  }
  try {
    FIXES[m.id]?.(m);
  } catch {
    // une correction ciblée ne doit jamais casser l'affichage du modèle
  }
  return m;
}
