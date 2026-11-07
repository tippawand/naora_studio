import { and, eq } from "drizzle-orm";
import { db, oauthCodes, oauthTokens } from "@/db";
import { clientIp, rateLimited } from "@/lib/guard";
import { CORS, isActiveUser, issueTokens, NO_STORE, pkceOk, sha256 } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const headers = { ...CORS, ...NO_STORE };
const err = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers });

export async function POST(req: Request) {
  if (rateLimited(`oauth-token:${clientIp(req)}`, 60, 60_000)) return err("temporarily_unavailable", "Trop de requêtes", 429);

  const ct = req.headers.get("content-type") ?? "";
  let raw: Record<string, unknown> = {};
  if (ct.includes("json")) raw = (await req.json().catch(() => ({}))) ?? {};
  else raw = Object.fromEntries(new URLSearchParams(await req.text()));
  const p = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");

  const grant = p("grant_type");

  if (grant === "authorization_code") {
    const code = p("code");
    if (!code) return err("invalid_request", "code manquant");
    // Suppression atomique : un code ne sert qu'une fois.
    const [row] = await db.delete(oauthCodes).where(eq(oauthCodes.codeHash, sha256(code))).returning();
    if (!row || row.expiresAt < new Date()) return err("invalid_grant", "Code invalide ou expiré");
    if (row.clientId !== p("client_id") || row.redirectUri !== p("redirect_uri")) return err("invalid_grant", "client_id / redirect_uri incohérents");
    if (!pkceOk(p("code_verifier"), row.codeChallenge)) return err("invalid_grant", "PKCE invalide");
    if (!(await isActiveUser(row.userId))) return err("invalid_grant", "Compte désactivé");
    return Response.json(await issueTokens(row.clientId, row.userId), { headers });
  }

  if (grant === "refresh_token") {
    const rt = p("refresh_token");
    if (!rt) return err("invalid_request", "refresh_token manquant");
    // Rotation : l'ancien refresh token est consommé, seulement si le client_id (facultatif) correspond.
    const conds = [eq(oauthTokens.tokenHash, sha256(rt)), eq(oauthTokens.kind, "refresh")];
    if (p("client_id")) conds.push(eq(oauthTokens.clientId, p("client_id")));
    const [row] = await db
      .delete(oauthTokens)
      .where(and(...conds))
      .returning();
    if (!row || row.expiresAt < new Date()) return err("invalid_grant", "Refresh token invalide, expiré ou client_id incohérent");
    if (!(await isActiveUser(row.userId))) return err("invalid_grant", "Compte désactivé");
    return Response.json(await issueTokens(row.clientId, row.userId), { headers });
  }

  return err("unsupported_grant_type", "grant_type non supporté");
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
