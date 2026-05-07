/**
 * CHA-230 — Documentation in-app du système de chat.
 *
 * Affichée sous le `<SystemDashboard>` (page `/admin/chat/system`),
 * cette section sert de "single source of truth opérationnelle" pour
 * tous les admins du chat :
 *   - décrit chaque étape du pipeline,
 *   - indique où configurer chaque composant (avec liens vers les sous-pages),
 *   - liste les feature flags d'environnement,
 *   - oriente vers la téléobservation (KPIs / audit / quality).
 *
 * Volontairement statique (Server-friendly, pas de state) : la doc
 * reflète le code committé. Mise à jour à chaque évolution archi.
 */
import Link from 'next/link';

interface PipelineStep {
  id: string;
  label: string;
  /** 1-2 phrases pour expliquer ce que fait l'étape. */
  description: string;
  /** Code clé (fichier source) pour les devs qui veulent creuser. */
  source: string;
  /** Liens vers les pages admin permettant d'agir sur cette étape. */
  links?: Array<{ href: string; label: string }>;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'visitor',
    label: 'Visiteur',
    description:
      "Le visiteur ouvre le widget chat (cookie de session anonyme `cs_…` créé). C'est l'entrée du pipeline ; chaque message déclenche un cycle complet.",
    source: 'src/lib/chat/services/visitor-cookie.ts',
    links: [{ href: '/admin/chat/conversations', label: 'Voir les conversations' }],
  },
  {
    id: 'sanitize',
    label: 'Sanitize / Redact PII',
    description:
      "Nettoie l'input et masque les données personnelles (email, téléphone, RIB, etc.) AVANT envoi au LLM. La version brute est conservée séparément pour la détection téléphone in-chat.",
    source: 'src/lib/chat/services/sanitize.ts',
  },
  {
    id: 'lang',
    label: 'Détection langue',
    description:
      "Détecte la langue du message (FR / AR / AR-MA Darija) via heuristique scriptale (alphabet) + lexique de mots arabophones latinisés. Choisit la branche d'instruction multilingue ensuite.",
    source: 'src/lib/chat/lang/detect.ts',
    links: [{ href: '/admin/chat/lang', label: 'Configurer la détection' }],
  },
  {
    id: 'intent',
    label: 'Classification d\'intent (regex + LLM)',
    description:
      "Classifie le message en ~15 intents métier (greeting, pricing, negotiation, wholesaler, purchase-intent, etc.) via un classifieur regex pondéré. Si le flag LLM est activé, le runnable LangChain peut corriger/raffiner via tool-call (avec OutputFixingParser et fallback regex en cas de panne).",
    source: 'src/lib/chat/services/intent.ts + runnables/classify-intent.runnable.ts',
    links: [
      { href: '/admin/chat/quality', label: 'KPIs de classification' },
      { href: '/admin/chat/intent-curator', label: 'Tagger des messages golden' },
    ],
  },
  {
    id: 'charter',
    label: 'Charte (filtre inbound + outbound)',
    description:
      "Garde-fou rédactionnel : refuse les messages user qui violent la charte (offenses, hors-sujet médical), et tag (sans réécrire) les réponses LLM qui débordent. La règle est codée en dur, alimentée par les guidelines d'instruction.",
    source: 'src/lib/chat/services/charter-filter.ts',
    links: [{ href: '/admin/chat/instructions', label: 'Instructions / charte' }],
  },
  {
    id: 'rag',
    label: 'RAG retrieve',
    description:
      "Récupère jusqu'à 4 chunks pertinents depuis la base de connaissance (sources curées par l'admin) via embedding similarity. Si aucune source n'est dispo, l'étape est skippée et le LLM répond sans contexte interne.",
    source: 'src/lib/chat/rag/service.ts',
    links: [{ href: '/admin/chat/sources', label: 'Gérer les sources RAG' }],
  },
  {
    id: 'provider',
    label: 'Provider LLM (retry / breaker / fallback)',
    description:
      "Sélectionne le provider chat (OpenAI/Anthropic/Mistral/Google/Ollama) selon enabled + quota + breaker state. Si le flag fallback est ON et que le primaire échoue de manière retryable, le runnable bascule sur un provider secondaire (1 retry primaire puis 1 essai fallback).",
    source: 'src/lib/chat/services/provider-router.ts + runnables/respond-stream.runnable.ts',
    links: [{ href: '/admin/chat/providers', label: 'Configurer les providers' }],
  },
  {
    id: 'stream',
    label: 'Streaming SSE',
    description:
      "Streaming token-par-token vers le widget visiteur via Server-Sent Events. Format propre côté client (`event: chunk` / `event: end` / `event: error` / `event: lead-form-offer`). La sortie est agrégée serveur-side pour la persistance et le charter outbound.",
    source: 'src/lib/chat/services/stream.ts + app/api/chat/stream/route.ts',
  },
  {
    id: 'humanize',
    label: 'Humanize',
    description:
      "Post-traitement de la réponse pour la rendre plus naturelle : apostrophes typographiques, espaces fines avant ponctuation FR, lissage darija (translittération douce). Tourne après agrégation, avant persistance.",
    source: 'src/lib/chat/services/humanize.ts',
  },
  {
    id: 'response',
    label: 'Réponse finale',
    description:
      "La réponse complète est persistée (chat_message), tracée KPI (`message_sent_agent`), et le coût provider est incrémenté. C'est aussi le point où l'on calcule first-token-ms, latency totale, tokens in/out.",
    source: 'src/lib/chat/services/orchestrator.ts',
  },
  {
    id: 'lead',
    label: 'Décision lead form',
    description:
      "Décide si on doit OFFRIR le formulaire de capture lead (priorité décroissante : inline-contact phone, callback-request, purchase-intent, negotiation, wholesaler, b2b, frustration, out-of-knowledge, objection-repeat, long-no-progress, after-hours). Émet l'event SSE `lead-form-offer` que le widget consomme.",
    source: 'src/lib/chat/services/lead-decision.ts + phone-detect.ts',
    links: [{ href: '/admin/chat/conversations', label: 'Voir les leads capturés' }],
  },
];

