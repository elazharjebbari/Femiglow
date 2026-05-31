# Composants — code complet

> Nouveau composant `<SourceBadge />` + modif `<ChatAdminNav />`.

## 1. `<SourceBadge />` — nouveau

**Fichier** : `apps/web/src/components/admin/chat/SourceBadge.tsx` (création)

```tsx
/**
 * CHA-LEAD-V2 — Badge visuel pour `chat_lead.source`.
 *
 * Sert à identifier rapidement la provenance d'un lead :
 *  - chat_widget : capture in-chat (vert)
 *  - inline : capture inline phone via chat (bleu)
 *  - wizard_kit : wizard /kit (ambre, signal pollution si visible sur /admin/chat)
 *  - wizard_commander : wizard /cart legacy (ambre)
 *  - newsletter : capture newsletter (violet)
 *  - admin : capture manuelle admin (gris)
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/03-frontend-ui-ux/design-tokens.md
 */
import type { ChatLeadRow } from '@/lib/chat/db/schema';

interface SourceBadgeProps {
  source: ChatLeadRow['source'];
  className?: string;
  /** Si true, ajoute le tooltip "Lead capturé via X". */
  withTooltip?: boolean;
  /** Si true, version compacte (1 char + icône). */
  compact?: boolean;
}

interface SourceMeta {
  label: string;
  color: string;
  symbol: string;
  description: string;
}

const SOURCE_META: Record<ChatLeadRow['source'], SourceMeta> = {
  chat_widget: {
    label: 'chat',
    color: 'bg-emerald-100 text-emerald-800',
    symbol: '💬',
    description: 'Lead capturé dans le widget chat IA',
  },
  inline: {
    label: 'inline',
    color: 'bg-sky-100 text-sky-800',
    symbol: '🔗',
    description: 'Lead capturé via téléphone détecté dans un message chat',
  },
  wizard_kit: {
    label: 'wizard',
    color: 'bg-amber-100 text-amber-800',
    symbol: '🛒',
    description: 'Lead du wizard checkout /kit (PAS un lead chat)',
  },
  wizard_commander: {
    label: 'cart',
    color: 'bg-amber-100 text-amber-800',
    symbol: '🛒',
    description: 'Lead du wizard /cart legacy (PAS un lead chat)',
  },
  newsletter: {
    label: 'news',
    color: 'bg-violet-100 text-violet-800',
    symbol: '✉',
    description: 'Lead capturé via formulaire newsletter',
  },
  admin: {
    label: 'admin',
    color: 'bg-stone-200 text-stone-800',
    symbol: '⚙',
    description: 'Lead créé manuellement par un admin',
  },
};

export function SourceBadge({
  source,
  className = '',
  withTooltip = false,
  compact = false,
}: SourceBadgeProps): JSX.Element {
  const meta = SOURCE_META[source];
  const baseClass = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`;

  if (compact) {
    return (
      <span
        className={`${baseClass} ${className}`}
        title={withTooltip ? meta.description : undefined}
        aria-label={meta.description}
      >
        <span aria-hidden>{meta.symbol}</span>
        <span className="sr-only">{meta.label}</span>
      </span>
    );
  }

  return (
    <span
      className={`${baseClass} ${className}`}
      title={withTooltip ? meta.description : undefined}
    >
      <span aria-hidden>{meta.symbol}</span>
      <span>{meta.label}</span>
    </span>
  );
}
```

### Tests `<SourceBadge />`

**Fichier nouveau** : `apps/web/src/components/admin/chat/SourceBadge.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SourceBadge } from './SourceBadge';

