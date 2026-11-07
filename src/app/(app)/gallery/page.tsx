import { desc, eq } from "drizzle-orm";
import { db, generations, users } from "@/db";
import GalleryGrid from "@/components/GalleryGrid";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  await requireUser(); // le layout n'est pas réexécuté lors d'une navigation côté client
  const rows = await db
    .select({ g: generations, userName: users.name, userEmail: users.email })
    .from(generations)
    .innerJoin(users, eq(users.id, generations.userId))
    .where(eq(generations.state, "success"))
    .orderBy(desc(generations.createdAt))
    .limit(200);
  const gens = rows.map((r) => ({
    ...r.g,
    createdAt: r.g.createdAt.toISOString(),
    userName: r.userName || r.userEmail,
  }));
  return <GalleryGrid initial={gens as never} />;
}
