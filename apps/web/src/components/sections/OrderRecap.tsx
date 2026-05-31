import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { formatPrice } from '@/lib/utils/format-price';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';
import type { LastOrderPayload } from '@/lib/stores/checkout-draft';

const paymentLabel: Record<LastOrderPayload['paymentMethod'], string> = {
  card: 'Carte bancaire (Stripe)',
  cmi: 'Carte marocaine (CMI)',
  cod: 'Paiement à la livraison',
};

/**
 * CHA-230 — map legacy slug → label affiché. Sert uniquement aux drafts
 * pré-CHA-230 (où `city` était un slug comme `casablanca`). Pour les
 * commandes post-CHA-230, `address.city` est déjà un texte libre normalisé
 * par le combobox, donc on l'affiche tel quel via le fallback `?? city`.
 */
const cityLabel: Record<string, string> = {
  casablanca: 'Casablanca',
  rabat: 'Rabat',
  marrakech: 'Marrakech',
  fes: 'Fès',
  tanger: 'Tanger',
  agadir: 'Agadir',
  meknes: 'Meknès',
  oujda: 'Oujda',
  tetouan: 'Tétouan',
  sale: 'Salé',
};

interface OrderRecapProps {
  order: LastOrderPayload;
}

export function OrderRecap({ order }: OrderRecapProps) {
  // Backward-compat : ancien draft avec `city='autre'` + `cityOther` rempli.
  const cityDisplay =
    order.address.city === 'autre'
      ? order.address.cityOther ?? '—'
      : cityLabel[order.address.city] ?? order.address.city;

  return (
    <section
      aria-labelledby="order-recap-heading"
      className="border-b border-encre/10 py-16"
    >
      <Container width="page">
        <Heading
          as="h2"
          id="order-recap-heading"
          size="md"
          className="mb-10 text-center"
        >
          Votre commande, en détail.
        </Heading>

        <div className="grid gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-encre/60">
              Articles
            </p>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-encre/80">
                    {item.productName}
                    <span className="text-encre/50">
                      {' '}× {item.quantity}
                    </span>
                  </span>
                  <span className="text-encre">
                    {formatPrice(item.unitPriceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-encre/10 pt-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-encre/70">Sous-total</dt>
                <dd className="text-encre">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-encre/70">Livraison</dt>
                <dd className="text-encre">
                  {order.freeShipping &&
                  order.catalogShippingCents &&
                  order.catalogShippingCents > 0 ? (
                    <ShippingPriceDisplay
                      displayPrice={formatPrice(order.catalogShippingCents)}
                      freeShipping
                      size="sm"
                      align="right"
                    />
                  ) : (
                    formatPrice(order.shipping)
                  )}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-encre/10 pt-2">
                <dt className="font-medium text-encre">Total</dt>
                <dd className="font-display text-lg text-encre">
                  {formatPrice(order.total)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-encre/60">
              Adresse
            </p>
            <address className="not-italic text-sm leading-[1.7] text-encre/80">
              {order.address.line1 && <p>{order.address.line1}</p>}
              {order.address.line2 && <p>{order.address.line2}</p>}
              {order.address.quartier && <p>{order.address.quartier}</p>}
              <p>{cityDisplay}</p>
              {order.address.postalCode && <p>{order.address.postalCode}</p>}
              <p className="pt-2 text-encre/60">Maroc</p>
            </address>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-encre/60">
              Paiement
            </p>
            <p className="text-sm text-encre/80">
              {paymentLabel[order.paymentMethod]}
            </p>
            {order.email ? (
              <p className="text-xs text-encre/60">
                Une copie détaillée sera envoyée à {order.email}.
              </p>
            ) : (
              <p className="text-xs text-encre/60">
                Vous serez rappelée au numéro indiqué pour confirmer.
              </p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
