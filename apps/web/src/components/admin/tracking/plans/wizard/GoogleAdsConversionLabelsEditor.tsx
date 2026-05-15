'use client';

/**
 * Éditeur des étiquettes (labels) de conversion Google Ads par event.
 *
 * Affiché dans `StepEnvProfiles` quand le provider googleAds est actif.
 * Les labels sont OPTIONNELS — un label vide = pas de tag awct généré
 * pour cet event (skip propre côté exporter).
 *
 * UX :
 *  - 3 sections (Sales / Leads / Further) miroir des groupes Google Ads
 *  - Par ligne : catégorie API + rôle recommandé + events partagés +
 *    status (configurée / ignorée) + input label
 *  - Compteur global "X/Y configurées" en header
 *  - Help context avec lien vers la doc Google Ads
 *
 * Source de vérité : `listAdsConversions()` (event-mapping.ts) — la
 * liste des conversions est data-driven, pas hardcodée ici.
 */

import {
  listAdsConversions,
  type AdsConversionCategory,
  type AdsConversionDescriptor,
  type AdsConversionGroup,
  type AdsConversionRole,
} from '@/lib/tracking/providers/event-mapping';
import type { EnvProfile, GoogleAdsConversionLabels } from '@/lib/tracking/plan/types';

const CATEGORY_LABEL: Record<AdsConversionCategory, string> = {
  PURCHASE: 'Achat',
  ADD_TO_CART: 'Ajout au panier',
  BEGIN_CHECKOUT: 'Initiation paiement',
  SUBSCRIBE_PAID: 'Abonnement payant',
  CONTACT: 'Contact',
  SUBMIT_LEAD_FORM: 'Soumission de formulaire',
  BOOK_APPOINTMENT: 'Prise de RDV',
  SIGNUP: 'Inscription',
  REQUEST_QUOTE: 'Demande de devis',
  GET_DIRECTIONS: 'Itinéraire',
  OUTBOUND_CLICK: 'Clic sortant',
  PAGE_VIEW: 'Vue de page',
  DEFAULT: 'Autre',
};

const GROUP_META: Record<
  AdsConversionGroup,
  { label: string; description: string; emoji: string }
> = {
  sales: {
    label: 'Sales',
    description:
      'Événements e-commerce liés à une transaction. Purchase est la conversion principale ; les autres sont des signaux secondaires recommandés en observation seule.',
    emoji: '🛒',
  },
  leads: {
    label: 'Leads',
    description:
      'Capture de prospects (formulaire, contact, inscription). À configurer en conversion principale pour les comptes lead-gen.',
    emoji: '🎯',
  },
  further: {
    label: 'Autres actions',
    description:
      'Signaux d\'engagement (chat, journal, vidéo). Toujours en observation — n\'utilisez pas ces conversions pour le Smart Bidding.',
    emoji: '📊',
  },
};

export function GoogleAdsConversionLabelsEditor({
  prod,
  onChange,
}: {
  prod: EnvProfile;
  onChange: (key: string, value: string) => void;
}): JSX.Element {
  const conversions = listAdsConversions();
  const labels =
    (prod.config as { googleAdsConversionLabels?: GoogleAdsConversionLabels })
      .googleAdsConversionLabels ?? {};
  const filled = conversions.filter((c) => (labels[c.conversionLabelKey] ?? '').trim() !== '');

  // Group conversions
  const byGroup = new Map<AdsConversionGroup, AdsConversionDescriptor[]>();
  for (const c of conversions) {
    const arr = byGroup.get(c.group) ?? [];
    arr.push(c);
    byGroup.set(c.group, arr);
  }

  return (
    <div>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900">
          Conversions Google Ads
        </h2>
        <span className="text-xs text-stone-500">
          {filled.length}/{conversions.length} configurée
          {conversions.length > 1 ? 's' : ''}
        </span>
      </header>
      <p className="mb-4 text-sm text-stone-600">
        Chaque <strong>étiquette de conversion</strong> est{' '}
        <strong>optionnelle</strong>. Renseignez uniquement les conversions que
        vous voulez suivre côté Google Ads — un champ vide signifie que le tag
        <code className="ml-1 rounded bg-stone-100 px-1 text-xs">awct</code>{' '}
        correspondant ne sera pas exporté.{' '}
        <a
          href="https://support.google.com/google-ads/answer/6014097"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
        >
          Doc Google Ads : créer une conversion →
        </a>
      </p>

      <div className="space-y-6">
        {(['sales', 'leads', 'further'] as const).map((groupKey) => {
          const items = byGroup.get(groupKey) ?? [];
          if (items.length === 0) return null;
          const meta = GROUP_META[groupKey];
          return (
            <section key={groupKey}>
              <header className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-stone-900">
                  <span className="mr-1.5" aria-hidden>
                    {meta.emoji}
                  </span>
                  {meta.label}
                </h3>
                <span className="text-xs text-stone-400">
                  {items.length} conversion{items.length > 1 ? 's' : ''}
                </span>
              </header>
              <p className="mb-3 text-xs text-stone-500">{meta.description}</p>

              <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
                <ul className="divide-y divide-stone-200">
                  {items.map((c) => (
                    <ConversionRow
                      key={c.conversionLabelKey}
                      conv={c}
                      value={labels[c.conversionLabelKey] ?? ''}
                      onChange={(v) => onChange(c.conversionLabelKey, v)}
                    />
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ConversionRow({
  conv,
  value,
  onChange,
}: {
  conv: AdsConversionDescriptor;
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  const isFilled = value.trim() !== '';
  return (
    <li className="grid gap-3 p-4 sm:grid-cols-[1fr_320px] sm:gap-4">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs font-medium text-stone-800">
            {conv.conversionLabelKey}
          </code>
          <CategoryBadge category={conv.category} />
          <RoleChip role={conv.recommendedRole} />
          {isFilled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              ✓ Configurée
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-500 ring-1 ring-inset ring-stone-200">
              ⏭️ Ignorée
            </span>
          )}
        </div>
        <p className="text-xs text-stone-500">
          Déclenchée par&nbsp;:{' '}
          {conv.events.map((e, i) => (
            <span key={e}>
              <code className="font-mono text-stone-700">{e}</code>
              {i < conv.events.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`ads-label-${conv.conversionLabelKey}`}>
          Étiquette Google Ads pour {conv.conversionLabelKey}
        </label>
        <input
          id={`ads-label-${conv.conversionLabelKey}`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="UGxLCMGJv6wcEMrHichD"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 font-mono text-xs text-stone-900 placeholder:text-stone-300 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
        />
        <p className="mt-1 text-[11px] text-stone-400">
          Partie après le <code>/</code> dans{' '}
          <code className="font-mono">AW-…/&lt;label&gt;</code>
        </p>
      </div>
    </li>
  );
}

function CategoryBadge({ category }: { category: AdsConversionCategory }): JSX.Element {
  return (
    <span
      title={`Catégorie API Google Ads : ${category}`}
      className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200"
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function RoleChip({ role }: { role: AdsConversionRole }): JSX.Element {
  if (role === 'primary') {
    return (
      <span
        title="Recommandée comme conversion principale (utilisée pour Smart Bidding)"
        className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
      >
        ★ Principale
      </span>
    );
  }
  return (
    <span
      title="Recommandée en observation (n'influence pas le bidding)"
      className="inline-flex items-center rounded-full bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-inset ring-stone-200"
    >
      Secondaire
    </span>
  );
}
