import { eq } from "drizzle-orm";
import { db, generations } from "@/db";
import { getTask, parseResultUrls } from "./kie";

type Gen = typeof generations.$inferSelect;

const FINAL = new Set(["success", "fail"]);

/** Interroge Kie et met à jour la ligne tant que la tâche n'est pas terminée. */
export async function refreshGeneration(gen: Gen): Promise<Gen> {
  if (!gen.taskId || FINAL.has(gen.state)) return gen;
  const t = await getTask(gen.taskId);
  const patch: Partial<Gen> = { state: t.state };
  if (t.state === "success") {
    patch.resultUrls = parseResultUrls(t.resultJson);
    patch.finishedAt = new Date();
    if (typeof t.creditsConsumed === "number") patch.credits = t.creditsConsumed;
  } else if (t.state === "fail") {
    patch.error = t.failMsg || t.failCode || "Échec de la génération";
    patch.finishedAt = new Date();
  }
  const [row] = await db.update(generations).set(patch).where(eq(generations.id, gen.id)).returning();
  return row;
}

export async function refreshByTaskId(taskId: string) {
  const [gen] = await db.select().from(generations).where(eq(generations.taskId, taskId));
  return gen ? refreshGeneration(gen) : null;
}