describe('<SourceBadge />', () => {
  it('renders chat_widget with green color', () => {
    render(<SourceBadge source="chat_widget" />);
    const badge = screen.getByText('chat');
    expect(badge.parentElement?.className).toContain('bg-emerald-100');
  });

  it('renders wizard_kit with amber color (signal pollution)', () => {
    render(<SourceBadge source="wizard_kit" />);
    const badge = screen.getByText('wizard');
    expect(badge.parentElement?.className).toContain('bg-amber-100');
  });

  it('shows tooltip when withTooltip', () => {
    render(<SourceBadge source="chat_widget" withTooltip />);
    const badge = screen.getByText('chat').parentElement;
    expect(badge?.getAttribute('title')).toBe(
      'Lead capturé dans le widget chat IA',
    );
  });

  it('compact mode hides label but keeps aria', () => {
    render(<SourceBadge source="inline" compact />);
    const compactBadge = screen.getByLabelText(/capturé via téléphone/);
    expect(compactBadge).toBeInTheDocument();
    // .sr-only present (visible aux lecteurs d'écran)
    expect(compactBadge.querySelector('.sr-only')?.textContent).toBe('inline');
  });
});
```

## 2. Modification `<ChatAdminNav />`

**Fichier** : `apps/web/src/components/admin/chat/ChatAdminNav.tsx`

```diff
 export interface ChatAdminNavProps {
   active?: string;
+  /** CHA-LEAD-V2 — Si true, affiche le badge "Filtres V2 ON". */
+  filtersV2Enabled?: boolean;
 }

 export function ChatAdminNav({ active, filtersV2Enabled }: ChatAdminNavProps): JSX.Element {
   const items = [
     { href: '/admin/chat', label: "Vue d'ensemble" },
     { href: '/admin/chat/conversations', label: 'Conversations' },
     { href: '/admin/chat/leads', label: 'Leads chat' },
     // ... reste ...
   ];

   return (
     <nav aria-label="Sections chat" className="mb-4 flex flex-wrap gap-2 text-sm">
       {items.map((item) => (
         <Link
           key={item.href}
           href={item.href}
           className={`rounded-md px-2.5 py-1.5 ${active === labelOf(item)} ...`}
         >
           {item.label}
         </Link>
       ))}
+      {filtersV2Enabled && (
+        <span
+          className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
+          title="Filtres admin V2 actifs (kind + source)"
+        >
+          Filtres V2 ON
+        </span>
+      )}
     </nav>
   );
}
```

**Usage** : injecter `filtersV2Enabled={process.env.CHAT_ADMIN_FILTERS_V2 === 'true'}` depuis les pages (SSR-friendly).

## 3. `<KindBadge />` — pour la table conversations

**Fichier nouveau** : `apps/web/src/components/admin/chat/KindBadge.tsx`

```tsx
/**
 * CHA-LEAD-V2 — Badge visuel pour `chat_session.kind`.
 *
 * Visible uniquement en mode debug (`?debug=ghosts`) sinon redondant.
 */
import type { ChatSessionKind } from '@/lib/chat/db/kind';

interface KindBadgeProps {
  kind: ChatSessionKind;
  className?: string;
}

const KIND_META: Record<ChatSessionKind, { label: string; color: string; description: string }> = {
  chat: {
    label: 'chat',
    color: 'bg-emerald-100 text-emerald-800',
    description: 'Conversation chat IA standard',
  },
  wizard_pivot: {
    label: 'wizard',
    color: 'bg-amber-100 text-amber-800',
    description: 'Ghost session pivot pour chat_lead FK',
  },
  system: {
    label: 'system',
    color: 'bg-violet-100 text-violet-800',
    description: 'Session système (newsletter, admin seed)',
  },
};

export function KindBadge({ kind, className = '' }: KindBadgeProps): JSX.Element {
  const meta = KIND_META[kind];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.color} ${className}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}
```

## 4. Storybook (optionnel mais recommandé)

Si le projet a Storybook (`pnpm storybook`), créer des stories pour les nouveaux composants :

**Fichier nouveau** : `apps/web/src/components/admin/chat/SourceBadge.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { SourceBadge } from './SourceBadge';

const meta: Meta<typeof SourceBadge> = {
  title: 'Admin/Chat/SourceBadge',
  component: SourceBadge,
};
export default meta;

type Story = StoryObj<typeof SourceBadge>;

export const ChatWidget: Story = { args: { source: 'chat_widget' } };
export const Inline: Story = { args: { source: 'inline' } };
export const WizardKit: Story = { args: { source: 'wizard_kit' } };
export const Compact: Story = { args: { source: 'inline', compact: true } };
export const WithTooltip: Story = { args: { source: 'chat_widget', withTooltip: true } };
```

## 5. Index de re-exports

**Fichier nouveau** : `apps/web/src/components/admin/chat/index.ts`

```ts
/**
 * Re-exports composants admin chat.
 */
export { ChatAdminNav } from './ChatAdminNav';
export { ConversationQuickView } from './ConversationQuickView';
export { LeadOutcomeSelect } from './LeadOutcomeSelect';
// CHA-LEAD-V2
export { SourceBadge } from './SourceBadge';
export { KindBadge } from './KindBadge';
export { CleanupGhostsButton } from './CleanupGhostsButton';
```

(Cf. convention projet pour les barrel files.)
