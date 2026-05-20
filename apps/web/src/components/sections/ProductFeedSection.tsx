/**
 * <ProductFeedSection/> — section de conversion forte sur `/kit`.
 *
 * Conçue pour densifier la fiche produit avec un bloc structuré
 * (hero + 4 gestes du rituel + 3 promesses + social proof condensé)
 * qui synthétise le pitch FemiGlow et applique plusieurs principes
 * Kolenda à la fois (cf. `lib/products/feed/kit-feed.ts` pour le
 * détail des principes — la copy est centralisée là-bas, jamais
 * en dur dans ce composant).
 *
 * Structure de la section :
 *   1. Hero copy : kicker + heading + lead + price-prefix + CTA + microcopy
 *   2. Grille 4 gestes (rituel officiel : Préparer · Paste · Powder · Résultat)
 *   3. Bandeau 3 promesses (origine naturelle · sans agressifs · forts/éclatants)
 *   4. Social proof condensé (rating + nombre + citation + auteur)
 *
 * Charte FemiGlow respectée :
 *  - Fond `bg-creme` (warm), pas de couleur criarde.
 *  - Pastilles 1/2 sauge, 3 pétale, 4 champagne — reprend le visuel.
 *  - Typo Cormorant (font-display) sur les titres, Inter (font-body) sur le texte.
 *  - Pas de superlatif, pas de countdown, pas de badge solde.
 */
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { PriceBlock } from '@/components/sections/PriceBlock';
import { cn } from '@/lib/utils/cn';
import type {
  FeedAccent,
  ProductFeed,
  ProductFeedClaim,
  ProductFeedStep,
} from '@/lib/products/feed/types';
import type { Product } from '@/lib/schemas';

/**
 * Mapping accent → classes Tailwind FemiGlow. Les pastilles reprennent
 * exactement les couleurs des 4 numéros du visuel produit officiel.
 */
const accentDot: Record<FeedAccent, string> = {
  sauge: 'bg-sauge-soft text-sauge-dark ring-1 ring-sauge-dark/15',
  petale: 'bg-petale-soft text-petale-dark ring-1 ring-petale-dark/15',
  champagne: 'bg-champagne-soft text-champagne-dark ring-1 ring-champagne-dark/15',
  ciel: 'bg-ciel-soft text-ciel-dark ring-1 ring-ciel-dark/15',
};

interface ProductFeedSectionProps {
  feed: ProductFeed;
  /** Produit ciblé — sert au tracking GA4 (`add_to_cart` proxy émis
   *  par `<CommanderAnchorButton/>` au scroll vers le wizard). */
  product: Product;
  /** Slug d'ancre pour le test E2E (default `product-feed`). */
  anchorId?: string;
}

