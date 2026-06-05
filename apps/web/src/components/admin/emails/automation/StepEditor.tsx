'use client';

/**
 * StepEditor — éditeur switch-by-kind pour un AutomationStep.
 *
 * Pour `branch` : intègre AudienceRulesBuilder pour l'édition de la condition,
 * et un StepList récursif pour ifTrue/ifFalse. Pour les autres : input
 * dédié au kind.
 *
 * Composant *contrôlé* : reçoit `value` + `onChange`.
 */
import { useState } from 'react';
import type {
  AutomationStep,
} from '@/lib/mail/automation/step-types-v2';
import { AudienceRulesBuilder } from '@/components/admin/emails/audiences/AudienceRulesBuilder';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';
import {
  TemplateCombobox,
  TagCombobox,
} from '@/components/admin/emails/common/combobox-wrappers';
import { EntityCombobox, type ComboboxOption } from '@/components/admin/emails/common/EntityCombobox';
import { StepList } from './StepList';

// Suggestions de `source` de lead (route dédiée) — branchées sur l'EntityCombobox
// du socle pour le champ update_lead.field='source'.
async function fetchSourceSuggestions(q: string, signal: AbortSignal): Promise<ComboboxOption[]> {
  const res = await fetch('/api/admin/leads/sources/autocomplete', {
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { sources: string[] };
  const needle = q.toLowerCase();
  return data.sources
    .filter((s) => s.toLowerCase().includes(needle))
    .slice(0, 20)
    .map<ComboboxOption>((s) => ({ value: s, label: s }));
}

export type StepEditorProps = {
  value: AutomationStep;
  onChange: (next: AutomationStep) => void;
  /** Catalogue events injecté pour wait_for_event. */
  eventsCatalog?: Array<{ name: string; category: string; description: string }>;
  /** Profondeur de nesting branch (pour limiter récursion UI). */
  depth?: number;
};

const MAX_BRANCH_DEPTH = 3;

export function StepEditor({ value, onChange, eventsCatalog = [], depth = 0 }: StepEditorProps) {
  switch (value.kind) {
    case 'wait':
      return <WaitEditor value={value} onChange={onChange} />;
    case 'send':
      return <SendEditor value={value} onChange={onChange} />;
    case 'tag':
      return <TagEditor value={value} onChange={onChange} />;
    case 'update_lead':
      return <UpdateLeadEditor value={value} onChange={onChange} />;
    case 'webhook':
      return <WebhookEditor value={value} onChange={onChange} />;
    case 'wait_for_event':
      return <WaitForEventEditor value={value} onChange={onChange} eventsCatalog={eventsCatalog} />;
    case 'branch':
      return (
        <BranchEditor
          value={value}
          onChange={onChange}
          eventsCatalog={eventsCatalog}
          depth={depth}
        />
      );
  }
}

// ── wait ────────────────────────────────────────────────────────────────
function WaitEditor({
  value,
  onChange,
}: {
  value: Extract<AutomationStep, { kind: 'wait' }>;
  onChange: (n: AutomationStep) => void;
}) {
  // expose durée en minutes/heures/jours
  const minutes = Math.round(value.durationMs / 60_000);
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-700">
        Durée d'attente (minutes)
      </label>
      <input
        type="number"
        min={1}
        max={129_600} // 90j
        value={minutes}
        onChange={(e) =>
          onChange({ ...value, durationMs: Math.max(1, Number(e.target.value)) * 60_000 })
        }
        className="w-32 rounded border border-stone-300 px-3 py-1.5 text-sm"
      />
      <p className="text-xs text-stone-500">Max 90 jours (129 600 min).</p>
    </div>
  );
}

// ── send ────────────────────────────────────────────────────────────────
function SendEditor({
  value,
  onChange,
}: {
  value: Extract<AutomationStep, { kind: 'send' }>;
  onChange: (n: AutomationStep) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-stone-700">Template</label>
        <TemplateCombobox
          value={value.template}
          onChange={(template) => onChange({ ...value, template })}
          ariaLabel="Template de l'email à envoyer"
          placeholder="welcome-1"
        />
        <p className="mt-1 text-xs text-stone-500">
          Choisissez un template existant — un slug inconnu fait échouer l&apos;envoi.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Variables à mapper (clés du contexte)
        </label>
        <input
          type="text"
          value={(value.payloadKeys ?? []).join(', ')}
          onChange={(e) =>
            onChange({
              ...value,
              payloadKeys: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="firstName, cartTotalMad"
          className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
        />
        <p className="mt-1 text-xs text-stone-500">
          Séparées par des virgules. Les clés sont lues dans contextJson.
        </p>
      </div>
    </div>
  );
}

// ── tag ─────────────────────────────────────────────────────────────────
function TagEditor({
  value,
  onChange,
}: {
  value: Extract<AutomationStep, { kind: 'tag' }>;
  onChange: (n: AutomationStep) => void;
}) {
  return (
    <div className="flex items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-stone-700">Action</label>
        <select
          value={value.action}
          onChange={(e) => onChange({ ...value, action: e.target.value as 'add' | 'remove' })}
          className="rounded border border-stone-300 px-3 py-1.5 text-sm"
        >
          <option value="add">Ajouter</option>
          <option value="remove">Retirer</option>
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-stone-700">Tag</label>
        <TagCombobox
          value={value.tag}
          onChange={(tag) => onChange({ ...value, tag })}
          ariaLabel="Tag à appliquer au lead"
          placeholder="vip"
        />
      </div>
    </div>
  );
}

// ── update_lead ─────────────────────────────────────────────────────────
function UpdateLeadEditor({
  value,
  onChange,
}: {
  value: Extract<AutomationStep, { kind: 'update_lead' }>;
  onChange: (n: AutomationStep) => void;
}) {
  return (
    <div className="flex items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-stone-700">Champ</label>
        <select
          value={value.field}
          onChange={(e) =>
            onChange({ ...value, field: e.target.value as 'status' | 'source' })
          }
          className="rounded border border-stone-300 px-3 py-1.5 text-sm"
        >
          <option value="status">status</option>
          <option value="source">source</option>
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-stone-700">Nouvelle valeur</label>
        {value.field === 'status' ? (
          <select
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm"
          >
            {['new', 'contacted', 'qualified', 'converted', 'lost', 'archived'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <EntityCombobox
            value={value.value}
            onChange={(v) => onChange({ ...value, value: v })}
            fetchSuggestions={fetchSourceSuggestions}
            ariaLabel="Nouvelle source du lead"
            placeholder="ex. import-2026"
          />
        )}
      </div>
    </div>
  );
}

// ── webhook ─────────────────────────────────────────────────────────────
function WebhookEditor({
  value,
  onChange,
}: {
  value: Extract<AutomationStep, { kind: 'webhook' }>;
  onChange: (n: AutomationStep) => void;
}) {
  const [bodyJson, setBodyJson] = useState(() =>
    value.body ? JSON.stringify(value.body, null, 2) : '',
  );
  const [bodyErr, setBodyErr] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-stone-700">Méthode</label>
          <select
            value={value.method}
            onChange={(e) => onChange({ ...value, method: e.target.value as 'POST' | 'PUT' })}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm"
          >
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-stone-700">URL (https://)</label>
          <input
            type="url"
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            placeholder="https://hooks.example.com/x"
            className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Body JSON (optionnel)</label>
        <textarea
          value={bodyJson}
          onChange={(e) => {
            setBodyJson(e.target.value);
            if (!e.target.value.trim()) {
              setBodyErr(null);
              onChange({ ...value, body: undefined });
              return;
            }
            try {
              const parsed = JSON.parse(e.target.value);
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                setBodyErr(null);
                onChange({ ...value, body: parsed as Record<string, unknown> });
              } else {
                setBodyErr('Doit être un objet JSON');
              }
            } catch (err) {
              setBodyErr(String(err));
            }
          }}
          rows={4}
          className="w-full rounded border border-stone-300 px-3 py-1.5 text-xs font-mono"
          placeholder='{ "userId": "{{contextJson.leadId}}" }'
        />
        {bodyErr && <p className="text-xs text-red-600">{bodyErr}</p>}
      </div>
    </div>
  );
}

// ── wait_for_event ──────────────────────────────────────────────────────
function WaitForEventEditor({
  value,
  onChange,
  eventsCatalog,
}: {
  value: Extract<AutomationStep, { kind: 'wait_for_event' }>;
  onChange: (n: AutomationStep) => void;
  eventsCatalog: Array<{ name: string; category: string; description: string }>;
}) {
  const hours = Math.round(value.timeoutMs / 3_600_000);
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-stone-700">Événement attendu</label>
        <select
          value={value.eventName}
          onChange={(e) => onChange({ ...value, eventName: e.target.value })}
          className="rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
        >
          {eventsCatalog.length === 0 ? (
            <option value={value.eventName}>{value.eventName}</option>
          ) : (
            eventsCatalog.map((e) => (
              <option key={e.name} value={e.name}>
                {e.name} — {e.description}
              </option>
            ))
          )}
        </select>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-stone-700">Timeout (heures)</label>
          <input
            type="number"
            min={1}
            max={720}
            value={hours}
            onChange={(e) =>
              onChange({
                ...value,
                timeoutMs: Math.max(1, Number(e.target.value)) * 3_600_000,
              })
            }
            className="w-24 rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Au timeout</label>
          <select
            value={value.onTimeout ?? 'continue'}
            onChange={(e) =>
              onChange({ ...value, onTimeout: e.target.value as 'continue' | 'abort' })
            }
            className="rounded border border-stone-300 px-3 py-1.5 text-sm"
          >
            <option value="continue">Continuer</option>
            <option value="abort">Abandonner</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ── branch ──────────────────────────────────────────────────────────────
function BranchEditor({
  value,
  onChange,
  eventsCatalog,
  depth,
}: {
  value: Extract<AutomationStep, { kind: 'branch' }>;
  onChange: (n: AutomationStep) => void;
  eventsCatalog: Array<{ name: string; category: string; description: string }>;
  depth: number;
}) {
  const allowNestedBranch = depth < MAX_BRANCH_DEPTH;
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-stone-700">Condition</label>
        <div className="rounded border border-stone-200 bg-stone-50 p-3">
          <AudienceRulesBuilder
            value={value.condition as RulesGroup}
            onChange={(g) => onChange({ ...value, condition: g })}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-emerald-700">✓ Si vrai</p>
          <StepList
            steps={value.ifTrue}
            onChange={(next) => onChange({ ...value, ifTrue: next })}
            eventsCatalog={eventsCatalog}
            depth={depth + 1}
            allowBranch={allowNestedBranch}
            compact
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-stone-500">✗ Sinon</p>
          <StepList
            steps={value.ifFalse}
            onChange={(next) => onChange({ ...value, ifFalse: next })}
            eventsCatalog={eventsCatalog}
            depth={depth + 1}
            allowBranch={allowNestedBranch}
            compact
          />
        </div>
      </div>
    </div>
  );
}