interface FeatureFlag {
  envVar: string;
  defaultValue: string;
  description: string;
  impact: string;
}

const FEATURE_FLAGS: FeatureFlag[] = [
  {
    envVar: 'CHAT_ENABLED',
    defaultValue: 'false',
    description: 'Kill switch global du chat assistant.',
    impact:
      'Si false, le widget visiteur disparaît, les routes API renvoient 404, et toutes les pages admin /admin/chat/* affichent "Chat désactivé".',
  },
  {
    envVar: 'CHAT_LLM_INTENT_ENABLED',
    defaultValue: 'false',
    description:
      "Active la classification d'intent via LLM tool-call (en plus du regex).",
    impact:
      'Améliore le recall sur les formulations ambiguës, au prix de ~200-400ms et 1 appel LLM par message ambigu (les messages clairs court-circuitent via shortcut regex score≥3).',
  },
  {
    envVar: 'CHAT_PROVIDER_FALLBACK_ENABLED',
    defaultValue: 'false',
    description:
      'Active le retry + bascule de provider en cas de panne du primaire.',
    impact:
      "Réduit les pertes utilisateur en cas de 5xx/timeout/rate-limit chez le provider chat. Coût : potentiellement 2 appels LLM en cas d'erreur ; 0 surcoût en happy path.",
  },
  {
    envVar: 'CHAT_LEAD_CONSENT_VERSION',
    defaultValue: 'v1.0',
    description: 'Version du consent RGPD affichée sur le formulaire lead.',
    impact:
      "Toute mise à jour matérielle du consent (mention RGPD, finalité) DOIT bumper cette version pour invalider les anciens consentements.",
  },
  {
    envVar: 'CHAT_OPENAI_API_KEY',
    defaultValue: '(vide)',
    description:
      "Clé OpenAI utilisée pour la classification d'intent LLM (séparée de la clé chat principale).",
    impact:
      'Si vide, le runnable intent fait fallback regex direct, même flag ON.',
  },
];

interface AdminAction {
  page: string;
  href: string;
  what: string;
}

