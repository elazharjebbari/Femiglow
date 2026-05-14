import { Button, Heading, Section, Text } from '@react-email/components';
import { BaseLayout } from './_shared/BaseLayout';

type Props = {
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export default function PasswordReset({ firstName, resetUrl, expiresInMinutes }: Props) {
  return (
    <BaseLayout preheader={`Réinitialise ton mot de passe FemiGlow, ${firstName}.`}>
      <Heading as="h2" className="m-0 font-display text-2xl text-brand-encre">
        Réinitialisation de ton mot de passe
      </Heading>
      <Text className="mt-4 text-stone-700">
        Bonjour {firstName},
      </Text>
      <Text className="mt-2 text-stone-700">
        Tu as demandé à réinitialiser ton mot de passe FemiGlow. Clique
        ci-dessous pour en choisir un nouveau :
      </Text>
      <Section className="mt-6 text-center">
        <Button
          href={resetUrl}
          className="inline-block rounded-md bg-brand-sauge px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Réinitialiser mon mot de passe →
        </Button>
      </Section>
      <Text className="mt-6 text-sm text-stone-600">
        Ce lien expire dans <strong>{expiresInMinutes} minutes</strong>. Si tu
        n'as pas fait cette demande, ignore simplement ce mail — ton mot de
        passe reste inchangé.
      </Text>
      <Text className="mt-4 text-xs text-stone-500">
        Pour des raisons de sécurité, ne partage jamais ce lien.
      </Text>
    </BaseLayout>
  );
}
