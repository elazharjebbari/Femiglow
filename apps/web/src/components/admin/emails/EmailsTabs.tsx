'use client';

/**
 * EmailsTabs — barre d'onglets persistante de la section emails (NAV-F01/F02,
 * TRV-03, SUP-01).
 *
 * Doctrine (spec F02) :
 *   - AUCUN fetch au rendu : la structure (9 onglets) est statique ; les
 *     compteurs arrivent post-hydratation (useEffect) — la barre n'ajoute
 *     aucune latence au RSC ;
 *   - dégradation SILENCIEUSE : 401/500/réseau/hang → onglets sans badge mais
 *     parfaitement utilisables (jamais de toast, jamais de skeleton) ;
 *   - un échec de refresh CONSERVE les derniers compteurs connus (pas de
 *     clignotement badge→rien→badge) ;
 *   - refresh 30 s (aligné TTL serveur), suspendu onglet caché, repris au
 *     retour au premier plan ;
 *   - badges : masqués à 0, plafonnés « 99+ », annoncés en TEXTE (libellé
 *     accessible), jamais couleur seule.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navCountersSchema, type NavCounters } from '@/lib/mail/wire-schemas';

export type SectionKey =
  | 'dashboard'
  | 'transactional'
  | 'campaigns'
  | 'automation'
  | 'audiences'
  | 'templates'
  | 'suppression'
  | 'events'
  | 'listmonk';

type BadgeKey = 'dlq' | 'automationErrors' | 'listmonkSyncFailed';

type Section = {
  key: SectionKey;
  label: string;
  base: string;
  badge: BadgeKey | null;
};

/** Ordre CANONIQUE (figé — cf. diagrammes/navigation.puml cible). */
export const EMAILS_SECTIONS: Section[] = [
  { key: 'dashboard', label: 'Dashboard', base: '/admin/emails', badge: null },
  { key: 'transactional', label: 'Transactionnel', base: '/admin/emails/transactional', badge: 'dlq' },
  { key: 'campaigns', label: 'Campagnes', base: '/admin/emails/campaigns', badge: null },
  { key: 'automation', label: 'Automations', base: '/admin/emails/automation', badge: 'automationErrors' },
  { key: 'audiences', label: 'Audiences', base: '/admin/emails/audiences', badge: null },
  { key: 'templates', label: 'Templates', base: '/admin/emails/templates', badge: null },
  { key: 'suppression', label: 'Suppression', base: '/admin/emails/suppression', badge: null },
  { key: 'events', label: 'Events', base: '/admin/emails/events', badge: null },
  { key: 'listmonk', label: 'Listmonk', base: '/admin/emails/listmonk', badge: 'listmonkSyncFailed' },
];

const SECTION_KEYS = new Set(EMAILS_SECTIONS.map((s) => s.key));

/**
 * Onglet actif = 1er segment après /admin/emails ('' → dashboard ; segment
 * inconnu → null, AUCUN faux actif). Pure — testée par table (F02-U).
 */
export function activeKeyFromPathname(pathname: string): SectionKey | null {
  if (!pathname.startsWith('/admin/emails')) return null;
  const rest = pathname.slice('/admin/emails'.length).replace(/^\/+/, '');
  if (rest === '') return 'dashboard';
  const first = rest.split('/')[0]!;
  return SECTION_KEYS.has(first as SectionKey) ? (first as SectionKey) : null;
}

/**
 * Libellé de pastille : null pour 0 (pas de badge — oracle F02-U-010),
 * « 99+ » au-delà de 99 (capage CLIENT — le serveur peut caper plus haut).
 */
export function formatBadge(n: number): string | null {
  if (n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

const BADGE_TONE: Record<BadgeKey, string> = {
  dlq: 'bg-rose-100 text-rose-800',
  automationErrors: 'bg-rose-100 text-rose-800',
  listmonkSyncFailed: 'bg-amber-100 text-amber-800',
};

function badgeTooltip(key: BadgeKey, n: number): string {
  switch (key) {
    case 'dlq':
      return `${n} message(s) en DLQ`;
    case 'automationErrors':
      return `${n} run(s) en erreur`;
    case 'listmonkSyncFailed':
      return 'Synchro Listmonk en échec';
  }
}

const REFRESH_MS = 30_000;

export function EmailsTabs() {
  const pathname = usePathname() ?? '';
  const active = activeKeyFromPathname(pathname);
  // null tant que rien n'est arrivé (pas de skeleton) ; derniers compteurs
  // VALIDES conservés sur échec de refresh.
  const [counters, setCounters] = useState<NavCounters | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/emails/nav-counters');
        if (!res.ok) return; // dégradation silencieuse, lastKnown conservé
        const parsed = navCountersSchema.safeParse(await res.json());
        if (parsed.success && aliveRef.current) setCounters(parsed.data);
      } catch {
        /* réseau : silencieux */
      }
    };
    void load(); // post-hydratation uniquement (jamais au rendu serveur)
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    const onVisibility = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      aliveRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <nav aria-label="Sections emails" className="border-b border-stone-200 bg-white">
      <ul className="flex items-center gap-1 overflow-x-auto px-4">
        {EMAILS_SECTIONS.map((section) => {
          const isActive = section.key === active;
          const n = section.badge && counters ? counters[section.badge] : 0;
          const badgeText = section.badge !== null ? formatBadge(n) : null;
          const showBadge = badgeText !== null;
          return (
            <li key={section.key} className="shrink-0">
              <Link
                href={section.base}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
                }`}
              >
                {section.label}
                {showBadge ? (
                  <span
                    title={badgeTooltip(section.badge!, n)}
                    aria-label={badgeTooltip(section.badge!, n)}
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${BADGE_TONE[section.badge!]}`}
                  >
                    {badgeText}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
