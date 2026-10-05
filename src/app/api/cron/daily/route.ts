import { and, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, generations } from "@/db";
import { getSetting } from "@/lib/settings";
import { syncModels } from "@/lib/sync";

export const maxDuration = 60;

// Vercel Cron (voir vercel.json) : synchro des modèles + nettoyage des générations non gardées.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const ok = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!ok) return NextResponse.json({ error: "Interdit" }, { status: 401 });

  const sync = await syncModels().catch((e) => ({ error: (e as Error).message }));
  const days = Number(await getSetting("retentionDays")) || 30;
  const cutoff = new Date(Date.now() - days * 86400_000);
  await db.delete(generations).where(and(eq(generations.kept, false), lt(generations.createdAt, cutoff)));
  return NextResponse.json({ sync });
}
