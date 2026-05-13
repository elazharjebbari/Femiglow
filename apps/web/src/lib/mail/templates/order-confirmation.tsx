import { Button, Heading, Section, Text } from '@react-email/components';
import { BaseLayout } from './_shared/BaseLayout';

type Props = {
  firstName: string;
  orderId: string;
  orderTotal: string;
  itemsCount: number;
  deliveryEstimate: string;
};

export default function OrderConfirmation({
  firstName,
  orderId,
  orderTotal,
  itemsCount,
  deliveryEstimate,
}: Props) {
  return (
    <BaseLayout
      preheader={`${itemsCount} article(s) · livraison ${deliveryEstimate}`}
    >
      <Heading as="h2" className="m-0 font-display text-2xl text-brand-encre">
        Ta commande est confirmée, {firstName}
      </Heading>
      <Text className="mt-4 text-stone-700">
        Merci pour ta confiance ✨ Voici le récap de ta commande :
      </Text>

      <Section className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <Text className="m-0 text-sm text-stone-600">
          Référence : <strong className="font-mono text-stone-900">{orderId}</strong>
        </Text>
        <Text className="m-0 mt-1 text-sm text-stone-600">
          Articles : <strong>{itemsCount}</strong>
        </Text>
        <Text className="m-0 mt-1 text-sm text-stone-600">
          Total : <strong>{orderTotal}</strong>
        </Text>
        <Text className="m-0 mt-1 text-sm text-stone-600">
          Livraison estimée : <strong>{deliveryEstimate}</strong>
        </Text>
      </Section>

      <Section className="mt-6">
        <Button
          href={`https://femiglow-maroc.com/compte/commandes/${orderId}`}
          className="inline-block rounded-md bg-brand-sauge px-5 py-3 text-sm font-medium text-white no-underline"
        >
          Suivre ma commande →
        </Button>
      </Section>

      <Text className="mt-6 text-sm text-stone-600">
        Une question ? Réponds simplement à ce mail, on te lit.
      </Text>
    </BaseLayout>
  );
}
