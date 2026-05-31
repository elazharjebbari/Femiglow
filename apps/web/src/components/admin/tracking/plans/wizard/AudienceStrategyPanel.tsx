'use client';

import { useState } from 'react';
import {
  AUDIENCES,
  AUDIENCE_TRIGGER_EVENTS,
  generateAudienceStrategyTxt,
  type AudienceDef,
  type FunnelStage,
} from './audience-strategy-data';

const STAGE_TITLE: Record<FunnelStage, string> = {
  tofu: 'TOFU — Découverte',
  mofu: 'MOFU — Considération',
  bofu: 'BOFU — Intent d\'achat',
  hot: 'HOT — Quasi-acheteur',
  customer: 'CUSTOMER — Clients',
  exclusion: 'EXCLUSION — Audiences négatives',
};

const STAGE_EMOJI: Record<FunnelStage, string> = {
  tofu: '🌱',
  mofu: '🌿',
  bofu: '🌳',
  hot: '🔥',
  customer: '👑',
  exclusion: '🚫',
};

const STAGE_COLOR: Record<FunnelStage, string> = {
  tofu: 'border-green-200 bg-green-50/40',
  mofu: 'border-emerald-200 bg-emerald-50/40',
  bofu: 'border-amber-200 bg-amber-50/40',
  hot: 'border-orange-200 bg-orange-50/40',
  customer: 'border-purple-200 bg-purple-50/40',
  exclusion: 'border-stone-300 bg-stone-50',
};

const SIZE_BADGE: Record<AudienceDef['size'], string> = {
  XL: 'bg-sky-100 text-sky-800',
  L: 'bg-sky-50 text-sky-700',
  M: 'bg-stone-100 text-stone-700',
  S: 'bg-amber-50 text-amber-800',
  XS: 'bg-orange-50 text-orange-800',
};

