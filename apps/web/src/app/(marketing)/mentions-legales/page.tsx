import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';

const SITE_URL = 'https://femiglow-maroc.com';
const COMPANY_NAME = 'FemiGlow';
const COMPANY_ADDRESS = '25 bis avenue Patrice Lumumba, Rabat, Maroc';
const COMPANY_EMAIL = 'info@femiglow-maroc.com';
const COMPANY_PHONE = '+212 630-035905';

export const metadata: Metadata = {
  title: 'Mentions légales — FemiGlow',
  description:
    'Mentions légales du site FemiGlow : éditeur, hébergement, propriété intellectuelle, données personnelles, cookies.',
  alternates: { canonical: '/mentions-legales' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: 'Mentions légales — FemiGlow',
    description: 'Informations légales de la maison FemiGlow.',
    url: `${SITE_URL}/mentions-legales`,
  },
};

export default function MentionsLegalesPage() {
  return (
    <main className="bg-creme py-16 sm:py-24">
      <Container width="prose">
        <article className="prose-femiglow space-y-8 font-body text-encre">
          <header className="space-y-3 text-center">
            <p className="text-kicker font-medium uppercase tracking-[0.2em] text-encre/70">
              Informations légales
            </p>
            <h1 className="font-display text-display-md font-medium text-encre [text-wrap:balance]">
              Mentions légales
            </h1>
            <p className="text-sm text-encre/70">
              Dernière mise à jour&nbsp;: 13 mai 2026
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-encre">Éditeur du site</h2>
            <p>
              <strong>{COMPANY_NAME}</strong><br />
              Adresse&nbsp;: {COMPANY_ADDRESS}<br />
              Email&nbsp;: <a className="underline underline-offset-4" href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a><br />
              Téléphone&nbsp;: <a className="underline underline-offset-4" href={`tel:${COMPANY_PHONE.replace(/\s/g, '')}`}>{COMPANY_PHONE}</a>
            </p>
            <p>
              Directrice de la publication&nbsp;: Salma Jebbari, fondatrice de FemiGlow.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-encre">Hébergement</h2>
            <p>
              Le site est hébergé sur un serveur dédié situé en France/Maroc.
              Pour toute demande relative à l&apos;hébergement, contactez la maison via{' '}
              <a className="underline underline-offset-4" href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-encre">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble des contenus présents sur ce site (textes, photographies,
              illustrations, logos, vidéos, mise en page, identité graphique) sont
              la propriété exclusive de FemiGlow ou de ses partenaires éditoriaux,
              et sont protégés par les lois marocaines et internationales relatives
              à la propriété intellectuelle.
            </p>
            <p>
              Toute reproduction, représentation, modification, publication, adaptation
              ou exploitation, partielle ou intégrale, par quelque procédé que ce soit
              et sur quelque support que ce soit, est interdite sans autorisation écrite
              préalable de FemiGlow.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-encre">Données personnelles</h2>
            <p>
              Les informations recueillies via les formulaires (contact, commande,
              newsletter) sont enregistrées et traitées par FemiGlow pour répondre
              à votre demande, livrer une commande, ou vous tenir informé(e) de la
              vie de la maison (avec votre consentement explicite).
            </p>
            <p>
              Conformément à la loi marocaine n°&nbsp;09-08 relative à la protection
              des données personnelles, et au RGPD européen pour les visiteurs de
              l&apos;Union européenne, vous disposez d&apos;un droit d&apos;accès,
              de rectification, de portabilité et de suppression de vos données.
              Pour exercer ces droits, écrivez à{' '}
              <a className="underline underline-offset-4" href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>.
            </p>
            <p>
              Les données ne sont jamais revendues ni cédées à des tiers commerciaux.
              Elles peuvent être partagées avec nos sous-traitants (livreur, prestataire
              de paiement) uniquement dans la mesure strictement nécessaire à
              l&apos;exécution du service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-encre">Cookies & traceurs</h2>
            <p>
              Ce site utilise des cookies techniques (session, panier, préférences)
              indispensables au fonctionnement, et — sous réserve de votre consentement
              via le bandeau de gestion — des cookies de mesure d&apos;audience anonymisés
              et des cookies tiers (Meta, Google Analytics, TikTok) à des fins
              d&apos;amélioration de l&apos;expérience et de communication.
            </p>
            <p>
              Vous pouvez à tout moment ajuster vos préférences via la bannière de
              consentement (icône de gestion en bas de page).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-encre">Conditions de vente</h2>
            <p>
              Les conditions générales de vente applicables aux commandes passées
              sur ce site sont communiquées au moment du checkout et envoyées par
              email lors de la confirmation de commande.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium text-encre">Loi applicable & juridiction</h2>
            <p>
              Le présent site est régi par le droit marocain. En cas de litige,
              les tribunaux de Rabat seront seuls compétents, sauf disposition
              légale impérative contraire.
            </p>
          </section>

          <footer className="pt-8 text-sm text-encre/60">
            <p>
              Pour toute question relative à ces mentions légales, contactez la maison&nbsp;:{' '}
              <a className="underline underline-offset-4" href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>.
            </p>
          </footer>
        </article>
      </Container>
    </main>
  );
}
