import { createHash } from "node:crypto";
import { getSetting } from "./settings";

/**
 * Stockage optionnel. Si Cloudinary n'est pas configuré dans Admin > Settings,
 * les médias restent sur Kie (~24h) et l'utilisateur les télécharge à la main.
 * Pour changer de fournisseur (R2, B2…), ne modifier que ce fichier.
 */
export async function storageConfigured() {
  const [n, k, s] = await Promise.all([
    getSetting("cloudinaryCloudName"),
    getSetting("cloudinaryApiKey"),
    getSetting("cloudinaryApiSecret"),
  ]);
  return n && k && s ? { cloud: n, key: k, secret: s } : null;
}

/** Cloudinary va chercher le fichier lui-même depuis l'URL Kie (rien ne transite par Vercel). */
export async function storeFromUrl(url: string, folder: string, kind: "image" | "video" | "audio") {
  const cfg = await storageConfigured();
  if (!cfg) throw new Error("Stockage non configuré (Admin > Settings)");
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + cfg.secret).digest("hex");
  const form = new FormData();
  form.set("file", url);
  form.set("folder", folder);
  form.set("timestamp", String(timestamp));
  form.set("api_key", cfg.key);
  form.set("signature", signature);
  const resource = kind === "image" ? "image" : "video"; // audio = "video" chez Cloudinary
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/${resource}/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Upload Cloudinary échoué");
  return { url: json.secure_url as string, publicId: json.public_id as string, resource };
}

export async function deleteStored(publicId: string, resource: string) {
  const cfg = await storageConfigured();
  if (!cfg) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${cfg.secret}`)
    .digest("hex");
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("timestamp", String(timestamp));
  form.set("api_key", cfg.key);
  form.set("signature", signature);
  await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/${resource}/destroy`, { method: "POST", body: form });
}
