# MAS Studio

Plateforme d'équipe pour générer des visuels (images / vidéos / audio) via l'API [Kie.AI](https://kie.ai).
Next.js 16 + Neon Postgres + Auth.js (email/mot de passe) — aucune dépendance à Supabase.

## Déploiement (≈15 min)

1. **Neon** (gratuit) : créer un projet sur neon.tech, copier la connection string.
2. **Local** : `cp .env.example .env.local`, remplir `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`
   (`openssl rand -base64 32` pour les deux derniers), puis `npm run db:push` pour créer les tables.
3. **GitHub** puis **Vercel** : importer le repo, ajouter les 3 variables d'environnement.
4. Ouvrir le site : `/setup` crée le compte admin (une seule fois).
5. **Admin > Réglages** : coller la clé API Kie (https://kie.ai/api-key). Optionnel : clé HMAC webhook, Cloudinary.
6. **Admin > Modèles > Synchroniser** : importe ~160 modèles Kie. Un cron quotidien (`vercel.json`) ajoute ensuite les nouveaux.

⚠ `ENCRYPTION_KEY` chiffre les clés en base : la perdre ou la changer oblige à ressaisir les clés dans Admin.

## Fonctionnement

- `src/lib/kie-docs.ts` lit `docs.kie.ai/llms.txt`, puis la spec OpenAPI de chaque page modèle (`/api/v1/jobs/createTask`).
  Le schéma `input` est stocké en base ; `DynamicForm` en tire le formulaire. Nouveau modèle Kie = zéro code.
- Génération : `POST /api/generate` → Kie `createTask` ; suivi par webhook (`/api/webhook/kie`, HTTPS uniquement) et par polling.
- Les URLs Kie expirent (~24h). Bouton **Garder** : copie vers Cloudinary si configuré (`src/lib/storage.ts`, seul fichier à changer pour R2/B2),
  sinon l'utilisateur télécharge. Les générations non gardées sont supprimées après N jours (cron).

## Passerelle MCP (Claude, ChatGPT, Cursor…)

`POST /api/mcp` (MCP Streamable HTTP, sans état). La clé Kie reste côté serveur ; chaque personne a un jeton personnel
(`ks_…`, haché en base, révocable) créé dans **Admin > Accès MCP**. Outils : `list_models`, `get_model`, `generate`, `get_generation`, `list_generations`, `get_credits`.

Claude Code : `claude mcp add --transport http mas-studio https://VOTRE-SITE/api/mcp --header "Authorization: Bearer ks_…"`

Les connecteurs web de claude.ai / ChatGPT exigent OAuth : non géré pour l'instant (phase 2). Cursor, Claude Code, Claude Desktop (via `mcp-remote`) acceptent l'en-tête Bearer.

## Limites connues

- Seuls les modèles « Market » (`/jobs/createTask`) sont couverts. Veo 3.1, Runway, Suno, 4o Image, Flux Kontext ont d'autres endpoints (phase 2).
- Les modèles dont le schéma `input` a des variantes (`oneOf`) sont fusionnés en un seul formulaire (propriétés en union).
- Upload de fichier de référence limité à ~4,5 Mo (limite Vercel) ; au-delà, coller une URL publique.
