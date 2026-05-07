import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import {
  ContactHero,
  ContactCrossLinks,
  DirectContactBlock,
  FAQAccordion,
  type FAQAccordionItem,
} from '@/components/sections';
import { ContactForm } from '@/components/forms/ContactForm';
import { JsonLd } from '@/lib/seo/json-ld';
import { contactTypeSchema, type ContactType } from '@/lib/schemas';

const CONTACT_EMAIL = 'contact@femiglow.ma';
const SITE_URL = 'https://femiglow.ma';

export const metadata: Metadata = {
  title: 'Contact \u2014 la maison vous écrit',
  description:
    'Une question sur le rituel, le kit, une commande, un échange professionnel\u202F? Écrivez à la maison FemiGlow depuis Casablanca.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    title: 'Contact \u2014 FemiGlow',
    description: 'La maison vous répond sous 24 heures ouvrées.',
    url: `${SITE_URL}/contact`,
  },
  twitter: {
    card: 'summary',
    title: 'Contact \u2014 FemiGlow',
    description: 'La maison vous répond sous 24 heures ouvrées.',
  },
};

const faqs: FAQAccordionItem[] = [
  {
    id: 'duree-rituel',
    question: 'Combien de temps dure le rituel\u202F?',
    answer:
      'Quatre à six minutes, mains posées. La maison conseille deux à trois passages par semaine, le soir, pour laisser la cire travailler en silence.',
  },
  {
    id: 'ongles-fragiles',
    question: 'Mes ongles sont fragiles, est-ce indiqué\u202F?',
    answer:
      'Oui. Les matières sont choisies pour réparer sans agresser\u202F: cire d\u2019abeille, jojoba, kaolin doux. Aucun acétone, aucun durcisseur. Évitez seulement en cas d\u2019allergie connue à l\u2019un des ingrédients\u00A0; la liste figure sur la page Kit.',
  },
  {
    id: 'delais-livraison',
    question: 'Quels sont les délais de livraison\u202F?',
    answer:
      'Casablanca et Rabat\u00A0: 48 à 72 heures. Reste du Maroc\u00A0: 3 à 5 jours ouvrés. À l\u2019international, écrivez-nous, nous étudions chaque envoi à la main.',
  },
  {
    id: 'echantillon-avant-achat',
    question: 'Puis-je recevoir un échantillon avant achat\u202F?',
    answer:
      'Pas de pochette d\u2019essai en Phase 1. Si vous hésitez, écrivez-nous en précisant le type de peau et l\u2019usage souhaité. Nous prenons le temps de vous répondre.',
  },
];

const crossLinks = [
  { href: '/rituel', label: 'Lire le rituel' },
  { href: '/kit', label: 'Voir le kit' },
  { href: '/maison', label: 'La maison' },
];

const contactPointSchema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPoint',
  contactType: 'customer service',
  email: CONTACT_EMAIL,
  areaServed: 'MA',
  availableLanguage: ['French', 'Arabic'],
  url: `${SITE_URL}/contact`,
};

interface ContactPageProps {
  searchParams?: { type?: string };
}

function resolveDefaultType(raw: string | undefined): ContactType {
  const parsed = contactTypeSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'question';
}

export default function ContactPage({ searchParams }: ContactPageProps) {
  const defaultType = resolveDefaultType(searchParams?.type);

  return (
    <>
      <JsonLd data={contactPointSchema} />
      <ContactHero email={CONTACT_EMAIL} />
      <DirectContactBlock
        email={CONTACT_EMAIL}
        streetAddress="14 rue des Acacias"
        district="Bourgogne, Casablanca"
      />
      <section
        className="border-t border-encre/10 bg-creme py-16 sm:py-20"
        aria-labelledby="contact-form-heading"
      >
        <Container width="prose">
          <Heading
            as="h2"
            size="display-sm"
            id="contact-form-heading"
            className="mb-10"
          >
            Écrire à la maison.
          </Heading>
          <ContactForm defaultType={defaultType} />
        </Container>
      </section>
      <FAQAccordion items={faqs} />
      <ContactCrossLinks links={crossLinks} />
    </>
  );
}
