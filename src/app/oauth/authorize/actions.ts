"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { createAuthCode, validateAuthorize, type AuthorizeParams } from "@/lib/oauth";

type State = { error?: string } | undefined;

const field = (f: FormData, k: string) => String(f.get(k) ?? "");
const paramsFrom = (f: FormData): AuthorizeParams => ({
  client_id: field(f, "client_id"),
  redirect_uri: field(f, "redirect_uri"),
  response_type: "code",
  code_challenge: field(f, "code_challenge"),
  code_challenge_method: field(f, "code_challenge_method"),
  state: field(f, "state"),
});

/** Connexion depuis la page d'autorisation, puis retour sur cette même page. */
export async function oauthLoginAction(_: State, form: FormData): Promise<State> {
  const returnTo = field(form, "returnTo");
  if (!returnTo.startsWith("/oauth/authorize?")) return { error: "Requête invalide" };
  try {
    await signIn("credentials", { email: field(form, "email").toLowerCase(), password: field(form, "password"), redirectTo: returnTo });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Email ou mot de passe incorrect" };
    throw e; // redirection
  }
}

/** Autoriser / refuser : tout est revalidé côté serveur (les champs cachés ne sont pas fiables). */
export async function oauthDecisionAction(form: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const p = paramsFrom(form);
  const v = await validateAuthorize(p);
  if ("error" in v) throw new Error(v.error);

  const back = new URL(p.redirect_uri);
  if (field(form, "decision") !== "allow") {
    back.searchParams.set("error", "access_denied");
  } else {
    back.searchParams.set("code", await createAuthCode(session.user.id, p));
  }
  if (p.state) back.searchParams.set("state", p.state);
  redirect(back.toString());
}