const ADMIN_ACTIONS: AdminAction[] = [
  {
    page: 'Instructions',
    href: '/admin/chat/instructions',
    what: "Éditer le system prompt par langue (FR / AR / AR-MA), définir les guidelines, activer/désactiver une instruction.",
  },
  {
    page: 'Providers',
    href: '/admin/chat/providers',
    what: "Configurer les providers (OpenAI/Anthropic/Mistral/Google/Ollama), modèles, quota mensuel €, ordre de priorité, statut enabled.",
  },
  {
    page: 'Sources',
    href: '/admin/chat/sources',
    what: "Importer/réindexer la base de connaissance RAG (URLs, fichiers PDF/MD), surveiller la fraîcheur (sources >30j marquées stale).",
  },
  {
    page: 'Langues',
    href: '/admin/chat/lang',
    what: "Tuner la détection automatique de langue, surcharge manuelle des règles, exemples de tests.",
  },
  {
    page: 'Themes',
    href: '/admin/chat/themes',
    what: "Personnaliser l'apparence du widget visiteur (couleurs, copy d'accueil, suggestions cliquables).",
  },
  {
    page: 'Conversations',
    href: '/admin/chat/conversations',
    what: "Lister toutes les sessions, filtrer par langue/intent/status, ouvrir une conversation pour voir le détail message-par-message + leads associés.",
  },
  {
    page: 'KPIs',
    href: '/admin/chat/kpis',
    what: "Métriques produit : volume, conversions, qualité ressentie (feedback), latence, coûts.",
  },
  {
    page: 'Qualité',
    href: '/admin/chat/quality',
    what: "Dashboard qualité de la classification d'intent (CHA-230) : précision regex, taux de correction LLM, distribution par intent/méthode/confidence.",
  },
  {
    page: 'Curator',
    href: '/admin/chat/intent-curator',
    what: "Tagger manuellement des messages comme \"golden-set\" : ils alimentent ensuite le test CI de régression (`pnpm chat:export-golden` puis vitest).",
  },
  {
    page: 'Audit',
    href: '/admin/chat/audit',
    what: "Trace toutes les actions admin (qui a modifié quoi, quand) — RGPD-friendly, immutable.",
  },
];

