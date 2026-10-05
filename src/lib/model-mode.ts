// Type de modèle (texte→image, image→vidéo…) déduit de l'id, du nom et des champs du schéma Kie.
// Purement indicatif : les paramètres envoyés à Kie ne sont jamais modifiés.

export type Mode =
  | "text-to-image" | "image-to-image" | "edit" | "upscale" | "remove-bg"
  | "text-to-video" | "image-to-video" | "reference-to-video" | "video-to-video" | "avatar"
  | "speech" | "audio-tools" | "other";

export const MODE_LABELS: Record<Mode, string> = {
  "text-to-image": "Texte → Image",
  "image-to-image": "Image → Image",
  edit: "Édition",
  upscale: "Upscale",
  "remove-bg": "Détourage",
  "text-to-video": "Texte → Vidéo",
  "image-to-video": "Image → Vidéo",
  "reference-to-video": "Référence → Vidéo",
  "video-to-video": "Vidéo → Vidéo / édition",
  avatar: "Avatar / Lip sync",
  speech: "Voix / TTS",
  "audio-tools": "Outils audio",
  other: "Autres",
};

type Schema = { properties?: Record<string, unknown>; required?: string[] };

export function modeOf(m: { id: string; name: string; category: "image" | "video" | "audio"; inputSchema: Schema }): Mode {
  const s = `${m.id} ${m.name}`.toLowerCase();
  const props = Object.keys(m.inputSchema?.properties ?? {});
  const required = m.inputSchema?.required ?? [];
  const hasImage = (list: string[]) => list.some((k) => /image|frame/i.test(k) && !/aspect/i.test(k));

  if (/upscale|crisp/.test(s)) return "upscale";
  if (/remove-?background|background/.test(s)) return "remove-bg";
  if (m.category === "audio") return /isolation|stem|separat/.test(s) ? "audio-tools" : "speech";
  if (/avatar|lip-?sync|omnihuman|infinitalk|speech-to-video/.test(s)) return "avatar";
  if (/reference-to-video|r2v|reference/.test(s)) return "reference-to-video";
  if (/video-?edit|video-to-video|v2v|extend|extension|motion|animate|transition|replace/.test(s)) return "video-to-video";
  if (/image-to-video|i2v/.test(s)) return "image-to-video";
  if (/text-to-video|t2v/.test(s)) return "text-to-video";
  if (/image-to-image|i2i/.test(s)) return "image-to-image";
  if (/text-to-image|t2i/.test(s)) return "text-to-image";
  if (/edit|remix|inpaint|segment/.test(s)) return "edit";
  // Sinon on regarde si une image est obligatoire dans le schéma
  if (m.category === "image") return hasImage(required) ? "image-to-image" : "text-to-image";
  if (m.category === "video") return hasImage(required) ? "image-to-video" : "text-to-video";
  return "other";
}
