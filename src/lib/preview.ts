import sharp from "sharp";

/**
 * Aperçus d'images pour les réponses MCP : le serveur télécharge le résultat (chez Kie ou Cloudinary)
 * et le renvoie en base64, pour que l'assistant voie l'image même si son bac à sable bloque ces domaines.
 * Les fichiers Kie font souvent 5-6 Mo : on les réduit (1568 px max, JPEG) pour rester sous la limite
 * de réponse Vercel (4,5 Mo). Vidéo, audio, erreurs ou fichiers trop lourds : ignorés (l'URL reste fournie).
 */

const MAX_IMAGES = 4;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const EDGE = 1568; // taille optimale pour la vision de Claude

export type ImageContent = { type: "image"; data: string; mimeType: "image/jpeg" };

async function preview(url: string): Promise<ImageContent | null> {
  if (!url.startsWith("https://")) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const type = res.headers.get("content-type") ?? "";
  const size = Number(res.headers.get("content-length") ?? 0);
  if (!res.ok || !type.startsWith("image/") || size > MAX_SOURCE_BYTES) {
    await res.body?.cancel();
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_SOURCE_BYTES) return null;
  const out = await sharp(buf)
    .rotate()
    .resize({ width: EDGE, height: EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { type: "image", data: out.toString("base64"), mimeType: "image/jpeg" };
}

export async function imagePreviews(urls: string[]): Promise<ImageContent[]> {
  const all = await Promise.all(urls.slice(0, MAX_IMAGES).map((u) => preview(u).catch(() => null)));
  return all.filter((x): x is ImageContent => x !== null);
}
