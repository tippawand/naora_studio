import { desc, eq, ilike, or, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, generations, models } from "@/db";
import { startGeneration } from "@/lib/generate";
import { refreshGeneration } from "@/lib/generations";
import { getCredits } from "@/lib/kie";
import { fixModel, hasNoParams } from "@/lib/model-fixes";
import { clientIp, rateLimited } from "@/lib/guard";
import { imagePreviews } from "@/lib/preview";
import { userFromBearer } from "@/lib/tokens";

export const maxDuration = 60;

/**
 * Serveur MCP (Streamable HTTP, sans état) : permet à Claude / ChatGPT / Cursor… d'utiliser
 * MAS Studio comme passerelle. La clé API Kie reste côté serveur ; chaque utilisateur a son jeton.
 */

type User = { id: string; email: string; role: "admin" | "member" };
type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const TOOLS = [
  {
    name: "list_models",
    description: "Liste les modèles de génération disponibles (image, vidéo, audio). Filtrable par catégorie ou mot-clé.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["image", "video", "audio"] },
        search: { type: "string", description: "Mot-clé dans le nom, le fournisseur ou l'id" },
      },
    },
  },
  {
    name: "get_model",
    description: "Détail d'un modèle : description, paramètres acceptés (schéma `input`), champs requis et coût moyen observé.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "generate",
    description:
      "Lance une génération. `input` doit respecter le schéma renvoyé par get_model (prompt, aspect_ratio, image_urls…). " +
      "Avec wait=true (défaut), attend jusqu'à ~40 s et renvoie les URLs (+ un aperçu des images) ; sinon (ou si c'est plus long) renvoie un generationId à interroger avec get_generation.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Id du modèle (voir list_models)" },
        input: { type: "object", description: "Paramètres du modèle" },
        wait: { type: "boolean", default: true },
      },
      required: ["model", "input"],
    },
  },
  {
    name: "get_generation",
    description: "État et résultat (URLs, crédits consommés) d'une génération, avec un aperçu des images une fois terminée.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_generations",
    description: "Dernières générations de l'équipe (ou seulement les vôtres).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 10 }, mine: { type: "boolean", default: false } },
    },
  },
  { name: "get_credits", description: "Solde de crédits Kie.AI du compte.", inputSchema: { type: "object", properties: {} } },
];

const text = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const fail = (msg: string) => ({ isError: true, content: [{ type: "text", text: msg }] });

const brief = (g: typeof generations.$inferSelect) => ({
  id: g.id,
  model: g.modelId,
  state: g.state,
  urls: g.storedUrls?.length ? g.storedUrls : (g.resultUrls ?? []),
  credits: g.credits,
  error: g.error,
  createdAt: g.createdAt,
});

/** Résultat d'une génération : JSON + aperçus des images si elle a réussi. */
async function withPreviews(g: typeof generations.$inferSelect) {
  const b = brief(g);
  const res = text(b);
  if (g.state !== "success") return res;
  return { content: [...res.content, ...(await imagePreviews(b.urls))] };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callTool(name: string, a: Record<string, unknown>, user: User, origin: string) {
  switch (name) {
    case "list_models": {
      const conds = [eq(models.enabled, true)];
      if (a.category) conds.push(eq(models.category, a.category as (typeof models.$inferSelect)["category"]));
      if (a.search) {
        const q = `%${a.search}%`;
        conds.push(or(ilike(models.name, q), ilike(models.provider, q), ilike(models.id, q))!);
      }
      const rows = await db
        .select()
        .from(models)
        .where(and(...conds))
        .orderBy(models.category, models.name);
      return text(
        rows
          .map(fixModel)
          .filter((m) => !hasNoParams(m))
          .map((m) => ({ id: m.id, name: m.name, provider: m.provider, category: m.category, description: m.description?.slice(0, 160) || undefined })),
      );
    }
    case "get_model": {
      const [row] = await db.select().from(models).where(eq(models.id, String(a.id)));
      if (!row) return fail("Modèle introuvable");
      const m = fixModel(row);
      const costs = await db.select({ c: generations.credits }).from(generations).where(eq(generations.modelId, m.id));
      const vals = costs.map((c) => c.c).filter((c): c is number => typeof c === "number");
      return text({
        id: m.id,
        name: m.name,
        category: m.category,
        description: m.description,
        docs: m.docUrl.replace(/\.md$/, ""),
        required: m.requiredInputs,
        input: m.inputSchema,
        avgCredits: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
      });
    }
    case "generate": {
      const r = await startGeneration(user.id, String(a.model), (a.input ?? {}) as Record<string, unknown>, origin);
      if (!r.ok) return fail(r.error);
      let gen = r.gen;
      if (a.wait !== false) {
        const deadline = Date.now() + 40_000; // garde ~20 s pour les aperçus (maxDuration 60 s)
        while (!["success", "fail"].includes(gen.state) && Date.now() < deadline) {
          await sleep(3000);
          gen = await refreshGeneration(gen).catch(() => gen);
        }
      }
      return withPreviews(gen);
    }
    case "get_generation": {
      const [g] = await db.select().from(generations).where(eq(generations.id, String(a.id)));
      if (!g) return fail("Génération introuvable");
      return withPreviews(await refreshGeneration(g).catch(() => g));
    }
    case "list_generations": {
      const q = db.select().from(generations).orderBy(desc(generations.createdAt)).limit(Math.min(Number(a.limit) || 10, 50));
      const rows = await (a.mine ? q.where(eq(generations.userId, user.id)) : q);
      return text(rows.map(brief));
    }
    case "get_credits":
      if (user.role !== "admin") return fail("Réservé aux administrateurs");
      return text({ credits: await getCredits() });
    default:
      return fail(`Outil inconnu : ${name}`);
  }
}

async function handle(msg: Rpc, user: User, origin: string) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0" as const, id: msg.id ?? null, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0" as const, id: msg.id ?? null, error: { code, message } });
  switch (msg.method) {
    case "initialize":
      return ok({
        protocolVersion: msg.params?.protocolVersion ?? "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "mas-studio", version: "1.0.0" },
        instructions: "Passerelle Kie.AI : list_models → get_model → generate. Les URLs générées expirent chez Kie après ~24h. generate / get_generation joignent un aperçu des images (JPEG réduit) : inutile de télécharger les URLs pour les voir.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call":
      try {
        return ok(await callTool(String(msg.params?.name), (msg.params?.arguments ?? {}) as Record<string, unknown>, user, origin));
      } catch (e) {
        return ok(fail((e as Error).message));
      }
    default:
      return msg.id === undefined ? null : err(-32601, `Méthode inconnue : ${msg.method}`);
  }
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimited(`mcp-ip:${ip}`, 600, 60_000)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const user = await userFromBearer(req.headers.get("authorization"));
  if (!user) {
    if (rateLimited(`mcp-fail:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: { "Retry-After": "60" } });
    }
    return NextResponse.json({ error: "Jeton invalide" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } }, { status: 400 });
  const origin = new URL(req.url).origin;

  if (Array.isArray(body)) {
    if (body.length > 5) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Lot limité à 5 requêtes" } }, { status: 400 });
    const out = (await Promise.all(body.map((m) => handle(m, user, origin)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new Response(null, { status: 202 });
  }
  const res = await handle(body, user, origin);
  return res ? NextResponse.json(res) : new Response(null, { status: 202 });
}

export async function GET() {
  return new Response("Serveur MCP sans état : utiliser POST.", { status: 405, headers: { Allow: "POST" } });
}
