import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, favorites } from "@/db";
import { apiUser } from "@/lib/session";

const Body = z.object({ modelId: z.string(), on: z.boolean() });

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  if (b.data.on) {
    await db.insert(favorites).values({ userId: user.id, modelId: b.data.modelId }).onConflictDoNothing();
  } else {
    await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.modelId, b.data.modelId)));
  }
  return NextResponse.json({ ok: true });
}
