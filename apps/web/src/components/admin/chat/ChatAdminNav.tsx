/**
 * CHA-103 — Sous-navigation de la console chat.
 *
 * 8 sections : Vue d'ensemble, Conversations, KPIs, Instructions,
 * Sources (RAG), Providers, Themes (UX), Système (visualisation).
 */
import Link from 'next/link';

export type ChatAdminSection =
  | 'overview'
  | 'conversations'
  | 'kpis'
  | 'instructions'
  | 'sources'
  | 'providers'
  | 'themes'
  | 'lang'
  | 'audit'
  | 'system';

const ITEMS: Array<{ key: ChatAdminSection; href: string; label: string }> = [
  { key: 'overview', href: '/admin/chat', label: "Vue d'ensemble" },
  { key: 'conversations', href: '/admin/chat/conversations', label: 'Conversations' },
  { key: 'kpis', href: '/admin/chat/kpis', label: 'KPIs' },
  { key: 'instructions', href: '/admin/chat/instructions', label: 'Instructions' },
  { key: 'sources', href: '/admin/chat/sources', label: 'Sources' },
  { key: 'providers', href: '/admin/chat/providers', label: 'Providers' },
  { key: 'themes', href: '/admin/chat/themes', label: 'Themes' },
  { key: 'lang', href: '/admin/chat/lang', label: 'Langues' },
  { key: 'audit', href: '/admin/chat/audit', label: 'Audit' },
  { key: 'system', href: '/admin/chat/system', label: 'Système' },
];

export function ChatAdminNav({ active }: { active: ChatAdminSection }) {
  return (
    <nav
      aria-label="Sections chat"
      className="mb-6 flex flex-wrap gap-1 border-b border-stone-200 pb-3 text-sm"
    >
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-md px-3 py-1.5 ${
              isActive
                ? 'bg-stone-900 text-white'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
