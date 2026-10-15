import { auth } from "@/auth";
import { validateAuthorize, type AuthorizeParams } from "@/lib/oauth";
import LoginForm from "./LoginForm";
import { oauthDecisionAction } from "./actions";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <h1 className="text-xl">Maison Art Stellaire Studio</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  const q = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const p: AuthorizeParams = {
    client_id: q("client_id"),
    redirect_uri: q("redirect_uri"),
    response_type: q("response_type"),
    code_challenge: q("code_challenge"),
    code_challenge_method: q("code_challenge_method"),
    state: q("state"),
  };

  const v = await validateAuthorize(p);
  if ("error" in v) {
    return (
      <Card>
        <p className="text-sm text-red-400">Demande d&apos;autorisation invalide : {v.error}.</p>
      </Card>
    );
  }

  const session = await auth();
  if (!session?.user) {
    const returnTo = `/oauth/authorize?${new URLSearchParams(p as unknown as Record<string, string>).toString()}`;
    return (
      <Card>
        <p className="text-sm text-white/60">Connectez-vous pour autoriser l&apos;accès à l&apos;outil.</p>
        <LoginForm returnTo={returnTo} />
      </Card>
    );
  }

  const name = v.client.name || "Une application";
  return (
    <Card>
      <p className="text-sm text-white/70">
        <strong>{name}</strong> demande l&apos;accès à MAS Studio au nom de <strong>{session.user.email}</strong>.
      </p>
      <p className="text-xs text-white/50">
        Elle pourra lister les modèles et lancer des générations (images, vidéos, audio). Les coûts et quotas sont imputés à votre compte.
        Vous pourrez retirer l&apos;accès à tout moment en demandant à un administrateur.
      </p>
      <form action={oauthDecisionAction} className="flex gap-2">
        <input type="hidden" name="client_id" value={p.client_id} />
        <input type="hidden" name="redirect_uri" value={p.redirect_uri} />
        <input type="hidden" name="code_challenge" value={p.code_challenge} />
        <input type="hidden" name="code_challenge_method" value={p.code_challenge_method} />
        <input type="hidden" name="state" value={p.state} />
        <button name="decision" value="deny" className="flex-1 rounded-lg border border-white/10 py-2 text-sm hover:bg-white/10">
          Refuser
        </button>
        <button name="decision" value="allow" className="flex-1 rounded-lg bg-violet-500 py-2 text-sm font-medium hover:bg-violet-400">
          Autoriser
        </button>
      </form>
    </Card>
  );
}
