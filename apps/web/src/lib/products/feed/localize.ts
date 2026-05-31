/**
 * Phase 7E — Overlay de localisation du `ProductFeed`.
 *
 * `kit-feed.ts` (`buildKitProductFeed`) reste **pur et FR** : il alimente
 * aussi le flux Google Shopping (Merchant XML) et le JSON-LD, qui doivent
 * garder une copy canonique. On ne touche donc pas au builder.
 *
 * À la place, `<ProductFeedSectionBound>` applique cet overlay APRÈS la
 * construction du feed, uniquement pour l'affichage HTML des locales non
 * défaut (AR/EN). Toutes les strings proviennent du namespace
 * `marketing.kit.product_feed` (couverture 43/43 vérifiée FR/AR/EN).
 *
 * @see apps/web/messages/{fr,ar,en}.json → marketing.kit.product_feed
 */
import type { ProductFeed } from './types';

/**
 * Fonction de traduction scoped sur `marketing.kit.product_feed`. On la
 * type librement (clé string) car next-intl interdit les clés dynamiques
 * (`steps.${key}.title`) en strict ; le runtime les résout sans souci.
 */
export type ProductFeedTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * Phase 9 i18n STRICT — sur /ar, le code devise latin `MAD` ne doit pas
 * fuiter dans les libellés chiffrés conservés (prix barré, valueBreakdown,
 * coût par soin). On le remplace par درهم. Les chiffres restent latins
 * (cohérence de marque).
 */
function localizeCurrencyUnit(label: string, locale?: string): string {
  if (locale !== 'ar') return label;
  return label.replace(/\bMAD\b/g, 'درهم').replace(/\bAED\b/g, 'درهم إماراتي');
}

/** Parse « ≈ 1,53 MAD par soin sur 47 jours » → { amount, days }. */
function parsePerUsage(hint: string): { amount: string; days: string } | null {
  const m = hint.match(/≈\s*([\d.,]+)\s+\S+.*?(\d+)\s*\S+\s*$/);
  if (!m || !m[1] || !m[2]) return null;
  return { amount: m[1], days: m[2] };
}

// L'étape porte un numéro (1..4) ; on mappe vers la clé du namespace messages.
const STEP_KEY_BY_NUMBER: Record<number, string> = {
  1: 'preparation',
  2: 'paste',
  3: 'powder',
  4: 'step4',
};

// Le claim porte une icône ; on mappe vers la clé du namespace messages.
const CLAIM_KEY_BY_ICON: Record<string, string> = {
  leaf: 'naturel',
  drop: 'agressif',
  sparkle: 'eclatants',
};

// Le `valueBreakdown` du hero (kit-feed.ts `buildHero`) est ordonné :
// [paste, powder, buffer, notice(muted), shipping(muted)]. On mappe la
// position vers la clé du namespace `value_breakdown.*` pour traduire le
// `label`. La logique numérique (`valueLabel` prix) est préservée pour les
// items non `muted` ; pour les items `muted` (offert), on bascule le
// `valueLabel` sur `value_breakdown.free`.
const VALUE_BREAKDOWN_KEY_BY_INDEX: Record<number, string> = {
  0: 'paste',
  1: 'powder',
  2: 'buffer',
  3: 'notice',
  4: 'shipping',
};

/**
 * Retourne une copie du feed avec toutes les strings affichables traduites.
 * Les champs non textuels (accent, duration, icon, prix, ratings…) sont
 * préservés tels quels — seule la copy bascule de locale. Le `valueBreakdown`
 * voit ses `label` traduits ; les `valueLabel` chiffrés (prix) restent intacts,
 * sauf les items `muted` (offert → `value_breakdown.free`).
 */
