"use server";

import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { apiTokens, db, models, users } from "@/db";
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

export async function deleteUserAction(id: string) {
  const me = await requireAdmin();
  if (me.id === id) return;
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
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!u) return { error: "Utilisateur introuvable" };
  const token = await createApiToken(u.id, name);
  revalidatePath("/admin");
  return { ok: "Jeton créé — copiez-le maintenant, il ne sera plus affiché.", token };
}

export async function revokeTokenAction(id: string) {
  await requireAdmin();
  await db.delete(apiTokens).where(eq(apiTokens.id, id));
  revalidatePath("/admin");
}
