import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, generations } from "@/db";
import { refreshGeneration } from "@/lib/generations";
import { apiUser } from "@/lib/session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiUser())) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await ctx.params;
  const [gen] = await db.select().from(generations).where(eq(generations.id, id));
  if (!gen) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  try {
    return NextResponse.json(await refreshGeneration(gen));
  } catch (e) {
    return NextResponse.json({ ...gen, pollError: (e as Error).message });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await ctx.params;
  const [gen] = await db.select().from(generations).where(eq(generations.id, id));
  if (!gen) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (gen.userId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  await db.delete(generations).where(eq(generations.id, id));
  return NextResponse.json({ ok: true });
}