export function localizeKitProductFeed(
  feed: ProductFeed,
  t: ProductFeedTranslate,
  locale?: string,
): ProductFeed {
  // `valueBreakdown` localisé — le `label` bascule de locale ; le `valueLabel`
  // chiffré des items non-muted (prix dérivés du Product) reste intact SAUF le
  // code devise (MAD → درهم sur /ar). Les items `muted` → `value_breakdown.free`.
  const localizedValueBreakdown = feed.hero.valueBreakdown?.map((item, index) => {
    const key = VALUE_BREAKDOWN_KEY_BY_INDEX[index];
    if (!key) return item;
    return {
      ...item,
      label: t(`value_breakdown.${key}`),
      ...(item.muted
        ? { valueLabel: t('value_breakdown.free') }
        : { valueLabel: localizeCurrencyUnit(item.valueLabel, locale) }),
    };
  });

  // Coût par soin — sur /ar la microcopy FR « par soin sur N jours » + le code
  // MAD fuitent. On reconstruit via le gabarit ICU `per_usage.phrase` localisé.
  const localizedPerUsage = (() => {
    if (!feed.hero.perUsageHint) return undefined;
    if (locale !== 'ar') return feed.hero.perUsageHint;
    const parsed = parsePerUsage(feed.hero.perUsageHint);
    if (!parsed) return localizeCurrencyUnit(feed.hero.perUsageHint, locale);
    return t('per_usage.phrase', {
      amount: parsed.amount,
      currency: 'درهم',
      days: parsed.days,
    });
  })();

  return {
    ...feed,
    hero: {
      ...feed.hero,
      kicker: t('hero.kicker'),
      title: t('hero.title'),
      lead: t('hero.lead'),
      pricePrefix: t('hero.price_prefix'),
      ctaLabel: t('hero.cta_label'),
      ctaMicrocopy: t('hero.cta_microcopy'),
      // Phase 7 wiring — gabarit ICU localisé du bandeau économie. La clé porte
      // des placeholders ICU `{amount}`/`{currency}`/`{pct}` ; on les ré-émet
      // tels quels (valeurs = leur propre placeholder) pour récupérer le gabarit
      // brut sans déclencher d'erreur ICU « MISSING_VALUE ». C'est ensuite
      // `<PriceBlock>` qui substitue les valeurs calculées (savings dérivé du
      // Product, indisponible ici). En FR (défaut) l'overlay n'est pas appelé →
      // `savingsPhrase` reste absent → sortie byte-identique `formatSavingsLabel`.
      savingsPhrase: t('value_breakdown.savings_phrase', {
        amount: '{amount}',
        currency: '{currency}',
        pct: '{pct}',
      }),
      // Prix barré « non packagé » — code devise localisé (MAD → درهم sur /ar).
      ...(feed.hero.priceCompareAt
        ? { priceCompareAt: localizeCurrencyUnit(feed.hero.priceCompareAt, locale) }
        : {}),
      // aria-label du prix barré, recomposé via le gabarit `compare_at_aria`.
      ...(feed.hero.priceCompareAt
        ? {
            priceCompareAtAriaLabel: t('compare_at_aria', {
              price: localizeCurrencyUnit(feed.hero.priceCompareAt, locale),
            }),
          }
        : {}),
      // Coût par soin localisé (microcopy + devise).
      ...(localizedPerUsage ? { perUsageHint: localizedPerUsage } : {}),
      // `as` : sous `exactOptionalPropertyTypes`, réassigner une prop optionnelle
      // via spread élargit son type ; le runtime préserve la valeur (ou absence).
      ...(localizedValueBreakdown
        ? { valueBreakdown: localizedValueBreakdown }
        : {}),
    } as ProductFeed['hero'],
    steps: feed.steps.map((step) => {
      const key = STEP_KEY_BY_NUMBER[step.step];
      if (!key) return step;
      return {
        ...step,
        kicker: t(`steps.${key}.kicker`),
        title: t(`steps.${key}.title`),
        description: t(`steps.${key}.description`),
      };
    }),
    // `as` : sous `exactOptionalPropertyTypes`, le spread d'une prop optionnelle
    // élargit son type en `T | undefined`, incompatible avec l'optionnel exact
    // de la cible. Les valeurs runtime sont préservées intactes par le spread.
    stepsHeader: {
      ...feed.stepsHeader,
      kicker: t('steps.header.kicker'),
      totalDuration: t('steps.header.total_duration'),
      lead: t('steps.header.lead'),
    } as ProductFeed['stepsHeader'],
    stepsPostCta: {
      ...feed.stepsPostCta,
      label: t('steps.post_cta.label'),
    } as ProductFeed['stepsPostCta'],
    claims: feed.claims.map((claim) => {
      const key = CLAIM_KEY_BY_ICON[claim.icon];
      if (!key) return claim;
      return {
        ...claim,
        label: t(`claims.${key}.label`),
        detail: t(`claims.${key}.detail`),
      };
    }),
    socialProof: {
      ...feed.socialProof,
      // La citation + l'auteur viennent du CMS (`content.handsTestimonials`,
      // déjà locale-aware) ; on ne traduit ici que le libellé géo dérivé.
      countLabelGeo: t('social_proof.count_label_geo', {
        count: feed.socialProof.reviewsCount,
      }),
    },
  };
}
