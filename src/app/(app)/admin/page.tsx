import { asc, eq, gt, max, min } from "drizzle-orm";
import { apiTokens, db, models, oauthClients, oauthTokens, users } from "@/db";
import AdminPanel from "@/components/AdminPanel";
import { requireAdmin } from "@/lib/session";
import { SETTING_KEYS, settingsStatus } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireAdmin();
  const [status, userList, modelList, tokenList, oauthList] = await Promise.all([
    settingsStatus(),
    db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users).orderBy(asc(users.createdAt)),
    db.select({ id: models.id, name: models.name, provider: models.provider, category: models.category, enabled: models.enabled }).from(models).orderBy(asc(models.category), asc(models.provider), asc(models.name)),
    db
      .select({ id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix, lastUsedAt: apiTokens.lastUsedAt, createdAt: apiTokens.createdAt, email: users.email })
      .from(apiTokens)
      .innerJoin(users, eq(users.id, apiTokens.userId))
      .orderBy(asc(apiTokens.createdAt)),
    // Connexions OAuth actives : une ligne par (utilisateur, application), tant qu'un jeton n'a pas expiré
    db
      .select({ userId: oauthTokens.userId, clientId: oauthTokens.clientId, name: oauthClients.name, email: users.email, lastUsedAt: max(oauthTokens.lastUsedAt), createdAt: min(oauthTokens.createdAt) })
      .from(oauthTokens)
      .innerJoin(users, eq(users.id, oauthTokens.userId))
      .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
      .where(gt(oauthTokens.expiresAt, new Date()))
      .groupBy(oauthTokens.userId, oauthTokens.clientId, oauthClients.name, users.email)
      .orderBy(asc(users.email)),
  ]);
  const fields = Object.entries(SETTING_KEYS).map(([key, v]) => ({ key, ...v, ...status[key] }));
  return (
    <AdminPanel
      meId={me.id}
      fields={fields}
      users={userList}
      models={modelList}
      tokens={tokenList.map((t) => ({ ...t, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }))}
      oauth={oauthList.map((o) => ({ ...o, lastUsedAt: o.lastUsedAt?.toISOString() ?? null, createdAt: o.createdAt?.toISOString() ?? null }))}
    />
  );
}
