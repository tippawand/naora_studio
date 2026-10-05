import { NextResponse } from "next/server";
import { z } from "zod";
import { fixModel } from "@/lib/model-fixes";
import { rateLimited } from "@/lib/guard";
import { apiUser } from "@/lib/session";
import { syncOneModel } from "@/lib/sync";

export const maxDuration = 30;

const Body = z.object({ id: z.string().min(1).max(200) });

// Resynchronise un seul modèle (schéma, champs requis, description) depuis la doc Kie.
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  if (rateLimited(`resync:${user.id}`, 20, 60_000)) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  try {
    const row = await syncOneModel(body.data.id);
    if (!row) return NextResponse.json({ error: "Modèle introuvable" }, { status: 404 });
    const m = fixModel(row);
    return NextResponse.json({
      id: m.id,
      name: m.name,
      description: m.description,
      inputSchema: m.inputSchema,
      requiredInputs: m.requiredInputs,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
