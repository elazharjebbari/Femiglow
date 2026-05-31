import { Link, Section, Text } from '@react-email/components';

export function Footer() {
  return (
    <Section className="text-center text-xs text-stone-600">
      <Text className="m-0">
        FemiGlow · Rabat, Maroc ·{' '}
        <Link href="https://femiglow-maroc.com" className="text-brand-sauge underline">
          femiglow-maroc.com
        </Link>
      </Text>
      <Text className="m-0 mt-2">
        Tu reçois cet email parce que tu es en contact avec FemiGlow.
        <br />
        <Link
          href="{{unsubscribe_url}}"
          className="text-brand-sauge underline"
        >
          Se désabonner
        </Link>{' '}
        ·{' '}
        <Link
          href="https://femiglow-maroc.com/legal/confidentialite"
          className="text-stone-600 underline"
        >
          Confidentialité
        </Link>
      </Text>
    </Section>
  );
}
