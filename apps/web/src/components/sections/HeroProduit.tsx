import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Reassurance } from '@/components/ui/Reassurance';
import { Text } from '@/components/ui/Text';
import { AddToCartButton } from '@/components/commerce/AddToCartButton';
import { PriceDisplay } from '@/components/commerce/PriceDisplay';
import { ViewItemTracker } from '@/components/tracking/ViewItemTracker';
import { computePromo } from '@/lib/utils/promo';
import type { Product, Reassurance as ReassuranceData } from '@/lib/schemas';

interface HeroProduitProps {
  product: Product;
  reassurances: ReassuranceData[];
  observeId?: string;
  /** Slot media résolu côté serveur. Remplace `product.images[0]`. */
  mediaSlot?: ReactNode;
}

export function HeroProduit({
  product,
  reassurances,
  observeId = 'hero-produit-anchor',
  mediaSlot,
}: HeroProduitProps) {
  const heroImage = product.images[0];
  // Tracking GA4 : `view_item.value` doit refléter le prix VU par
  // l'utilisateur — donc le prix promo si une promo est active. La logique
  // est centralisée dans `computePromo` (cf. lib/utils/promo.ts) pour rester
  // cohérente avec l'add-to-cart.
  const promo = computePromo(product.priceCents, product.promoPriceCents);
  return (
    <section
      aria-labelledby="hero-kit-title"
      className="relative bg-creme-warm py-12 sm:py-20"
    >
      <ViewItemTracker
        itemId={product.id}
        itemName={product.name}
        priceCents={promo.effectivePriceCents}
        currency={product.currency}
      />
      <Container width="page">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            {mediaSlot ? (
              mediaSlot
            ) : heroImage ? (
              <Image
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                ratio="4:5"
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 50vw, 100vw"
                blurDataURL={heroImage.blurDataURL}
              />
            ) : null}
          </div>
          <div className="space-y-6 lg:pt-8">
            <Kicker>Le rituel</Kicker>
            <Heading id="hero-kit-title" as="h1" size="display-md">
              {product.name}
            </Heading>
            <Text size="lead" tone="secondary" prose>
              {product.tagline}
            </Text>
            <Text size="body" tone="secondary" prose>
              {product.description}
            </Text>
            {/*
              Bloc prix : <PriceDisplay> gère seul le cas promo/non-promo
              (charte II.5 + Kolenda Pricing #3, #7, #10, #34). Quand
              `promoPriceCents` est null on retombe sur un simple span ; quand
              il est actif, on affiche prix actif + barré + label discret.
            */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 pt-2">
              <PriceDisplay
                priceCents={product.priceCents}
                promoPriceCents={product.promoPriceCents}
                currency={product.currency}
                size="xl"
              />
              <Kicker>Livraison 48&#x202f;h</Kicker>
            </div>
            {/*
              CTA principal — Charte VII.5 : verbe d'invitation (« composer »)
              plutôt qu'« ajouter au panier » qui fait gestionnaire e-commerce.
              L'action déclenchée reste un add-to-cart + ouverture de la
              MiniCartSlideOver (cf. AddToCartButton) → checkout direct possible.

              Le lien secondaire « Voir le rituel ↗ » est supprimé : il dilue
              le funnel (le rituel est exposé plus bas dans la page) et la
              charte recommande de ne pas multiplier les options à proximité
              du CTA. À la place, micro-rassurance condensée (Kolenda #11 :
              shrink + densify the payment section).
            */}
            <div className="space-y-3 pt-2">
              <AddToCartButton product={product} size="lg" fullWidth>
                Composer mon rituel
              </AddToCartButton>
              <p className="text-center text-[11px] uppercase tracking-[0.2em] text-encre/55">
                Paiement sécurisé · Retour 14&#x202f;j · Livraison 48&#x202f;h
              </p>
            </div>
            {reassurances.length > 0 ? (
              <ul
                aria-label="Réassurances"
                className="grid grid-cols-1 gap-4 border-t border-encre/10 pt-6 sm:grid-cols-3"
              >
                {reassurances.map((r) => (
                  <li key={r.label}>
                    <Reassurance icon={r.icon} label={r.label} detail={r.detail} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Container>
      <div id={observeId} aria-hidden="true" className="h-px w-full" />
    </section>
  );
}
