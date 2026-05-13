import { Button, Heading, Section, Text } from '@react-email/components';
import { BaseLayout } from './_shared/BaseLayout';

type Props = {
  confirmUrl: string;
};

export default function NewsletterConfirm({ confirmUrl }: Props) {
  return (
    <BaseLayout preheader="Confirme ton inscription à la newsletter FemiGlow en un clic.">
      <Heading as="h2" className="m-0 font-display text-2xl text-brand-encre">
        Plus qu'un clic ✨
      </Heading>
      <Text className="mt-4 text-stone-700">
        Tu viens de t'inscrire à notre newsletter — pour confirmer que c'est
        bien toi (et pas un robot), clique sur le bouton ci-dessous :
      </Text>
      <Section className="mt-6 text-center">
        <Button
          href={confirmUrl}
          className="inline-block rounded-md bg-brand-sauge px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Je confirme mon inscription →
        </Button>
      </Section>
      <Text className="mt-6 text-sm text-stone-600">
        Tu n'as rien demandé ? Aucun souci, ignore simplement ce mail — sans
        clic, ton adresse ne sera jamais ajoutée à notre liste.
      </Text>
      <Text className="mt-6 text-xs text-stone-500">
        Le lien de confirmation expire dans 7 jours. Si ce délai est passé,
        il te suffit de t'inscrire à nouveau depuis le site.
      </Text>
    </BaseLayout>
  );
}
