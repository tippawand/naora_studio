import Image, { type StaticImageData } from "next/image";
import { headers } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { SETTING_KEYS } from "@/lib/settings";
import adminEquipe from "./captures/admin-equipe.png";
import adminMcp from "./captures/admin-mcp.png";
import adminModeles from "./captures/admin-modeles.png";
import adminReglages from "./captures/admin-reglages.png";
import entete from "./captures/entete.png";
import galerie from "./captures/galerie.png";
import studioModele from "./captures/studio-modele.png";
import claudeAjouter from "./captures/claude/1-ajouter.png";
import claudeNomUrl from "./captures/claude/2-nom-url.png";
import claudeJeton from "./captures/claude/3-jeton.png";
import claudeErreur from "./captures/claude/4-erreur.png";
import claudeSupprimer from "./captures/claude/5-supprimer.png";
import claudeAutoriser from "./captures/claude/6-autoriser.png";

export const metadata = { title: "Aide · Maison Art Stellaire Studio" };

const card = "rounded-2xl border border-white/10 bg-white/[0.03] p-5";
const a = "text-violet-300 hover:underline";

/** Capture d'écran (fichiers dans ./captures). `scale` = densité de la capture (2 pour du @2x). */
function Shot({ src, alt, scale = 2 }: { src: StaticImageData; alt: string; scale?: number }) {
  return (
    <figure className="my-4">
      <Image src={src} alt={alt} width={src.width / scale} className="h-auto w-full rounded-xl border border-white/10" />
      <figcaption className="mt-1.5 text-center text-xs text-white/40">{alt}</figcaption>
    </figure>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-medium text-[var(--accent-fg)]">{i + 1}</span>
          <span className="pt-0.5">{it}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function AidePage() {
  const user = await requireUser();
  const admin = user.role === "admin";
  const h = await headers();
  const mcpUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/api/mcp`;
  const toc = [
    ["presentation", "Présentation"],
    ["studio", "Générer dans le Studio"],
    ["galerie", "Galerie et conservation"],
    ["credits", "Crédits et paiement (Kie.ai)"],
    ["claude", "Utiliser le Studio depuis Claude"],
    ...(admin ? [["admin", "Administration"]] : []),
    ["faq", "Questions fréquentes"],
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 text-sm leading-relaxed text-white/80">
      <div className="pt-4">
        <h1 className="text-3xl" style={{ color: "var(--brand)" }}>Aide</h1>
        <p className="mt-1 text-white/50">Tout ce qu&apos;il faut savoir pour utiliser — et administrer — le Studio.</p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full bg-white/5 px-3 py-1 text-xs hover:bg-white/10">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <section id="presentation" className={`${card} scroll-mt-20`}>
        <h2 className="mb-2 text-xl">Présentation</h2>
        <p>
          Maison Art Stellaire Studio est l&apos;outil d&apos;équipe pour générer des <strong>images, vidéos et sons par IA</strong>. Il donne accès,
          depuis une seule interface, à plus d&apos;une centaine de modèles (Seedream, Kling, Google, Flux…) proposés par{" "}
          <a href="https://kie.ai" target="_blank" rel="noreferrer" className={a}>Kie.ai ↗</a>.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li><strong>Studio</strong> : choisir un modèle, remplir le formulaire, lancer la génération.</li>
          <li><strong>Galerie</strong> : toutes les créations réussies de l&apos;équipe.</li>
          {admin && <li><strong>Admin</strong> : clé Kie, modèles disponibles, comptes de l&apos;équipe, accès pour les assistants IA.</li>}
          <li><strong>Crédits</strong> (en haut à droite) : le solde du compte Kie.ai partagé par toute l&apos;équipe.</li>
        </ul>
        <Shot src={entete} alt="La barre de navigation et le solde de crédits Kie" />
      </section>

      <section id="studio" className={`${card} scroll-mt-20`}>
        <h2 className="mb-3 text-xl">Générer dans le Studio</h2>
        <Steps
          items={[
            <>Choisissez le type : <strong>Images</strong>, <strong>Vidéos</strong> ou <strong>Audio</strong>, puis cherchez un modèle (filtres « Texte → image », « Image → vidéo »…).</>,
            <>Cliquez sur un modèle. Son coût moyen s&apos;affiche dès qu&apos;une première génération a été faite, avec un lien vers sa documentation Kie.</>,
            <>Remplissez le formulaire (prompt, format, durée, image de référence…). Les champs sont propres à chaque modèle.</>,
            <>Cliquez sur <strong>Générer</strong>. Le résultat apparaît à droite au bout de quelques secondes à quelques minutes.</>,
            <>Cliquez sur <strong>☆</strong> pour mettre un modèle en favori : il restera en haut de la liste.</>,
          ]}
        />
        <Shot src={studioModele} alt="Studio : liste des modèles, formulaire et résultats" />
        <p className="text-xs text-white/50">
          Un formulaire semble incomplet ou obsolète ? Le bouton <strong>↻ Resynchroniser ce modèle</strong> recharge ses paramètres depuis Kie.
          Les images de référence sont limitées à ~4,5 Mo ; au-delà, collez une URL publique.
        </p>
      </section>

      <section id="galerie" className={`${card} scroll-mt-20`}>
        <h2 className="mb-2 text-xl">Galerie et conservation</h2>
        <p>La galerie regroupe les générations réussies de toute l&apos;équipe.</p>
        <div className="my-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
          ⚠ Les fichiers hébergés par Kie <strong>expirent après environ 24 h</strong>. Pensez à conserver ce qui vous plaît.
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Garder</strong> : copie le fichier sur notre stockage (Cloudinary) pour qu&apos;il reste disponible.</li>
          <li><strong>Télécharger</strong> : enregistre le fichier sur votre ordinateur.</li>
          <li><strong>Supprimer</strong> : retire la génération de la galerie.</li>
        </ul>
        <p className="mt-2 text-white/60">
          Le <strong>fichier</strong> d&apos;une génération non gardée devient inaccessible après ~24 h (limite de Kie). Sa <strong>fiche</strong>{" "}
          (prompt, modèle, coût) reste visible dans la galerie, sans l&apos;image, puis est supprimée automatiquement après 30 jours (réglable par
          un admin).
        </p>
        <Shot src={galerie} alt="La galerie de l'équipe" />
      </section>

      <section id="credits" className={`${card} scroll-mt-20`}>
        <h2 className="mb-2 text-xl">Crédits et paiement (Kie.ai)</h2>
        <p>
          <strong>Le paiement ne se fait pas dans le Studio : il se passe entièrement chez Kie.ai.</strong> Le Studio ne stocke aucune carte
          bancaire et ne facture rien ; il utilise le solde de crédits du compte Kie.ai de la Maison.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Chaque génération consomme des crédits Kie, selon le modèle et les options (durée, résolution…).</li>
          <li>Repère : <strong>1 000 crédits ≈ 5 $</strong>. Le badge en haut affiche le solde et son équivalent en dollars (cliquez dessus pour l&apos;actualiser).</li>
          <li>Solde épuisé = générations refusées par Kie.</li>
          <li>
            Pour recharger : {admin ? "connectez-vous" : "l'administrateur se connecte"} sur{" "}
            <a href="https://kie.ai" target="_blank" rel="noreferrer" className={a}>kie.ai ↗</a> avec le compte de la Maison et achète des crédits
            dans l&apos;espace de facturation (Billing). Le nouveau solde apparaît aussitôt dans le Studio.
          </li>
        </ul>
      </section>

      <section id="claude" className={`${card} scroll-mt-20`}>
        <h2 className="mb-1 text-xl">Utiliser le Studio depuis Claude</h2>
        <p className="mb-4 text-white/50">
          Branchez le Studio à l&apos;application Claude : vous pourrez demander « génère une image de… » directement dans une conversation.
          La clé Kie reste protégée côté serveur ; les crédits consommés sont les mêmes que dans le Studio.
        </p>

        <h3 className="mb-2 text-lg">Avant de commencer</h3>
        <p>
          Il vous faut un <strong>jeton personnel</strong> (il commence par <code>ks_</code>).{" "}
          {admin ? (
            <>Créez-le dans <Link href="/admin" className={a}>Admin</Link> › Accès MCP (un jeton par personne et par outil).</>
          ) : (
            <>Demandez-le à un administrateur.</>
          )}{" "}
          Il ne s&apos;affiche qu&apos;une seule fois : copiez-le aussitôt et ne le partagez pas, c&apos;est l&apos;équivalent d&apos;un mot de passe.
        </p>

        <h3 className="mb-2 mt-5 text-lg">Ajouter le connecteur</h3>
        <Steps
          items={[
            <>Dans Claude, cliquez sur <strong>+</strong> sous la zone de message › <strong>Connectors</strong> › <strong>Add connector</strong> › <strong>Add custom connector</strong>.</>,
            <>
              Donnez un nom (ex. « Maison Art Stellaire Studio ») et collez l&apos;adresse du serveur :
              <code className="mt-1 block break-all rounded-lg bg-black/40 p-2 text-xs">{mcpUrl}</code>
              Cliquez sur <strong>Continue</strong>.
            </>,
            <>
              Dans <strong>Authentication</strong>, choisissez <strong>No sign-in</strong>. Dans <strong>Request headers</strong>, gardez le nom{" "}
              <code>authorization</code> et saisissez comme valeur <code>Bearer ks_votre_jeton</code> (le mot <code>Bearer</code>, une espace, puis le
              jeton). Cliquez sur <strong>Add</strong>.
            </>,
            <>
              Dans Réglages › <strong>Connectors</strong>, ouvrez le connecteur et passez les outils sur <strong>Always allow</strong> (✓), sinon Claude
              vous demandera une confirmation à chaque action.
            </>,
          ]}
        />
        <Shot src={claudeAjouter} scale={1} alt="Étape 1 : + › Connectors › Add connector › Add custom connector" />
        <Shot src={claudeNomUrl} scale={1} alt="Étape 2 : nom du connecteur et adresse /api/mcp" />
        <Shot src={claudeJeton} scale={1} alt="Étape 3 : « No sign-in » et en-tête authorization = Bearer <jeton>" />
        <Shot src={claudeAutoriser} scale={1} alt="Étape 4 : autoriser les outils (Always allow)" />

        <h3 className="mb-2 mt-5 text-lg">Utilisation</h3>
        <p>Écrivez simplement à Claude ce que vous voulez, par exemple :</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
          <li>« Quels modèles vidéo sont disponibles dans le Studio ? »</li>
          <li>« Génère avec Seedream une photo d&apos;un foulard en soie bleu, format 3:4. »</li>
          <li>« Combien de crédits Kie nous reste-t-il ? »</li>
        </ul>
        <p className="mt-2 text-white/60">
          Les générations lancées depuis Claude apparaissent aussi dans la galerie, avec les mêmes règles : fichier disponible ~24 h, pensez à le
          garder.
        </p>

        <h3 className="mb-2 mt-5 text-lg">En cas d&apos;erreur « Couldn&apos;t reach… »</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Vérifiez l&apos;adresse : elle doit commencer par <code>https://</code> et finir par <code>/api/mcp</code>.</li>
          <li>Vérifiez la valeur de l&apos;en-tête : <code>Bearer</code> + une espace + le jeton complet, et que le jeton n&apos;a pas été révoqué.</li>
          <li>
            L&apos;en-tête ne peut plus être modifié après coup : supprimez le connecteur (Réglages › Connectors › <strong>⋮</strong> ›{" "}
            <strong>Remove</strong>) et recommencez depuis l&apos;étape 1.
          </li>
        </ul>
        <Shot src={claudeErreur} scale={1} alt="Message d'erreur possible lors de la connexion" />
        <Shot src={claudeSupprimer} scale={1} alt="Supprimer le connecteur pour recommencer : ⋮ › Remove" />
      </section>

      {admin && (
        <section id="admin" className={`${card} scroll-mt-20`}>
          <h2 className="mb-1 text-xl">Administration</h2>
          <p className="text-white/50">Visible uniquement par les administrateurs. Tout se gère dans l&apos;onglet <Link href="/admin" className={a}>Admin</Link>.</p>

          <h3 className="mb-2 mt-5 text-lg">1. Clés API et réglages</h3>
          <p>Les clés sont stockées chiffrées en base ; un champ laissé vide conserve la valeur actuelle.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>{SETTING_KEYS.kieApiKey.label}</strong> (indispensable) : à créer sur{" "}
              <a href="https://kie.ai/api-key" target="_blank" rel="noreferrer" className={a}>kie.ai/api-key ↗</a>. Tant qu&apos;elle manque, le badge
              affiche « Crédits Kie : indisponibles » et rien ne peut être généré.
            </li>
            <li><strong>Clé HMAC webhook</strong> (optionnel) : sécurise les notifications de fin de génération envoyées par Kie.</li>
            <li><strong>Cloudinary</strong> (optionnel) : active le bouton « Garder ». Sans Cloudinary, l&apos;équipe doit télécharger ses fichiers.</li>
            <li><strong>Rétention</strong> : nombre de jours avant suppression des générations non gardées (30 par défaut).</li>
          </ul>
          <Shot src={adminReglages} alt="Admin : clés API et réglages" />

          <h3 className="mb-2 mt-5 text-lg">2. Modèles</h3>
          <p>
            <strong>Synchroniser avec Kie</strong> importe le catalogue des modèles et leurs formulaires. Une synchro automatique a lieu chaque nuit :
            les nouveaux modèles Kie arrivent seuls (badge « Nouveau » pendant 14 jours). Décochez un modèle pour le masquer à l&apos;équipe
            (modèle trop cher, peu utile…).
          </p>
          <Shot src={adminModeles} alt="Admin : synchronisation et activation des modèles" />

          <h3 className="mb-2 mt-5 text-lg">3. Équipe</h3>
          <p>
            Ajoutez une personne avec son nom, son e-mail, un mot de passe provisoire (10 caractères minimum) et un rôle : <strong>Membre</strong>{" "}
            (Studio + Galerie) ou <strong>Admin</strong> (accès à cet onglet). Transmettez-lui ses identifiants ; « Supprimer » retire l&apos;accès.
          </p>
          <Shot src={adminEquipe} alt="Admin : gestion de l'équipe" />

          <h3 className="mb-2 mt-5 text-lg">4. Accès MCP (assistants IA)</h3>
          <p>
            Permet d&apos;utiliser le Studio depuis Claude, Cursor ou ChatGPT sans jamais révéler la clé Kie. Créez un jeton par personne et par outil :
            il ne s&apos;affiche qu&apos;une fois, copiez-le immédiatement. Révoquez-le en cas de départ ou de fuite.
          </p>
          <Shot src={adminMcp} alt="Admin : jetons d'accès MCP" />

          <h3 className="mb-2 mt-5 text-lg">5. Garde-fous et maintenance</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Limites anti-emballement : 1 000 générations par jour et 20 en cours simultanément (réglables par variables d&apos;environnement Vercel).</li>
            <li>Tâche quotidienne automatique : synchro des modèles + nettoyage des générations non gardées.</li>
            <li>
              La variable <code>ENCRYPTION_KEY</code> (Vercel) chiffre les clés : ne la changez jamais, sinon il faudra ressaisir toutes les clés
              ci-dessus.
            </li>
          </ul>
        </section>
      )}

      <section id="faq" className={`${card} scroll-mt-20`}>
        <h2 className="mb-3 text-xl">Questions fréquentes</h2>
        <dl className="space-y-3">
          {[
            ["« Crédits Kie : indisponibles » en haut de l'écran", "La clé API Kie est absente ou invalide : un admin doit la (re)saisir dans Admin › Clés API."],
            ["La génération échoue", "Vérifiez le solde de crédits, puis les paramètres (format, taille de l'image de référence). Le message d'erreur de Kie s'affiche sur la carte."],
            ["Aucun modèle dans la liste", "Un admin doit lancer « Synchroniser avec Kie » dans Admin › Modèles."],
            ["Mon image a disparu", "Les fichiers Kie expirent après ~24 h. Utilisez « Garder » ou « Télécharger » juste après la génération."],
            ["Comment payer / recharger ?", "Uniquement sur kie.ai, avec le compte de la Maison. Le Studio ne gère aucun paiement."],
            ["J'ai oublié mon mot de passe", "Demandez à un administrateur de recréer votre compte."],
          ].map(([q, r]) => (
            <div key={q}>
              <dt className="font-medium text-white">{q}</dt>
              <dd className="text-white/60">{r}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
