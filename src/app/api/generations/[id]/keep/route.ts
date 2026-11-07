import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, generations, models } from "@/db";
import { apiUser } from "@/lib/session";
import { storageConfigured, storeFromUrl } from "@/lib/storage";

export const maxDuration = 60;

/** "Garder" : copie les résultats vers le stockage (si configuré) avant l'expiration Kie. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await ctx.params;
  const [gen] = await db.select().from(generations).where(eq(generations.id, id));
  if (gen && gen.userId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  if (!gen?.resultUrls?.length) return NextResponse.json({ error: "Rien à garder" }, { status: 400 });
  const [model] = await db.select().from(models).where(eq(models.id, gen.modelId));

  let stored = gen.storedUrls;
  if (!stored?.length && (await storageConfigured())) {
    try {
      const out = await Promise.all(
        gen.resultUrls.map((u) => storeFromUrl(u, `naora-studio/${gen.modelId.replace(/\//g, "_")}`, model?.category ?? "image")),
      );
      stored = out.map((o) => o.url);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }
  const [row] = await db
    .update(generations)
    .set({ kept: true, storedUrls: stored ?? null })
    .where(eq(generations.id, id))
    .returning();
  return NextResponse.json({ ...row, storage: !!stored?.length });
}
