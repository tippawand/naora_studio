import { and, count, eq, gt, notInArray } from "drizzle-orm";
import { db, generations } from "@/db";

/** Limiteur en mémoire (par instance serverless) : freine le brute force sans table dédiée. */
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

const MAX_JSON = 100_000;
const MAX_STRING = 20_000;
const MAX_ARRAY = 50;
const MAX_DEPTH = 6;

function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.includes(":") || // IPv6 littérale
    /^\d+(\.\d+){3}$/.test(h) // IPv4 littérale
  );
}

/** Valide `input` avant envoi à Kie : taille bornée, URLs en https public uniquement. Renvoie un message d'erreur ou null. */
export function validateInput(input: unknown): string | null {
  let size = 0;
  try {
    size = JSON.stringify(input).length;
  } catch {
    return "Paramètres invalides";
  }
  if (size > MAX_JSON) return "Paramètres trop volumineux";

  const walk = (v: unknown, depth: number): string | null => {
    if (depth > MAX_DEPTH) return "Paramètres trop imbriqués";
    if (typeof v === "string") {
      if (v.length > MAX_STRING) return "Texte trop long";
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
        let u: URL;
        try {
          u = new URL(v);
        } catch {
          return "URL invalide";
        }
        if (u.protocol !== "https:") return "Seules les URLs https:// sont autorisées";
        if (u.username || u.password || isPrivateHost(u.hostname)) return "URL non autorisée";
      }
      return null;
    }
    if (Array.isArray(v)) {
      if (v.length > MAX_ARRAY) return "Liste trop longue";
      for (const x of v) {
        const e = walk(x, depth + 1);
        if (e) return e;
      }
      return null;
    }
    if (v && typeof v === "object") {
      for (const x of Object.values(v)) {
        const e = walk(x, depth + 1);
        if (e) return e;
      }
    }
    return null;
  };
  return walk(input, 0);
}

const DAILY_LIMIT = Number(process.env.GENERATION_DAILY_LIMIT) || 1000;
const INFLIGHT_LIMIT = Number(process.env.GENERATION_INFLIGHT_LIMIT) || 20;

/** Quotas par utilisateur : générations par 24 h et générations simultanées. Renvoie un message d'erreur ou null. */
export async function checkQuota(userId: string): Promise<string | null> {
  const day = new Date(Date.now() - 86_400_000);
  const [{ daily }] = await db
    .select({ daily: count() })
    .from(generations)
    .where(and(eq(generations.userId, userId), gt(generations.createdAt, day)));
  if (daily >= DAILY_LIMIT) return `Quota atteint : ${DAILY_LIMIT} générations par 24 h`;

  const recent = new Date(Date.now() - 15 * 60_000);
  const [{ inflight }] = await db
    .select({ inflight: count() })
    .from(generations)
    .where(and(eq(generations.userId, userId), gt(generations.createdAt, recent), notInArray(generations.state, ["success", "fail"])));
  if (inflight >= INFLIGHT_LIMIT) return `Trop de générations en cours (max ${INFLIGHT_LIMIT}), réessayez dans un instant`;
  return null;
}
