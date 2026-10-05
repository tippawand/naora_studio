import { eq } from "drizzle-orm";
import { db, settings } from "@/db";
import { decrypt, encrypt } from "./crypto";

// Clés gérées depuis Admin > Settings. Rien de tout ça n'est en variable d'env.
export const SETTING_KEYS = {
  kieApiKey: { label: "Clé API Kie.AI", secret: true },
  kieWebhookHmacKey: { label: "Clé HMAC webhook Kie (optionnel)", secret: true },
  cloudinaryCloudName: { label: "Cloudinary — cloud name", secret: false },
  cloudinaryApiKey: { label: "Cloudinary — API key", secret: true },
  cloudinaryApiSecret: { label: "Cloudinary — API secret", secret: true },
  retentionDays: { label: "Jours avant suppression des générations non gardées (défaut 30)", secret: false },
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;

export async function getSetting(k: SettingKey): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, k));
  if (!row) return null;
  try {
    return decrypt(row.value);
  } catch {
    return null;
  }
}

export async function setSetting(k: SettingKey, value: string) {
  const enc = encrypt(value);
  await db
    .insert(settings)
    .values({ key: k, value: enc })
    .onConflictDoUpdate({ target: settings.key, set: { value: enc, updatedAt: new Date() } });
}

export async function clearSetting(k: SettingKey) {
  await db.delete(settings).where(eq(settings.key, k));
}

/** Pour l'UI : indique seulement si c'est configuré, jamais la valeur d'un secret. */
export async function settingsStatus() {
  const rows = await db.select().from(settings);
  const out: Record<string, { set: boolean; preview?: string }> = {};
  for (const k of Object.keys(SETTING_KEYS) as SettingKey[]) {
    const row = rows.find((r) => r.key === k);
    if (!row) {
      out[k] = { set: false };
      continue;
    }
    let preview: string | undefined;
    if (!SETTING_KEYS[k].secret) {
      try {
        preview = decrypt(row.value);
      } catch {}
    }
    out[k] = { set: true, preview };
  }
  return out;
}
