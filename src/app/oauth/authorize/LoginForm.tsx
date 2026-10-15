"use client";

import { useActionState } from "react";
import { oauthLoginAction } from "./actions";

const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-violet-400";

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(oauthLoginAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input name="email" type="email" required placeholder="Email" autoComplete="email" className={input} />
      <input name="password" type="password" required placeholder="Mot de passe" autoComplete="current-password" className={input} />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-violet-500 py-2 text-sm font-medium hover:bg-violet-400 disabled:opacity-50">
        Se connecter
      </button>
    </form>
  );
}
