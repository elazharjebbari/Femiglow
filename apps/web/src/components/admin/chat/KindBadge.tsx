/**
 * CHA-LEAD-V2 — Badge visuel pour `chat_session.kind`.
 *
 * Visible principalement en mode debug (`?debug=ghosts`) pour identifier
 * rapidement les ghost sessions wizard.
 */
import type { ChatSessionKind } from '@/lib/chat/db/kind';

interface KindBadgeProps {
  kind: ChatSessionKind | string;
  className?: string;
}

const KIND_META: Record<string, { label: string; color: string; description: string }> = {
  chat: {
    label: 'chat',
    color: 'bg-emerald-100 text-emerald-800',
    description: 'Conversation chat IA standard',
  },
  wizard_pivot: {
    label: 'wizard',
    color: 'bg-amber-100 text-amber-800',
    description: 'Ghost session pivot pour chat_lead FK (wizard checkout)',
  },
  system: {
    label: 'system',
    color: 'bg-violet-100 text-violet-800',
    description: 'Session système (newsletter, admin seed)',
  },
};

export function KindBadge({ kind, className = '' }: KindBadgeProps): JSX.Element {
  const meta = KIND_META[kind] ?? {
    label: kind,
    color: 'bg-stone-100 text-stone-700',
    description: `Kind inconnu : ${kind}`,
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.color} ${className}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}
