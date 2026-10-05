import { NextResponse } from "next/server";
import { z } from "zod";
import { startGeneration } from "@/lib/generate";
import { apiUser } from "@/lib/session";

const Body = z.object({ modelId: z.string(), input: z.record(z.string(), z.unknown()) });

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const r = await startGeneration(user.id, body.data.modelId, body.data.input, new URL(req.url).origin);
  return r.ok ? NextResponse.json(r.gen) : NextResponse.json({ error: r.error }, { status: r.status });
}
