/**
 * Default values per step kind (M5.5 wizard).
 */
import type { AutomationStep, StepKind } from '@/lib/mail/automation/step-types-v2';

export const STEP_KINDS: { kind: StepKind; label: string; icon: string }[] = [
  { kind: 'wait', label: 'Attendre', icon: '⏱️' },
  { kind: 'send', label: 'Envoyer email', icon: '✉️' },
  { kind: 'branch', label: 'Condition (si / sinon)', icon: '🔀' },
  { kind: 'tag', label: 'Étiqueter le lead', icon: '🏷️' },
  { kind: 'update_lead', label: 'Modifier le lead', icon: '✏️' },
  { kind: 'webhook', label: 'Appel webhook', icon: '🔗' },
  { kind: 'wait_for_event', label: "Attendre un événement", icon: '⏳' },
];

export function defaultStep(kind: StepKind): AutomationStep {
  switch (kind) {
    case 'wait':
      return { kind: 'wait', durationMs: 3_600_000 }; // 1h
    case 'send':
      return { kind: 'send', template: 'welcome-1', payloadKeys: [] };
    case 'branch':
      return {
        kind: 'branch',
        condition: { kind: 'all', conditions: [] },
        ifTrue: [],
        ifFalse: [],
      };
    case 'tag':
      return { kind: 'tag', action: 'add', tag: '' };
    case 'update_lead':
      return { kind: 'update_lead', field: 'status', value: 'qualified' };
    case 'webhook':
      return { kind: 'webhook', url: 'https://', method: 'POST' };
    case 'wait_for_event':
      return { kind: 'wait_for_event', eventName: 'email.opened', timeoutMs: 86_400_000 };
  }
}

export function stepLabel(step: AutomationStep): string {
  switch (step.kind) {
    case 'wait':
      return `Attendre ${formatDuration(step.durationMs)}`;
    case 'send':
      return `Envoyer « ${step.template} »`;
    case 'branch':
      return `Si … alors / sinon`;
    case 'tag':
      return `${step.action === 'add' ? 'Ajouter' : 'Retirer'} le tag « ${step.tag || '?'} »`;
    case 'update_lead':
      return `${step.field} ← ${step.value}`;
    case 'webhook':
      return `Webhook ${step.method} ${truncate(step.url, 40)}`;
    case 'wait_for_event':
      return `Attendre l'événement « ${step.eventName} »`;
  }
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h`;
  return `${Math.round(ms / 86_400_000)} j`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
