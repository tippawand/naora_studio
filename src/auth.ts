import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { rateLimited } from "@/lib/guard";

declare module "next-auth" {
  interface User {
    role?: "admin" | "member";
  }
  interface Session {
    user: { id: string; role: "admin" | "member"; email: string; name?: string | null };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const p = z.object({ email: z.email(), password: z.string().min(1) }).safeParse(raw);
        if (!p.success) return null;
        if (rateLimited(`login:${p.data.email.toLowerCase()}`, 8, 15 * 60_000)) return null;
        const [u] = await db.select().from(users).where(eq(users.email, p.data.email.toLowerCase()));
        if (!u || !(await bcrypt.compare(p.data.password, u.passwordHash))) return null;
        return { id: u.id, email: u.email, name: u.name, role: u.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = (token.role as "admin" | "member") ?? "member";
      return session;
    },
  },
});
