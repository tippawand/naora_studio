import Link from "next/link";
import { logoutAction } from "@/app/actions";
import Brand from "@/components/Brand";
import Credits from "@/components/Credits";
import ThemeToggle from "@/components/ThemeToggle";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const link = "rounded-md px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white";
  return (
    <div className="min-h-screen">
      <header className="app-header sticky top-0 z-10 flex items-center gap-2 border-b border-white/10 px-4 py-2 backdrop-blur">
        <span className="mr-4"><Brand /></span>
        <Link href="/studio" className={link}>Studio</Link>
        <Link href="/gallery" className={link}>Galerie</Link>
        {user.role === "admin" && <Link href="/admin" className={link}>Admin</Link>}
        <Link href="/aide" className={`${link} inline-flex items-center gap-1.5`}>
          {/* Bouée de sauvetage */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" />
          </svg>
          Aide
        </Link>
        <div className="ml-auto flex items-center gap-3 text-sm text-white/60">
          <Credits />
          <ThemeToggle />
          <span className="hidden sm:inline">{user.email}</span>
          <form action={logoutAction}>
            <button className="rounded-md px-2 py-1 hover:bg-white/10">Quitter</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