export function SystemDocs() {
  return (
    <section
      aria-labelledby="system-docs-title"
      className="space-y-6 rounded-md border border-stone-200 bg-white p-5"
    >
      <header>
        <h2
          id="system-docs-title"
          className="text-lg font-semibold tracking-tight"
        >
          Comment ça marche & comment configurer
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Documentation in-app du pipeline chat post-CHA-230. Tout ce qu'un
          admin doit savoir pour opérer, configurer et débugger le système.
        </p>
      </header>

      {/* ---- Pipeline expliqué étape par étape ---- */}
      <article>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
          Le pipeline étape par étape
        </h3>
        <ol className="space-y-3">
          {PIPELINE_STEPS.map((step, idx) => (
            <li
              key={step.id}
              className="rounded-md border border-stone-100 bg-stone-50/40 p-3"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[11px] font-medium text-white tabular-nums"
                >
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-stone-900">{step.label}</p>
                  <p className="mt-1 text-sm text-stone-700">
                    {step.description}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-stone-500">
                    {step.source}
                  </p>
                  {step.links && step.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {step.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100"
                        >
                          → {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </article>

      {/* ---- Config par page admin ---- */}
      <article>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
          Où configurer quoi
        </h3>
        <div className="overflow-hidden rounded-md border border-stone-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Page</th>
                <th className="px-3 py-2">Quoi</th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_ACTIONS.map((a) => (
                <tr key={a.href} className="border-t border-stone-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    <Link
                      href={a.href}
                      className="text-stone-900 underline-offset-2 hover:underline"
                    >
                      {a.page}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-stone-700">{a.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {/* ---- Feature flags ---- */}
      <article>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
          Feature flags (variables d'environnement)
        </h3>
        <p className="mb-2 text-sm text-stone-600">
          À définir dans <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">.env</code>{' '}
          ou Vercel project settings. Un redémarrage est requis après changement.
        </p>
        <div className="overflow-hidden rounded-md border border-stone-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Variable</th>
                <th className="px-3 py-2">Défaut</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2">Impact</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_FLAGS.map((f) => (
                <tr key={f.envVar} className="border-t border-stone-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-stone-900">
                    {f.envVar}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-stone-500">
                    {f.defaultValue}
                  </td>
                  <td className="px-3 py-2 text-stone-700">{f.description}</td>
                  <td className="px-3 py-2 text-stone-700">{f.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {/* ---- Observabilité ---- */}
      <article>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
          Observabilité (où regarder en cas de souci)
        </h3>
        <ul className="ml-5 list-disc space-y-1.5 text-sm text-stone-700">
          <li>
            <strong>Visualisation live</strong> en haut de cette page : pulses
            SSE temps-réel sur les arêtes du pipeline (events des 5 dernières
            secondes).
          </li>
          <li>
            <strong>Replay</strong> d'une session précise (toggle "Replay" en
            haut) : permet de rejouer un parcours visiteur étape par étape pour
            comprendre où ça s'est cassé.
          </li>
          <li>
            <Link href="/admin/chat/quality" className="underline-offset-2 hover:underline">
              <strong>Qualité</strong>
            </Link>{' '}
            : précision regex, taux de correction LLM, distribution
            confidence/intent — utile pour repérer un drift de classification.
          </li>
          <li>
            <Link href="/admin/chat/kpis" className="underline-offset-2 hover:underline">
              <strong>KPIs</strong>
            </Link>{' '}
            : volumes, conversions, latences, coûts (€) par provider.
          </li>
          <li>
            <Link href="/admin/chat/audit" className="underline-offset-2 hover:underline">
              <strong>Audit</strong>
            </Link>{' '}
            : trace immutable de toutes les modifs admin (qui/quand/quoi).
          </li>
          <li>
            <strong>Logs serveur</strong> (Vercel logs) : keys
            <code className="mx-1 rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
              chat.orchestrator.*
            </code>
            ,
            <code className="mx-1 rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
              chat.runnables.*
            </code>
            ,
            <code className="mx-1 rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
              chat.provider.*
            </code>
            .
          </li>
          <li>
            <strong>Tests CI</strong> :
            <code className="ml-1 rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
              pnpm test
            </code>
            (vitest, ~1700 tests dont la régression golden-set sur l'intent classifier).
          </li>
        </ul>
      </article>

      {/* ---- Tâches courantes ---- */}
      <article>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
          Tâches courantes (runbook)
        </h3>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-stone-900">
              Ajouter un nouvel intent
            </dt>
            <dd className="mt-1 text-stone-700">
              Éditer{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                src/lib/chat/services/intent.ts
              </code>{' '}
              (RULES + ChatIntent), ajouter l'enum dans{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                schemas/intent.ts
              </code>
              , câbler la décision dans{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                lead-decision.ts
              </code>{' '}
              si pertinent, ajouter ≥3 exemples par langue dans le golden-set
              via le Curator, puis relancer{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                pnpm chat:export-golden
              </code>
              .
            </dd>
          </div>
          <div>
            <dt className="font-medium text-stone-900">
              Activer la classification LLM
            </dt>
            <dd className="mt-1 text-stone-700">
              Définir{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                CHAT_LLM_INTENT_ENABLED=true
              </code>{' '}
              et{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                CHAT_OPENAI_API_KEY=sk-…
              </code>{' '}
              en env. Surveiller la latence sur la page Qualité ; si{' '}
              {'>'} +500ms, repasser à false (le regex tient seul).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-stone-900">
              Activer le fallback provider
            </dt>
            <dd className="mt-1 text-stone-700">
              Définir{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                CHAT_PROVIDER_FALLBACK_ENABLED=true
              </code>
              . Vérifier qu'au moins 2 providers chat sont enabled dans{' '}
              <Link
                href="/admin/chat/providers"
                className="underline-offset-2 hover:underline"
              >
                /admin/chat/providers
              </Link>
              . Surveiller les events{' '}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
                chat_provider_retry_or_fallback
              </code>
              .
            </dd>
          </div>
          <div>
            <dt className="font-medium text-stone-900">
              Mettre à jour la base de connaissance (RAG)
            </dt>
            <dd className="mt-1 text-stone-700">
              <Link
                href="/admin/chat/sources"
                className="underline-offset-2 hover:underline"
              >
                /admin/chat/sources
              </Link>{' '}
              → "Importer une URL" ou "Uploader un fichier", puis attendre
              l'indexation (status passe de <em>pending</em> →{' '}
              <em>indexed</em>). Sources non rafraîchies depuis 30j sont
              listées comme stale dans la carte ci-dessus.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-stone-900">
              Ouvrir un breaker bloqué
            </dt>
            <dd className="mt-1 text-stone-700">
              Le circuit breaker provider est in-memory (cooldown ~30s). En cas
              de bug, désactiver puis réactiver le provider dans{' '}
              <Link
                href="/admin/chat/providers"
                className="underline-offset-2 hover:underline"
              >
                /admin/chat/providers
              </Link>{' '}
              force un reset du compteur d'erreurs.
            </dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
