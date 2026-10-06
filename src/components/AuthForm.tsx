"use client";

import { useActionState } from "react";
import Brand from "@/components/Brand";
import { loginAction, setupAction } from "@/app/actions";

const input =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-violet-400";

export default function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const [state, action, pending] = useActionState(mode === "login" ? loginAction : setupAction, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <h1><Brand size="lg" /></h1>
          <p className="text-sm text-white/50">
            {mode === "login" ? "Connectez-vous à votre espace." : "Première utilisation : créez le compte administrateur."}
          </p>
        </div>
        {mode === "setup" && <input name="name" placeholder="Nom" className={input} />}
        <input name="email" type="email" required placeholder="Email" autoComplete="email" className={input} />
        <input
          name="password"
          type="password"
          required
          placeholder="Mot de passe"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={input}
        />
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-violet-500 py-2 text-sm font-medium hover:bg-violet-400 disabled:opacity-50">
          {mode === "login" ? "Se connecter" : "Créer l'admin"}
        </button>
      </form>
    </main>
  );
}
