import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db, users } from "@/db";

/**
 * La session (JWT, 14 jours) est revérifiée en base à chaque requête : un compte désactivé ou supprimé
 * perd l'accès immédiatement, et le rôle est relu (une rétrogradation s'applique aussitôt).
 * Une seule lecture par clé primaire, mise en cache pour la durée de la requête (layout + page).
 */
export const currentUser = cache(async () => {
  const s = await auth();
  if (!s?.user?.id) return null;
  const [u] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.id, s.user.id), isNull(users.disabledAt)));
  return u ?? null;
});

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/studio");
  return u;
}

/** Pour les route handlers : renvoie null si non connecté. */
export async function apiUser(adminOnly = false) {
  const u = await currentUser();
  if (!u) return null;
  if (adminOnly && u.role !== "admin") return null;
  return u;
}
