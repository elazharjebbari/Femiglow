/**
 * Hub i18n — point d'entrée unique des outils de traduction (`/admin/i18n`).
 *
 * Regroupe l'accès à l'éditeur multilingue de contenu (FR/AR/EN, par
 * composant) et au moteur de suggestion de langue + son audit. Ces pages
 * existaient mais n'étaient atteignables que par URL directe : ce hub leur
 * donne une entrée de menu dédiée (« Traductions / i18n »).
 */
import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  IconChevronRight,
  IconSwap,
  IconType,
  IconEye,
} from '@/components/admin/icons';

export const dynamic = 'force-dynamic';

interface HubCard {
  href: string;
  title: string;
  description: string;
  icon: JSX.Element;
}

const CARDS: HubCard[] = [
  {
    href: '/admin/components',
    title: 'Éditeur multilingue de contenu',
    description:
      'Traduire les champs de contenu en FR / AR / EN, par composant. Onglets de locale, suivi des drafts, prévisualisation.',
    icon: <IconType className="h-5 w-5" />,
  },
  {
    href: '/admin/i18n/engine',
    title: 'Moteur de suggestion de langue',
    description:
      'Configurer quand proposer un changement de langue au visiteur (profils, seuils). OFF par défaut, pilotable sans redéploiement.',
    icon: <IconSwap className="h-5 w-5" />,
  },
  {
    href: '/admin/i18n/engine/audit',
    title: 'Audit du moteur',
    description:
      'Journal des changements de configuration du moteur — qui a modifié quoi, et le diff avant → après. Lecture seule.',
    icon: <IconEye className="h-5 w-5" />,
  },
];

export default async function AdminI18nHubPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/i18n');

  return (
    <AdminShell adminEmail={session.email} active="i18n">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Traductions / i18n
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Outils de traduction du contenu et de gestion des langues du site.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="group flex h-full items-start gap-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              <span className="mt-0.5 shrink-0 text-stone-500">{card.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                  {card.title}
                  <IconChevronRight className="h-3.5 w-3.5 text-stone-400 transition group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-stone-600">
                  {card.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
