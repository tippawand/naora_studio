import { asc, eq } from "drizzle-orm";
import { apiTokens, db, models, users } from "@/db";
import AdminPanel from "@/components/AdminPanel";
import { requireAdmin } from "@/lib/session";
import { SETTING_KEYS, settingsStatus } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireAdmin();
  const [status, userList, modelList, tokenList] = await Promise.all([
    settingsStatus(),
    db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users).orderBy(asc(users.createdAt)),
    db.select({ id: models.id, name: models.name, provider: models.provider, category: models.category, enabled: models.enabled }).from(models).orderBy(asc(models.category), asc(models.provider), asc(models.name)),
    db
      .select({ id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix, lastUsedAt: apiTokens.lastUsedAt, createdAt: apiTokens.createdAt, email: users.email })
      .from(apiTokens)
      .innerJoin(users, eq(users.id, apiTokens.userId))
      .orderBy(asc(apiTokens.createdAt)),
  ]);
  const fields = Object.entries(SETTING_KEYS).map(([key, v]) => ({ key, ...v, ...status[key] }));
  return <AdminPanel meId={me.id} fields={fields} users={userList} models={modelList} tokens={tokenList.map((t) => ({ ...t, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }))} />;
}
