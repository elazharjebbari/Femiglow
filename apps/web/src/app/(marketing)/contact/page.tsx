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

const CONTACT_EMAIL = 'info@femiglow-maroc.com';
const CONTACT_PHONE = '+212 630-035905';
const SITE_URL = 'https://femiglow-maroc.com';

export const metadata: Metadata = {
  title: 'Contact \u2014 la maison vous écrit',
  description:
    'Une question sur le rituel, le pack, une commande, une formation\u202F? Écrivez à la maison FemiGlow depuis Rabat (25 bis avenue Patrice Lumumba).',
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
      'Cinq minutes par soir, mains pos\u00E9es. Deux gestes \u2014 paste, powder \u2014 puis le polissoir Step 4 en finition. La maison conseille un passage par jour pour installer la cadence.',
  },
  {
    id: 'ongles-fragiles',
    question: 'Mes ongles sont fragiles, est-ce indiqu\u00E9\u202F?',
    answer:
      'Oui. Les mati\u00E8res sont choisies pour r\u00E9parer sans agresser\u202F: cire d\u2019abeille, jojoba, talc cosm\u00E9tique, poudre de riz, kaolin polissant. Aucun ac\u00E9tone, aucun durcisseur. \u00C9vitez seulement en cas d\u2019allergie connue \u00E0 l\u2019un des ingr\u00E9dients\u00A0; la liste compl\u00E8te figure sur la page Pack.',
  },
  {
    id: 'delais-livraison',
    question: 'Quels sont les d\u00E9lais de livraison\u202F?',
    answer:
      'Rabat\u00A0: 24 heures. Casablanca et Sal\u00E9\u00A0: 24 \u00E0 48 heures. Reste du Maroc\u00A0: 48 \u00E0 72 heures. Livraison offerte au Maroc, sans seuil. \u00C0 l\u2019international, \u00E9crivez-nous, nous \u00E9tudions chaque envoi \u00E0 la main.',
  },
  {
    id: 'formation-souheila',
    question: 'Comment suivre une formation avec Souheila\u202F?',
    answer:
      'Souheila anime des formations \u00E0 la manucure japonaise et \u00E0 la fabrication cosm\u00E9tique dans l\u2019atelier de Rabat. \u00C9crivez \u00E0 info@femiglow-maroc.com en pr\u00E9cisant votre profil (esth\u00E9ticienne, formulatrice, \u00E9cole). Nous r\u00E9pondons sous trois jours.',
  },
  {
    id: 'echantillon-avant-achat',
    question: 'Puis-je recevoir un \u00E9chantillon avant achat\u202F?',
    answer:
      'En cas d\u2019h\u00E9sitation pour cause d\u2019allergie, nous adressons un \u00E9chantillon de la paste avant l\u2019envoi du pack complet. \u00C9crivez-nous en pr\u00E9cisant l\u2019ingr\u00E9dient qui vous inqui\u00E8te.',
  },
];

const crossLinks = [
  { href: '/rituel', label: 'Lire le rituel' },
  { href: '/kit', label: 'Voir le pack' },
  { href: '/maison', label: 'La maison' },
];

const contactPointSchema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPoint',
  contactType: 'customer service',
  email: CONTACT_EMAIL,
  telephone: CONTACT_PHONE.replace(/\s|-/g, ''),
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
        streetAddress="25 bis avenue Patrice Lumumba"
        district="Rabat"
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
