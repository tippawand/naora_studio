"use server";

import bcrypt from "bcryptjs";
import { and, count, eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { apiTokens, db, generations, models, oauthCodes, oauthTokens, users } from "@/db";
import { requireAdmin } from "@/lib/session";
import { createApiToken } from "@/lib/tokens";
import { clearSetting, SETTING_KEYS, setSetting, type SettingKey } from "@/lib/settings";

type State = { error?: string; ok?: string } | undefined;

export async function loginAction(_: State, form: FormData): Promise<State> {
  try {
    await signIn("credentials", {
      email: String(form.get("email") ?? "").toLowerCase(),
      password: String(form.get("password") ?? ""),
      redirectTo: "/studio",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Email ou mot de passe incorrect" };
    throw e; // redirection
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const NewUser = z.object({
  email: z.email(),
  name: z.string().optional(),
  password: z.string().min(10, "10 caractères minimum"),
});

export async function setupAction(_: State, form: FormData): Promise<State> {
  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) return { error: "Déjà initialisé" };
  const p = NewUser.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.insert(users).values({
    email: p.data.email.toLowerCase(),
    name: p.data.name || null,
    passwordHash: await bcrypt.hash(p.data.password, 12),
    role: "admin",
  });
  redirect("/login");
}

export async function createUserAction(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const p = NewUser.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const role = form.get("role") === "admin" ? "admin" : "member";
  try {
    await db.insert(users).values({
      email: p.data.email.toLowerCase(),
      name: p.data.name || null,
      passwordHash: await bcrypt.hash(p.data.password, 12),
      role,
    });
  } catch {
    return { error: "Cet email existe déjà" };
  }
  revalidatePath("/admin");
  return { ok: "Utilisateur créé" };
}

/**
 * Départ d'un membre : le compte est bloqué partout (connexion, session en cours, jetons MCP, OAuth)
 * et ses jetons et codes OAuth sont supprimés. Ses générations restent (historique des coûts).
 */
export async function setUserDisabledAction(id: string, disabled: boolean) {
  const me = await requireAdmin();
  if (me.id === id) return;
  await db.update(users).set({ disabledAt: disabled ? new Date() : null }).where(eq(users.id, id));
  if (disabled) {
    await db.delete(apiTokens).where(eq(apiTokens.userId, id));
    await db.delete(oauthTokens).where(eq(oauthTokens.userId, id));
    await db.delete(oauthCodes).where(eq(oauthCodes.userId, id));
  }
  revalidatePath("/admin");
}

/** Suppression définitive, seulement pour un compte sans générations (sinon : désactiver). */
export async function deleteUserAction(id: string): Promise<State> {
  const me = await requireAdmin();
  if (me.id === id) return { error: "Impossible de supprimer votre propre compte" };
  const [{ n }] = await db.select({ n: count() }).from(generations).where(eq(generations.userId, id));
  if (n > 0) {
    return { error: `Ce compte a ${n} génération(s) : désactivez-le plutôt, pour conserver l'historique et les coûts.` };
  }
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin");
}

export async function saveSettingsAction(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  for (const k of Object.keys(SETTING_KEYS) as SettingKey[]) {
    const v = String(form.get(k) ?? "").trim();
    if (form.get(`clear_${k}`)) await clearSetting(k);
    else if (v) await setSetting(k, v); // champ vide = on garde la valeur actuelle
  }
  revalidatePath("/admin");
  return { ok: "Réglages enregistrés" };
}

export async function toggleModelAction(id: string, enabled: boolean) {
  await requireAdmin();
  await db.update(models).set({ enabled }).where(eq(models.id, id));
  revalidatePath("/admin");
  revalidatePath("/studio");
}

export async function createTokenAction(_: (State & { token?: string }) | undefined, form: FormData): Promise<State & { token?: string }> {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const name = String(form.get("name") ?? "").trim() || "MCP";
  const [u] = await db.select({ id: users.id, disabledAt: users.disabledAt }).from(users).where(eq(users.id, userId));
  if (!u) return { error: "Utilisateur introuvable" };
  if (u.disabledAt) return { error: "Ce compte est désactivé" };
  const token = await createApiToken(u.id, name);
  revalidatePath("/admin");
  return { ok: "Jeton créé — copiez-le maintenant, il ne sera plus affiché.", token };
}

export async function revokeTokenAction(id: string) {
  await requireAdmin();
  await db.delete(apiTokens).where(eq(apiTokens.id, id));
  revalidatePath("/admin");
}

/** Retire l'accès OAuth d'une application pour un utilisateur : jetons et codes en attente. */
export async function revokeOauthAction(userId: string, clientId: string) {
  await requireAdmin();
  await db.delete(oauthTokens).where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.clientId, clientId)));
  await db.delete(oauthCodes).where(and(eq(oauthCodes.userId, userId), eq(oauthCodes.clientId, clientId)));
  revalidatePath("/admin");
}
