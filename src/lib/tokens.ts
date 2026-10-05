import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { apiTokens, db, users } from "@/db";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Renvoie le jeton en clair UNE seule fois ; seule l'empreinte est stockée. */
export async function createApiToken(userId: string, name: string) {
  const token = `ks_${randomBytes(24).toString("base64url")}`;
  await db.insert(apiTokens).values({ userId, name, tokenHash: hash(token), prefix: token.slice(0, 7) });
  return token;
}

export async function userFromBearer(header: string | null) {
  const token = header?.match(/^Bearer\s+(ks_\S+)$/i)?.[1];
  if (!token) return null;
  const [row] = await db
    .select({ tokenId: apiTokens.id, id: users.id, email: users.email, role: users.role })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, hash(token)));
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  return { id: row.id, email: row.email, role: row.role };
}
