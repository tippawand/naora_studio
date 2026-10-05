import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { db, users } from "@/db";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) redirect("/login");
  return <AuthForm mode="setup" />;
}
