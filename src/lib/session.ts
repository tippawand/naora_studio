import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  return s.user;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/studio");
  return u;
}

/** Pour les route handlers : renvoie null si non connecté. */
export async function apiUser(adminOnly = false) {
  const s = await auth();
  if (!s?.user) return null;
  if (adminOnly && s.user.role !== "admin") return null;
  return s.user;
}
