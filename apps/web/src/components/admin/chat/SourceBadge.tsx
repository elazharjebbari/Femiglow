/**
 * CHA-LEAD-V2 — Badge visuel pour `chat_lead.source`.
 *
 * Sert à identifier rapidement la provenance d'un lead :
 *  - chat_widget : capture in-chat (vert)
 *  - inline : capture via téléphone détecté dans message chat (bleu)
 *  - wizard_kit / wizard_commander : wizard checkout (ambre - signal pollution)
 *  - newsletter : capture newsletter (violet)
 *  - admin : capture manuelle admin (gris)
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/03-frontend-ui-ux/design-tokens.md
 */
import type { ChatLeadRow } from '@/lib/chat/db/schema';

interface SourceBadgeProps {
  source: ChatLeadRow['source'];
  className?: string;
  /** Si true, ajoute le tooltip via title attribute. */
  withTooltip?: boolean;
}

interface SourceMeta {
  label: string;
  color: string;
  description: string;
}

const SOURCE_META: Record<ChatLeadRow['source'], SourceMeta> = {
  chat_widget: {
    label: 'chat',
    color: 'bg-emerald-100 text-emerald-800',
    description: 'Lead capturé dans le widget chat IA',
  },
  inline: {
    label: 'inline',
    color: 'bg-sky-100 text-sky-800',
    description: 'Lead capturé via téléphone détecté dans un message chat',
  },
  wizard_kit: {
    label: 'wizard',
    color: 'bg-amber-100 text-amber-800',
    description: 'Lead du wizard checkout /kit (PAS un lead chat)',
  },
  wizard_commander: {
    label: 'cart',
    color: 'bg-amber-100 text-amber-800',
    description: 'Lead du wizard /cart legacy (PAS un lead chat)',
  },
  newsletter: {
    label: 'news',
    color: 'bg-violet-100 text-violet-800',
    description: 'Lead capturé via formulaire newsletter',
  },
  admin: {
    label: 'admin',
    color: 'bg-stone-200 text-stone-800',
    description: 'Lead créé manuellement par un admin',
  },
};

export function SourceBadge({
  source,
  className = '',
  withTooltip = false,
}: SourceBadgeProps): JSX.Element {
  const meta = SOURCE_META[source];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color} ${className}`}
      title={withTooltip ? meta.description : undefined}
    >
      {meta.label}
    </span>
  );
}
