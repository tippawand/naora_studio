import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, oauthClients, oauthCodes, oauthTokens, users } from "@/db";

/**
 * OAuth 2.1 (code + PKCE S256, clients publics, enregistrement dynamique) pour le connecteur MCP
 * de claude.ai, Claude Desktop, ChatGPT… Les jetons ne sont stockés que hachés (SHA-256).
 */

export const ACCESS_TTL_S = 60 * 60; // 1 h
export const REFRESH_TTL_S = 30 * 24 * 60 * 60; // 30 jours
export const CODE_TTL_S = 10 * 60; // 10 min

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`;
export const originOf = (req: Request) => new URL(req.url).origin;

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};
export const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

export function resourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  };
}

export function authServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
}

/** https, boucle locale (Claude Code, Cursor…) ou schémas d'applications connues. Jamais javascript:/data:. */
export function isAllowedRedirectUri(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash || raw.length > 500) return false;
  if (u.protocol === "https:") return !u.username && !u.password;
  if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  return ["cursor:", "vscode:", "vscode-insiders:", "claude:"].includes(u.protocol);
}

export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43,128}$/;

export function pkceOk(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

export type AuthorizeParams = {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
};

/** Vérifie la requête d'autorisation. En cas d'erreur on N'effectue PAS de redirection (client/URI non fiables). */
export async function validateAuthorize(p: AuthorizeParams) {
  if (!p.client_id) return { error: "client_id manquant" } as const;
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, p.client_id));
  if (!client) return { error: "Application inconnue" } as const;
  if (!client.redirectUris.includes(p.redirect_uri)) return { error: "redirect_uri non enregistrée" } as const;
  if (p.response_type !== "code") return { error: "response_type non supporté" } as const;
  if (p.code_challenge_method !== "S256" || !CHALLENGE_RE.test(p.code_challenge)) {
    return { error: "PKCE (S256) obligatoire" } as const;
  }
  if (p.state.length > 2000) return { error: "state trop long" } as const;
  return { client } as const;
}

export async function createAuthCode(userId: string, p: AuthorizeParams) {
  const code = randomToken("mac_");
  await db.insert(oauthCodes).values({
    codeHash: sha256(code),
    clientId: p.client_id,
    userId,
    redirectUri: p.redirect_uri,
    codeChallenge: p.code_challenge,
    expiresAt: new Date(Date.now() + CODE_TTL_S * 1000),
  });
  return code;
}

export async function issueTokens(clientId: string, userId: string) {
  const access = randomToken("mat_");
  const refresh = randomToken("mrt_");
  const now = Date.now();
  await db.insert(oauthTokens).values([
    { tokenHash: sha256(access), kind: "access", clientId, userId, expiresAt: new Date(now + ACCESS_TTL_S * 1000) },
    { tokenHash: sha256(refresh), kind: "refresh", clientId, userId, expiresAt: new Date(now + REFRESH_TTL_S * 1000) },
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: "mcp" };
}

/** Utilisé par la route MCP pour les jetons `mat_…`. */
export async function userFromOauthToken(token: string) {
  const [row] = await db
    .select({ tokenId: oauthTokens.id, id: users.id, email: users.email, role: users.role })
    .from(oauthTokens)
    .innerJoin(users, eq(users.id, oauthTokens.userId))
    .where(and(eq(oauthTokens.tokenHash, sha256(token)), eq(oauthTokens.kind, "access"), gt(oauthTokens.expiresAt, new Date())));
  if (!row) return null;
  await db.update(oauthTokens).set({ lastUsedAt: new Date() }).where(eq(oauthTokens.id, row.tokenId));
  return { id: row.id, email: row.email, role: row.role };
}

export async function pruneExpired() {
  const now = new Date();
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));
  await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
}
