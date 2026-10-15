@AGENTS.md

# Règles du projet MAS Studio

## Git, GitHub et Vercel

- Dépôt : https://github.com/mas58421/mas_studio (branche `main`, déployée automatiquement par Vercel).
- Identité de commit obligatoire : `mas58421 <outilsmas@spiritualitepratique.com>`.
  Vercel bloque le déploiement si l'e-mail du commit ne correspond pas à ce compte GitHub
  (erreur « commit email … could not be matched to a GitHub account »).
- Elle est fixée dans la config locale du dépôt (`git config --local user.email`). Ne jamais utiliser
  l'identité globale de la machine (`avddeals@gmail.com`) pour ce projet. Avant tout commit, vérifier :
  `git config user.email` doit afficher `outilsmas@spiritualitepratique.com`.
- Ne pas réécrire l'historique déjà poussé (pas de force-push sur `main`) : pour relancer un déploiement
  bloqué, faire un nouveau commit avec la bonne identité.
- Commit et push uniquement sur demande explicite.

## Base de données

- Neon Postgres via `DATABASE_URL` dans `.env.local` (ne jamais modifier ni afficher ce fichier).
- Après un changement de `src/db/schema.ts` : `npm run db:push` (demander avant de le lancer).
