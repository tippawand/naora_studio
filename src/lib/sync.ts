import { asc, eq } from "drizzle-orm";
import { db, models } from "@/db";
import { fetchCatalog, fetchModelPage, type ParsedModel } from "./kie-docs";

const MAX_PER_RUN = 70; // reste sous la limite de durée d'une fonction Vercel
const REFRESH_PER_RUN = 10; // re-lit aussi les plus anciennes specs (paramètres modifiés)

export type SyncResult = { added: string[]; updated: number; remaining: number; failed: number };

export async function syncModels(): Promise<SyncResult> {
  const catalog = await fetchCatalog();
  const existing = await db.select({ docUrl: models.docUrl, syncedAt: models.syncedAt, description: models.description }).from(models).orderBy(asc(models.syncedAt));
  const known = new Set(existing.map((e) => e.docUrl));

  const fresh = catalog.filter((c) => !known.has(c.docUrl));
  // On relit en priorité les modèles sans description (anciennes synchros), puis les plus anciens.
  const staleEntries = [...existing.filter((e) => e.description === null).slice(0, MAX_PER_RUN), ...existing.slice(0, REFRESH_PER_RUN)]
    .map((e) => catalog.find((c) => c.docUrl === e.docUrl))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const todo = [...new Map([...fresh.slice(0, MAX_PER_RUN), ...staleEntries].map((c) => [c.docUrl, c])).values()];
  const queue = [...todo];
  const parsed = new Map<string, ParsedModel>();
  let failed = 0;

  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const entry = queue.shift()!;
        const m = await fetchModelPage(entry).catch(() => null);
        if (!m) {
          failed++;
          continue;
        }
        // Plusieurs pages peuvent déclarer le même id : on garde celle dont l'URL porte le nom du modèle.
        const prev = parsed.get(m.id);
        const tail = m.id.split("/").pop()!;
        if (!prev || (m.docUrl.endsWith(`/${tail}.md`) && !prev.docUrl.endsWith(`/${tail}.md`))) {
          parsed.set(m.id, m);
        }
      }
    }),
  );

  const added: string[] = [];
  for (const m of parsed.values()) {
    const isNew = !known.has(m.docUrl);
    await db
      .insert(models)
      .values({
        id: m.id,
        name: m.title,
        provider: m.provider,
        description: m.description,
        category: m.category,
        docUrl: m.docUrl,
        inputSchema: m.inputSchema,
        requiredInputs: m.requiredInputs,
      })
      .onConflictDoUpdate({
        target: models.id,
        set: {
          name: m.title,
          provider: m.provider,
          description: m.description,
          category: m.category,
          docUrl: m.docUrl,
          inputSchema: m.inputSchema,
          requiredInputs: m.requiredInputs,
          syncedAt: new Date(),
        },
      });
    if (isNew) added.push(m.id);
  }

  return {
    added,
    updated: parsed.size - added.length,
    remaining:
      Math.max(0, fresh.length - MAX_PER_RUN) +
      Math.max(0, existing.filter((e) => e.description === null).length - MAX_PER_RUN),
    failed,
  };
}

/** Relit la spec d'un seul modèle depuis la doc Kie et met à jour son schéma. */
export async function syncOneModel(id: string) {
  const [row] = await db.select().from(models).where(eq(models.id, id));
  if (!row) return null;
  const m = await fetchModelPage({ title: row.name, provider: row.provider ?? "", category: row.category, docUrl: row.docUrl });
  if (!m) throw new Error("Impossible de relire la documentation Kie pour ce modèle");
  const [updated] = await db
    .update(models)
    .set({
      name: m.title,
      provider: m.provider,
      description: m.description,
      category: m.category,
      inputSchema: m.inputSchema,
      requiredInputs: m.requiredInputs,
      syncedAt: new Date(),
    })
    .where(eq(models.id, id))
    .returning();
  return updated;
}
