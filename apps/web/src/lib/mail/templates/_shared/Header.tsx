import { Heading, Section, Text } from '@react-email/components';

export function Header() {
  return (
    <Section className="text-center">
      <Heading
        as="h1"
        className="m-0 font-display text-3xl text-brand-encre"
        style={{ letterSpacing: '-0.01em' }}
      >
        FemiGlow
      </Heading>
      <Text className="m-0 mt-1 text-xs uppercase tracking-widest text-brand-sauge">
        Rituels conscients · Maroc
      </Text>
    </Section>
  );
}