export function AudienceStrategyPanel({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}): JSX.Element {
  const [downloading, setDownloading] = useState(false);

  function handleDownload() {
    setDownloading(true);
    try {
      const txt = generateAudienceStrategyTxt();
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `femiglow-audiences-ga4-${stamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      // léger délai pour feedback visuel
      setTimeout(() => setDownloading(false), 400);
    }
  }

  const stages: FunnelStage[] = ['tofu', 'mofu', 'bofu', 'hot', 'customer', 'exclusion'];

  return (
    <details
      open={defaultOpen}
      className="group mb-6 overflow-hidden rounded-lg border border-violet-200 bg-violet-50/40"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-violet-900 hover:bg-violet-50">
        <span className="flex items-center gap-2">
          <span aria-hidden="true">🎯</span>
          <span>Stratégie d'audiences GA4 → Google Ads (TOFU → MOFU → BOFU → HOT)</span>
        </span>
        <Chevron />
      </summary>
      <div className="space-y-4 border-t border-violet-200 bg-white/60 p-4 text-sm text-stone-700">
        <Intro />

        <div className="flex items-center justify-between gap-3 rounded-md border border-violet-200 bg-white px-3 py-2">
          <div className="text-xs text-stone-600">
            <strong className="text-stone-900">Récap complet en .txt</strong> — tout
            ce panneau (convention nommage + events + 22 audiences + workflow) dans
            un fichier prêt à recopier pendant ta config GA4.
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50"
          >
            <span aria-hidden>⬇</span>
            <span>{downloading ? 'Génération…' : 'Télécharger le .txt'}</span>
          </button>
        </div>

        <NamingConvention />
        <Section
          number={1}
          title="Events GA4 à activer comme triggers d'audience"
          emoji="📡"
        >
          <EventsList />
        </Section>

        {stages.map((stage, idx) => (
          <Section
            key={stage}
            number={idx + 2}
            title={STAGE_TITLE[stage]}
            emoji={STAGE_EMOJI[stage]}
          >
            <StageAudiences stage={stage} />
          </Section>
        ))}

        <Workflow />
      </div>
    </details>
  );
}

/* ─── Pièces ──────────────────────────────────────────────────────── */

function Intro(): JSX.Element {
  return (
    <div className="space-y-2 rounded-md border border-violet-100 bg-violet-50/60 p-3 text-xs leading-relaxed text-stone-700">
      <p>
        Une fois ton tracking GA4 + Google Ads en place, l'étape suivante est de
        construire un <strong>parc d'audiences</strong> qui suit la logique du
        funnel marketing : TOFU (découverte) → MOFU (considération) → BOFU
        (intent) → HOT (quasi-achat) → CUSTOMER (post-conversion), plus les
        EXCLUSIONS.
      </p>
      <p>
        Cette section te donne les <strong>22 audiences recommandées</strong>{' '}
        basées sur tes events FemiGlow (Journal, kit, rituel, wizard checkout,
        chat IA…). Chaque audience a une règle GA4 prête à copier, un objectif,
        une stratégie marketing et des types de campagnes Google Ads adaptés.
      </p>
    </div>
  );
}

function NamingConvention(): JSX.Element {
  return (
    <details className="group/section overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-stone-900 hover:bg-stone-50">
        <span className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-semibold text-white"
            aria-hidden
          >
            0
          </span>
          <span aria-hidden>🏷️</span>
          <span>Convention de nommage (à respecter avant tout)</span>
        </span>
        <Chevron />
      </summary>
      <div className="space-y-3 border-t border-stone-200 px-4 py-4 text-sm leading-relaxed text-stone-700">
        <p>
          Toutes les audiences suivent le format{' '}
          <code className="rounded bg-stone-100 px-1 text-xs">
            aud_&lt;stage&gt;_&lt;descriptor&gt;_&lt;recency&gt;d
          </code>
          . Exemple : <code>aud_bofu_cart_abandoner_14d</code>.
        </p>
        <div className="overflow-hidden rounded-md border border-stone-200 bg-white text-xs">
          <table className="w-full">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Préfixe</th>
                <th className="px-3 py-2 text-left font-medium">Stage funnel</th>
                <th className="px-3 py-2 text-left font-medium">Volume</th>
                <th className="px-3 py-2 text-left font-medium">Intent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              <tr>
                <td className="px-3 py-1.5 font-mono">aud_tofu_*</td>
                <td className="px-3 py-1.5">Top of Funnel — découverte</td>
                <td className="px-3 py-1.5">Élevé</td>
                <td className="px-3 py-1.5">Faible</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">aud_mofu_*</td>
                <td className="px-3 py-1.5">Middle of Funnel — considération</td>
                <td className="px-3 py-1.5">Moyen</td>
                <td className="px-3 py-1.5">Moyen</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">aud_bofu_*</td>
                <td className="px-3 py-1.5">Bottom of Funnel — intent achat</td>
                <td className="px-3 py-1.5">Faible</td>
                <td className="px-3 py-1.5">Fort</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">aud_hot_*</td>
                <td className="px-3 py-1.5">Quasi-acheteur (in-checkout)</td>
                <td className="px-3 py-1.5">Très faible</td>
                <td className="px-3 py-1.5">Maximal</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">aud_cust_*</td>
                <td className="px-3 py-1.5">Clients (post-conversion)</td>
                <td className="px-3 py-1.5">Moyen</td>
                <td className="px-3 py-1.5">Repeat / cross-sell</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">aud_excl_*</td>
                <td className="px-3 py-1.5">Exclusions (audiences négatives)</td>
                <td className="px-3 py-1.5">Variable</td>
                <td className="px-3 py-1.5">N/A</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>Pourquoi cette convention ?</strong>
        </p>
        <ul className="ml-5 list-disc space-y-1 text-xs">
          <li>
            <strong>Filtrable</strong> : tape <code>aud_</code> dans la barre
            recherche GA4/Ads pour voir TOUTES les audiences custom (vs les
            audiences par défaut).
          </li>
          <li>
            <strong>Stage explicite</strong> : le nom dit immédiatement où elle
            se branche dans le funnel — choix campagne sans ouvrir la définition.
          </li>
          <li>
            <strong>Recency dans le nom</strong> : évite la confusion entre{' '}
            <code>aud_mofu_product_viewer_7d</code> (Display agressif) et{' '}
            <code>aud_mofu_product_viewer_30d</code> (Demand Gen mid-funnel).
          </li>
          <li>
            <strong>Anglais court</strong> : compatible avec la limite de
            caractères Google Ads UI et lisible pour un freelance / agence
            internationale.
          </li>
        </ul>
      </div>
    </details>
  );
}

function EventsList(): JSX.Element {
  return (
    <>
      <p>
        Dans <code>GA4 → Admin → Events</code>, active{' '}
        <strong>"Use for audience"</strong> sur tous les events de la liste
        ci-dessous. Pour ceux marqués <span className="font-semibold text-rose-700">★ CONV</span>,
        active aussi <strong>"Mark as conversion"</strong> (déjà fait pour les
        primaires si tu as suivi la section gating de la doc).
      </p>
      <div className="max-h-80 overflow-auto rounded-md border border-stone-200 bg-white text-xs">
        <table className="w-full">
          <thead className="sticky top-0 bg-stone-50 text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Event</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Conv ?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {AUDIENCE_TRIGGER_EVENTS.map((e) => (
              <tr key={e.name}>
                <td className="px-3 py-1.5 font-mono">{e.name}</td>
                <td className="px-3 py-1.5 text-stone-600">{e.description}</td>
                <td className="px-3 py-1.5">
                  {e.asConversion ? (
                    <span className="font-semibold text-rose-700">★ CONV</span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">
        Tous ces events sont déjà émis par FemiGlow via le dataLayer. GA4 les
        reçoit automatiquement dès que tu as importé le container GTM exporté
        depuis l'admin tracking.
      </p>
    </>
  );
}

function StageAudiences({ stage }: { stage: FunnelStage }): JSX.Element {
  const audiences = AUDIENCES.filter((a) => a.stage === stage);
  return (
    <div className="space-y-3">
      {audiences.map((a) => (
        <AudienceCard key={a.name} audience={a} />
      ))}
    </div>
  );
}

function AudienceCard({ audience }: { audience: AudienceDef }): JSX.Element {
  return (
    <div
      className={`overflow-hidden rounded-md border p-3 ${STAGE_COLOR[audience.stage]}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-stone-900 px-2 py-0.5 text-xs font-medium text-white">
          {audience.name}
        </code>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${SIZE_BADGE[audience.size]}`}
        >
          Taille {audience.size}
        </span>
        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700 ring-1 ring-inset ring-stone-200">
          {audience.recencyDays} jours
        </span>
      </div>
      <p className="mb-2 text-xs text-stone-700">
        <strong className="text-stone-900">Objectif. </strong>
        {audience.purpose}
      </p>
      <details className="mb-2">
        <summary className="cursor-pointer text-xs font-medium text-stone-900 hover:underline">
          Règle GA4 à recopier
        </summary>
        <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[11px] text-stone-700 ring-1 ring-inset ring-stone-200">
          {audience.rule}
        </pre>
      </details>
      <p className="mb-2 text-xs text-stone-700">
        <strong className="text-stone-900">Stratégie marketing. </strong>
        {audience.strategy}
      </p>
      <div className="text-xs">
        <strong className="text-stone-900">Campagnes recommandées :</strong>
        <ul className="ml-4 mt-1 list-disc space-y-0.5 text-stone-700">
          {audience.campaigns.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Workflow(): JSX.Element {
  return (
    <details className="overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-stone-900 hover:bg-stone-50">
        <span className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-semibold text-white"
            aria-hidden
          >
            ★
          </span>
          <span aria-hidden>🧭</span>
          <span>Workflow de mise en place (étape par étape)</span>
        </span>
        <Chevron />
      </summary>
      <div className="space-y-2 border-t border-stone-200 px-4 py-4 text-xs leading-relaxed text-stone-700">
        <ol className="ml-5 list-decimal space-y-1.5">
          <li>
            <strong>Import GTM</strong> — vérifie dans GTM Preview que tous les
            events §1 firent côté navigateur.
          </li>
          <li>
            <strong>Activer "Use for audience"</strong> sur tous les events §1.
            Pour ceux marqués <span className="font-semibold text-rose-700">★ CONV</span>{' '}
            : activer aussi "Mark as conversion".
          </li>
          <li>
            <strong>Créer les audiences</strong> (Admin → Audiences → New).
            Ordre recommandé :
            <ol className="ml-5 mt-1 list-[lower-alpha] space-y-0.5">
              <li>
                EXCLUSIONS d'abord (utilisées par les autres en filtre négatif)
              </li>
              <li>CUSTOMERS (seed Lookalike)</li>
              <li>HOT → BOFU → MOFU → TOFU (du bas vers le haut)</li>
            </ol>
            GA4 a besoin de 7-14 jours pour peupler les audiences une fois
            créées — anticipe.
          </li>
          <li>
            <strong>Lier GA4 ↔ Google Ads</strong> — Google Ads → Tools →
            Linked accounts → Google Analytics. Importer les audiences créées
            dans Google Ads. Délai d'import : 24-48h pour la première synchro.
          </li>
          <li>
            <strong>Customer Match</strong> (★ recommandé) — exporter{' '}
            <code>aud_cust_buyer_180d</code> en hash SHA-256 email/phone et
            uploader dans Google Ads → Audience Manager → Customer Match. Crée
            un similar audience auto par Google.
          </li>
          <li>
            <strong>Mapping campagne ↔ audience</strong>. Pour chaque campagne
            définir :
            <ul className="ml-5 mt-1 list-disc space-y-0.5">
              <li>
                <strong>Targeting</strong> — qui voir
              </li>
              <li>
                <strong>Observation</strong> — mesurer sans cibler (utile pour
                voir le ROAS par segment avant de basculer)
              </li>
              <li>
                <strong>Exclusion</strong> — qui éviter (cf. <code>aud_excl_*</code>)
              </li>
            </ul>
          </li>
          <li>
            <strong>Mesurer + itérer (mensuel)</strong> — Reporting Google Ads
            → Audiences → comparer ROAS par audience. Couper celles &lt; 2× ROAS,
            doubler le budget sur &gt; 5× ROAS.
          </li>
        </ol>
      </div>
    </details>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function Section({
  number,
  title,
  emoji,
  children,
}: {
  number: number;
  title: string;
  emoji: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <details className="group/section overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm transition hover:border-stone-300">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-stone-900 hover:bg-stone-50">
        <span className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {number}
          </span>
          <span aria-hidden>{emoji}</span>
          <span>{title}</span>
        </span>
        <Chevron />
      </summary>
      <div className="space-y-3 border-t border-stone-200 px-4 py-4 text-sm leading-relaxed text-stone-700">
        {children}
      </div>
    </details>
  );
}

function Chevron(): JSX.Element {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