export function ProductFeedSection({
  feed,
  product,
  anchorId = 'product-feed',
}: ProductFeedSectionProps) {
  return (
    <section
      id={anchorId}
      aria-labelledby="product-feed-title"
      className="bg-creme py-20 sm:py-28"
      data-testid="product-feed-section"
    >
      <Container width="wide">
        {/* 1 — Hero copy ------------------------------------------------ */}
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <Kicker tone="champagne">{feed.hero.kicker}</Kicker>
          <Heading id="product-feed-title" as="h2" size="display-md">
            {feed.hero.title}
          </Heading>
          <Text size="lead" tone="secondary" prose className="mx-auto">
            {feed.hero.lead}
          </Text>

          {/* PriceBlock — Kolenda §4.6 : prix XXL, prix barré, bandeau
              économie terracotta, ValueBreakdownList, perUsageHint,
              CTA primaire + microcopy. IntersectionObserver émet
              pack_section_view + pack_economy_view. */}
          <PriceBlock feed={feed} product={product} />
        </div>

        {/* 2 — Rituel 4 gestes ------------------------------------------ */}
        <ol
          role="list"
          aria-label="Les quatre gestes du rituel"
          className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
        >
          {feed.steps.map((step) => (
            <FeedStepCard key={step.step} step={step} />
          ))}
        </ol>

        {/* 3 — Promesses (3 claims) ------------------------------------- */}
        <ul
          role="list"
          aria-label="Promesses produit"
          className="mt-20 grid grid-cols-1 gap-8 border-y border-encre/10 py-10 sm:grid-cols-3"
        >
          {feed.claims.map((claim) => (
            <FeedClaimItem key={claim.label} claim={claim} />
          ))}
        </ul>

        {/* 4 — Social proof condensé ------------------------------------ */}
        <figure
          aria-label="Avis clientes"
          className="mx-auto mt-16 max-w-2xl rounded-md border border-encre/10 bg-creme-warm px-8 py-10 text-center"
          data-testid="product-feed-social-proof"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-champagne-dark">
            <span aria-hidden="true">★★★★★</span>
            <span className="font-medium tabular-nums">
              {feed.socialProof.rating.toFixed(1)}/5
            </span>
            <span className="text-encre/50">·</span>
            <span className="text-encre/70 tabular-nums">
              {feed.socialProof.reviewsCount} avis
            </span>
          </div>
          <blockquote className="mt-4">
            <Text size="lead" italic prose className="mx-auto">
              {`\u00ab\u202f${feed.socialProof.quote}\u202f\u00bb`}
            </Text>
          </blockquote>
          <figcaption className="mt-3 text-xs uppercase tracking-[0.18em] text-encre/55">
            {feed.socialProof.authorLabel}
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}

/** Carte d'une étape du rituel (1/4). */
function FeedStepCard({ step }: { step: ProductFeedStep }) {
  return (
    <li>
      <article className="flex h-full flex-col gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-12 w-12 items-center justify-center rounded-full font-display text-xl',
            accentDot[step.accent],
          )}
        >
          {step.step}
        </span>
        <Kicker>{step.kicker}</Kicker>
        <Heading as="h3" size="sm">
          {step.title}
        </Heading>
        <Text size="body" tone="secondary" prose>
          {step.description}
        </Text>
      </article>
    </li>
  );
}

/** Item promesse : icône SVG + libellé + détail. */
function FeedClaimItem({ claim }: { claim: ProductFeedClaim }) {
  return (
    <li className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
      <span
        className={cn(
          'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          claim.icon === 'leaf' && 'bg-sauge-soft text-sauge-dark',
          claim.icon === 'drop' && 'bg-ciel-soft text-ciel-dark',
          claim.icon === 'sparkle' && 'bg-petale-soft text-petale-dark',
        )}
        aria-hidden="true"
      >
        <FeedClaimIcon name={claim.icon} />
      </span>
      <div className="space-y-1">
        <Text size="body" className="font-medium">
          {claim.label}
        </Text>
        <Text size="caption" tone="tertiary" className="!normal-case !tracking-normal">
          {claim.detail}
        </Text>
      </div>
    </li>
  );
}

/**
 * Icônes SVG inline (3 pictos, légers, sans dépendance externe).
 * Charte : trait fin, courbes douces, en cohérence avec la typo Cormorant.
 */
function FeedClaimIcon({ name }: { name: 'leaf' | 'drop' | 'sparkle' }) {
  const stroke = 'currentColor';
  if (name === 'leaf') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Origine naturelle">
        <path d="M5 19c8 0 14-6 14-14-7 0-14 5-14 14Z" />
        <path d="M5 19c4-4 7-7 12-12" />
      </svg>
    );
  }
  if (name === 'drop') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Sans agressif">
        <path d="M12 3.5s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Ongles éclatants">
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path d="M7.5 7.5l2.2 2.2M14.3 14.3l2.2 2.2M16.5 7.5l-2.2 2.2M9.7 14.3l-2.2 2.2" />
    </svg>
  );
}
