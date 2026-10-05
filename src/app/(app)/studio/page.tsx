import { asc, avg, count, eq, isNotNull } from "drizzle-orm";
import { db, favorites, generations, models } from "@/db";
import { fixModel, hasNoParams } from "@/lib/model-fixes";
import { requireUser } from "@/lib/session";
import Studio from "@/components/Studio";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await requireUser();
  const [rawList, costs, favs] = await Promise.all([
    db
      .select({
        id: models.id,
        name: models.name,
        provider: models.provider,
        category: models.category,
        description: models.description,
        docUrl: models.docUrl,
        createdAt: models.createdAt,
        inputSchema: models.inputSchema,
        requiredInputs: models.requiredInputs,
      })
      .from(models)
      .where(eq(models.enabled, true))
      .orderBy(asc(models.provider), asc(models.name)),
    db
      .select({ id: generations.modelId, avg: avg(generations.credits), n: count() })
      .from(generations)
      .where(isNotNull(generations.credits))
      .groupBy(generations.modelId),
    db.select({ id: favorites.modelId }).from(favorites).where(eq(favorites.userId, user.id)),
  ]);
  const list = rawList.map(fixModel).filter((m) => !hasNoParams(m));
  // « Nouveau » = ajouté il y a moins de 14 jours, mais pas lors de la toute première synchro.
  const first = Math.min(...list.map((m) => m.createdAt.getTime()));
  const fresh = Date.now() - 14 * 86400_000;
  const withNew = list.map(({ createdAt, requiredInputs: _r, ...m }) => ({
    ...m,
    isNew: createdAt.getTime() > first + 36 * 3600_000 && createdAt.getTime() > fresh,
  }));
  const stats = Object.fromEntries(costs.map((c) => [c.id, { avg: Number(c.avg), n: c.n }]));
  return <Studio models={withNew as never} stats={stats} favorites={favs.map((f) => f.id)} />;
}
