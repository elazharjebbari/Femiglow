import Link from 'next/link';
import { Container } from '@/components/ui/Container';

const links = [
  { label: 'Conditions générales', href: '/cgv' },
  { label: 'Mentions légales', href: '/mentions' },
  { label: 'Contact', href: '/contact' },
];

export function FooterMinimal() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-encre/10 bg-creme py-8"
    >
      <Container width="page">
        <div className="flex flex-col items-center gap-4 text-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-xs uppercase tracking-[0.18em] text-encre/60 transition-colors hover:text-encre"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-encre/50">
            © {new Date().getFullYear()} FemiGlow — Rabat.
          </p>
        </div>
      </Container>
    </footer>
  );
}
