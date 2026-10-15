import { db, oauthClients } from "@/db";
import { clientIp, rateLimited } from "@/lib/guard";
import { CORS, isAllowedRedirectUri, NO_STORE, randomToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const headers = { ...CORS, ...NO_STORE };
const bad = (error: string, description: string) => Response.json({ error, error_description: description }, { status: 400, headers });

/** Enregistrement dynamique de client (RFC 7591) : clients publics uniquement (PKCE, pas de secret). */
export async function POST(req: Request) {
  if (rateLimited(`oauth-register:${clientIp(req)}`, 20, 60 * 60_000)) {
    return Response.json({ error: "temporarily_unavailable" }, { status: 429, headers });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("invalid_client_metadata", "JSON attendu");
  const uris: unknown = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 5 || !uris.every((u) => typeof u === "string" && isAllowedRedirectUri(u))) {
    return bad("invalid_redirect_uri", "redirect_uris invalides (https ou boucle locale uniquement, 5 max)");
  }
  const name = typeof body.client_name === "string" ? body.client_name.slice(0, 100) : null;
  const id = randomToken("mcp_").slice(0, 30);
  await db.insert(oauthClients).values({ id, name, redirectUris: uris as string[] });
  return Response.json(
    {
      client_id: id,
      client_name: name ?? undefined,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
