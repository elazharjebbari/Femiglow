import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';
import { Text } from '@/components/ui/Text';
import { Kicker } from '@/components/ui/Kicker';
import { routes } from '@/lib/routes';

const columns = [
  {
    title: 'Le rituel',
    links: [
      { label: 'Le rituel', href: routes.rituel },
      { label: 'Le kit', href: routes.kit },
      { label: 'Journal', href: routes.journal },
      { label: 'Maison', href: routes.maison },
    ],
  },
  {
    title: 'Assistance',
    links: [
      { label: 'Contact', href: routes.contact },
      { label: 'Livraison', href: '#' },
      { label: 'Retours', href: '#' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Mentions', href: '#' },
      { label: 'Conditions de vente', href: '#' },
      { label: 'Confidentialité', href: '#' },
      { label: 'Cookies', href: '#' },
    ],
  },
];

export function Footer() {
  return (
    <footer role="contentinfo" className="bg-encre text-creme">
      <Container width="page">
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size="md" tone="on-dark" />
            <Text size="small" tone="on-dark" className="mt-4 max-w-xs opacity-80">
              Maison marocaine de soin pour les ongles. Le rituel, en cinq minutes.
            </Text>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <Kicker tone="on-dark">{column.title}</Kicker>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-creme/80 transition-colors hover:text-creme"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-creme/10 py-6 text-xs text-creme/60 space-y-1">
          <div>
            FemiGlow · 25 bis avenue Patrice Lumumba, Rabat ·{' '}
            <a
              href="mailto:info@femiglow-maroc.com"
              className="hover:text-creme"
            >
              info@femiglow-maroc.com
            </a>{' '}
            ·{' '}
            <a href="tel:+212630035905" className="hover:text-creme">
              +212 630-035905
            </a>
          </div>
          <div>
            © {new Date().getFullYear()} FemiGlow — Rabat. Tous droits réservés.
          </div>
        </div>
      </Container>
    </footer>
  );
}
