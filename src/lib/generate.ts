import { eq } from "drizzle-orm";
import { db, generations, models } from "@/db";
import { fixModel } from "./model-fixes";
import { checkQuota, validateInput } from "./guard";
import { createTask } from "./kie";

/** Retire les champs vides pour que Kie applique ses valeurs par défaut. */
function clean(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)),
  );
}

export type StartResult =
  | { ok: true; gen: typeof generations.$inferSelect }
  | { ok: false; status: number; error: string };

/** Logique commune à l'interface web et au serveur MCP. */
export async function startGeneration(userId: string, modelId: string, rawInput: Record<string, unknown>, origin?: string): Promise<StartResult> {
  const [row] = await db.select().from(models).where(eq(models.id, modelId));
  if (!row || !row.enabled) return { ok: false, status: 404, error: "Modèle introuvable" };

  const model = fixModel(row);
  const input = clean(rawInput);
  const invalid = validateInput(input);
  if (invalid) return { ok: false, status: 400, error: invalid };
  const quota = await checkQuota(userId);
  if (quota) return { ok: false, status: 429, error: quota };
  const missing = model.requiredInputs.filter((k) => input[k] === undefined);
  if (missing.length) return { ok: false, status: 400, error: `Champs requis : ${missing.join(", ")}` };

  const callback = origin?.startsWith("https://") ? `${origin}/api/webhook/kie` : undefined;
  try {
    const { taskId } = await createTask(model.id, input, callback);
    const [gen] = await db.insert(generations).values({ userId, modelId: model.id, input, taskId }).returning();
    return { ok: true, gen };
  } catch (e) {
    return { ok: false, status: 502, error: (e as Error).message };
  }
}
