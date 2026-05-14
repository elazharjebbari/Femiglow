import { Heading, Section, Text, Link } from '@react-email/components';
import { BaseLayout } from './_shared/BaseLayout';

type Props = {
  leadName: string;
  leadPhone: string;
  leadEmail: string | null;
  intent: string;
  outcomeContext: string;
  adminUrl: string;
};

export default function LeadNotification({
  leadName,
  leadPhone,
  leadEmail,
  intent,
  outcomeContext,
  adminUrl,
}: Props) {
  return (
    <BaseLayout preheader={`Nouveau lead chat : ${leadName} (${leadPhone})`}>
      <Heading as="h2" className="m-0 font-display text-2xl text-brand-encre">
        🔥 Nouveau lead chat
      </Heading>
      <Text className="mt-4 text-stone-700">
        Une visiteuse vient de laisser ses coordonnées via le chat. À
        recontacter dans les meilleurs délais.
      </Text>

      <Section className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <Text className="m-0 text-sm text-stone-600">
          <strong>Prénom :</strong> {leadName}
        </Text>
        <Text className="m-0 mt-1 text-sm text-stone-600">
          <strong>Téléphone :</strong>{' '}
          <Link href={`tel:${leadPhone}`} className="text-brand-sauge underline">
            {leadPhone}
          </Link>
        </Text>
        {leadEmail ? (
          <Text className="m-0 mt-1 text-sm text-stone-600">
            <strong>Email :</strong>{' '}
            <Link href={`mailto:${leadEmail}`} className="text-brand-sauge underline">
              {leadEmail}
            </Link>
          </Text>
        ) : null}
        <Text className="m-0 mt-1 text-sm text-stone-600">
          <strong>Intent détecté :</strong> {intent}
        </Text>
      </Section>

      <Text className="mt-4 text-sm text-stone-700">
        <strong>Contexte (6 derniers échanges) :</strong>
      </Text>
      <Section className="mt-2 rounded-lg bg-stone-50 p-3 text-stone-600">
        <Text className="m-0 whitespace-pre-wrap text-xs italic">
          {outcomeContext}
        </Text>
      </Section>

      <Section className="mt-6">
        <Link
          href={adminUrl}
          className="text-sm font-medium text-brand-sauge underline"
        >
          Voir la fiche complète dans l'admin →
        </Link>
      </Section>
    </BaseLayout>
  );
}
