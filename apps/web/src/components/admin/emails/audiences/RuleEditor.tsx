'use client';

/**
 * RuleEditor — éditeur de Rule selon le kind (factory, M5.3.7).
 *
 * Chaque Rule kind a sa shape de formulaire (operator + value(s) + options).
 * Le composant `RuleEditor` route vers le bon sous-éditeur, qui appelle
 * `onChange(updatedRule)` à chaque modif.
 *
 * Pour la V1, on couvre les 15 kinds avec des inputs simples (text/number/
 * select). Pas de date picker dédié — input type="date" natif suffit.
 */
import { useState } from 'react';
import type { Rule, RuleKind } from '@/lib/mail/audiences/rules-types';
import { TAGS_ENABLED, TAG_RULE_BANNER } from '@/lib/mail/audiences/tags-flag';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ruleLabel, madToCents, centsToMad } from './rule-defaults';
import {
  BETWEEN_ERROR,
  SWAP_BOUNDS_LABEL,
  swapBounds,
  toPatternChips,
  validateBetween,
} from './rule-validation';
import { countryLabel } from './countries';
import { ProductAutocomplete } from './ProductAutocomplete';
import { TagAutocomplete } from './TagAutocomplete';
import { TemplateAutocomplete } from './TemplateAutocomplete';
import { CountryAutocomplete } from './CountryAutocomplete';
import { CountryMultiSelect } from './CountryMultiSelect';
import { ClickUrlCombobox } from './ClickUrlCombobox';
import { DurationInput } from './DurationInput';

const nf = new Intl.NumberFormat('fr-FR');

export type RuleEditorProps = {
  rule: Rule;
  onChange: (rule: Rule) => void;
  onRemove?: () => void;
};

const NUM_OPERATORS = [
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '=' },
  { value: 'between', label: 'entre' },
];

const STR_OPERATORS = [
  { value: 'contains', label: 'contient' },
  { value: 'starts', label: 'commence par' },
  { value: 'ends', label: 'finit par' },
  { value: 'equals', label: 'égal à' },
  { value: 'in', label: 'parmi' },
];

const DATE_OPERATORS = [
  { value: 'after', label: 'après' },
  { value: 'before', label: 'avant' },
  { value: 'between', label: 'entre' },
  { value: 'within', label: 'dans les' },
];

// ── Sub-editors ──────────────────────────────────────────────────────────

/**
 * AUD-02 — erreur de borne inversée + auto-correction « Inverser les bornes ».
 * Rendu sous les deux inputs d'un `between` (numérique ou date) dès que les
 * deux bornes sont saisies et que lo > hi.
 */
function BetweenBoundsError({
  tuple,
  onSwap,
}: {
  tuple: readonly [number, number] | readonly [string, string];
  onSwap: (swapped: [number, number] | [string, string]) => void;
}) {
  if (validateBetween(tuple).ok) return null;
  return (
    <span
      role="alert"
      data-testid="between-error"
      className="flex items-center gap-2 text-xs text-rose-700"
    >
      {BETWEEN_ERROR}
      <button
        type="button"
        data-testid="swap-bounds"
        onClick={() => onSwap(swapBounds(tuple))}
        className="rounded border border-rose-300 px-1.5 py-0.5 text-rose-700 hover:bg-rose-50"
      >
        {SWAP_BOUNDS_LABEL}
      </button>
    </span>
  );
}

/**
 * AUD-09 — saisie `in` en chips (trim, anti-doublon, vide ignoré). Lecture
 * tolérante du legacy CSV texte-libre via toPatternChips.
 */
function PatternChipsInput({
  value,
  onChange,
}: {
  value: string | string[];
  onChange: (next: string[]) => void;
}) {
  const [pending, setPending] = useState('');
  const chips = toPatternChips(value);

  function addPending() {
    const t = pending.trim();
    setPending('');
    if (!t || chips.includes(t)) return;
    onChange([...chips, t]);
  }

  return (
    <div className="flex flex-col gap-1.5" data-testid="pattern-chips">
      <ul className="flex flex-wrap gap-1.5" aria-label="Valeurs ciblées">
        {chips.length === 0 && (
          <li className="text-xs italic text-stone-600" data-testid="pattern-chips-empty">
            Aucune valeur. Ajoutez au moins une valeur.
          </li>
        )}
        {chips.map((c) => (
          <li key={c}>
            <span
              data-testid={`pattern-chip-${c}`}
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-800"
            >
              <span className="font-mono">{c}</span>
              <button
                type="button"
                onClick={() => onChange(chips.filter((x) => x !== c))}
                aria-label={`Retirer ${c}`}
                data-testid={`pattern-chip-remove-${c}`}
                className="rounded-full px-0.5 text-stone-500 hover:text-rose-700"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addPending();
            }
          }}
          placeholder="@example.com"
          aria-label="Ajouter une valeur"
          data-testid="pattern-chips-input"
          className="w-44 rounded border border-stone-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={addPending}
          data-testid="pattern-chips-add"
          className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-50"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function EmailPatternEditor({ rule, onChange }: { rule: Extract<Rule, { kind: 'email_pattern' }>; onChange: (r: Rule) => void }) {
  const isIn = rule.operator === 'in';

  function setOperator(nextOp: typeof rule.operator) {
    if (nextOp === 'in') {
      // scalaire/CSV → chips (migration tolérante, sans perte).
      onChange({ ...rule, operator: 'in', value: toPatternChips(rule.value) } as Rule);
    } else if (isIn) {
      // chips → scalaire : on conserve la 1re valeur.
      const chips = toPatternChips(rule.value);
      onChange({ ...rule, operator: nextOp, value: chips[0] ?? '' } as Rule);
    } else {
      onChange({ ...rule, operator: nextOp } as Rule);
    }
  }

  return (
    <div className={isIn ? 'flex flex-col items-start gap-2' : 'flex items-center gap-2'}>
      <select
        value={rule.operator}
        onChange={(e) => setOperator(e.target.value as typeof rule.operator)}
        aria-label="Opérateur"
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      >
        {STR_OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {isIn ? (
        <PatternChipsInput
          value={rule.value}
          onChange={(next) => onChange({ ...rule, value: next } as Rule)}
        />
      ) : (
        <input
          type="text"
          aria-label="Valeur"
          value={Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder="@example.com"
          className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}

function ConsentMarketingEditor({ rule, onChange }: { rule: Extract<Rule, { kind: 'consent_marketing' }>; onChange: (r: Rule) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={rule.value}
        onChange={(e) => onChange({ ...rule, value: e.target.checked })}
      />
      {rule.value ? 'Consent = oui' : 'Consent = non'}
    </label>
  );
}

function CountryEditor({ rule, onChange }: { rule: Extract<Rule, { kind: 'country' }>; onChange: (r: Rule) => void }) {
  // AUD-05 — la bascule in→eq PERD des données (N−1 codes) : ConfirmDialog
  // socle si N≥2. eq→in est sans perte → aucune confirmation.
  const [confirmEqOpen, setConfirmEqOpen] = useState(false);
  const codes = Array.isArray(rule.value) ? rule.value : rule.value ? [rule.value] : [];

  function switchToEq() {
    onChange({ ...rule, operator: 'eq', value: codes[0] ?? '' } as Rule);
  }

  return (
    <div className={rule.operator === 'in' ? 'flex flex-col items-start gap-2' : 'flex items-center gap-2'}>
      <select
        value={rule.operator}
        onChange={(e) => {
          const nextOp = e.target.value as 'eq' | 'in';
          // Convertit la value entre scalaire (eq) et tableau (in) pour rester
          // valide vis-à-vis du Zod CountryRule (string | string[]).
          if (nextOp === 'in') {
            onChange({ ...rule, operator: 'in', value: codes } as Rule);
          } else if (codes.length >= 2) {
            setConfirmEqOpen(true);
          } else {
            switchToEq();
          }
        }}
        aria-label="Opérateur"
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      >
        <option value="eq">égal</option>
        <option value="in">parmi</option>
      </select>
      {rule.operator === 'eq' ? (
        <CountryAutocomplete
          value={typeof rule.value === 'string' ? rule.value : ''}
          onChange={(code) => onChange({ ...rule, value: code } as Rule)}
        />
      ) : (
        // UX-AUD-009 — multi-select chips (liste fermée COUNTRIES) au lieu du
        // CSV texte-libre : plus de code ISO à connaître par cœur, plus de
        // code inconnu qui compile silencieusement en FALSE.
        <CountryMultiSelect
          value={codes}
          onChange={(next) => onChange({ ...rule, value: next } as Rule)}
        />
      )}

      {/* AUD-05 — confirmation de la perte (in [N codes] → eq [1 code]). */}
      <ConfirmDialog
        open={confirmEqOpen}
        title={`Ne conserver que ${countryLabel(codes[0] ?? '')} ?`}
        body={
          <>
            Passer en « égal » ne conserve que le premier pays — les{' '}
            {Math.max(0, codes.length - 1)} autres seront retirés du ciblage.
          </>
        }
        confirmLabel="Conserver le 1er"
        variant="danger"
        onConfirm={() => {
          setConfirmEqOpen(false);
          switchToEq();
        }}
        onCancel={() => setConfirmEqOpen(false)}
      />
    </div>
  );
}

function NumericRuleEditor({
  rule,
  onChange,
  withSince = false,
  withUntil = false,
  unit,
  /** order_total : la value est stockée en CENTIMES mais saisie en MAD (UX-AUD-010). */
  mad = false,
}: {
  rule: Extract<Rule, { kind: 'order_count' | 'order_total' | 'session_count' }>;
  onChange: (r: Rule) => void;
  withSince?: boolean;
  withUntil?: boolean;
  unit?: string;
  mad?: boolean;
}) {
  const isBetween = rule.operator === 'between';
  const tuple = Array.isArray(rule.value) ? (rule.value as [number, number]) : null;

  // UX-AUD-010 — l'affichage (display) est en MAD ; le stockage en cents.
  const toDisplay = (cents: number): number | '' =>
    Number.isFinite(cents) ? (mad ? centsToMad(cents) : cents) : '';
  const fromDisplay = (raw: string): number => {
    if (raw === '') return 0;
    const n = Number(raw);
    return mad ? madToCents(n) : Math.round(n);
  };

  function setScalar(raw: string) {
    onChange({ ...rule, value: fromDisplay(raw) } as Rule);
  }
  function setLo(raw: string) {
    const hi = tuple ? tuple[1] : 0;
    onChange({ ...rule, value: [fromDisplay(raw), hi] } as Rule);
  }
  function setHi(raw: string) {
    const lo = tuple ? tuple[0] : 0;
    onChange({ ...rule, value: [lo, fromDisplay(raw)] } as Rule);
  }

  function setOperator(nextOp: typeof rule.operator) {
    if (nextOp === 'between' && !isBetween) {
      // scalaire → tuple [v, v] pour rester valide vis-à-vis du Zod (tuple requis).
      const v = typeof rule.value === 'number' ? rule.value : 0;
      onChange({ ...rule, operator: nextOp, value: [v, v] } as Rule);
    } else if (nextOp !== 'between' && isBetween) {
      // tuple → scalaire (on garde la borne basse).
      onChange({ ...rule, operator: nextOp, value: tuple ? tuple[0] : 0 } as Rule);
    } else {
      onChange({ ...rule, operator: nextOp } as Rule);
    }
  }

  const scalarValue = typeof rule.value === 'number' ? rule.value : tuple ? tuple[0] : 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={rule.operator}
        onChange={(e) => setOperator(e.target.value as typeof rule.operator)}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
        aria-label="Opérateur"
      >
        {NUM_OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {isBetween ? (
        // UX-AUD-003 — deux bornes → value = [lo, hi] (tuple exigé par Zod).
        <span className="flex flex-wrap items-center gap-1" data-testid="num-between">
          <input
            type="number"
            aria-label={mad ? 'Borne basse (MAD)' : 'Borne basse'}
            data-testid="num-between-lo"
            value={tuple ? toDisplay(tuple[0]) : ''}
            onChange={(e) => setLo(e.target.value)}
            className="w-24 rounded border border-stone-300 px-2 py-1 text-sm tabular-nums"
          />
          <span className="text-xs text-stone-500">et</span>
          <input
            type="number"
            aria-label={mad ? 'Borne haute (MAD)' : 'Borne haute'}
            data-testid="num-between-hi"
            value={tuple ? toDisplay(tuple[1]) : ''}
            onChange={(e) => setHi(e.target.value)}
            className="w-24 rounded border border-stone-300 px-2 py-1 text-sm tabular-nums"
          />
          {/* AUD-02 — lo > hi : BETWEEN hi AND lo ne matche PERSONNE. */}
          {tuple && (
            <BetweenBoundsError
              tuple={tuple}
              onSwap={(swapped) => onChange({ ...rule, value: swapped } as Rule)}
            />
          )}
        </span>
      ) : (
        <input
          type="number"
          aria-label={mad ? 'Montant (MAD)' : 'Valeur'}
          data-testid="num-value"
          value={toDisplay(scalarValue)}
          onChange={(e) => setScalar(e.target.value)}
          className="w-24 rounded border border-stone-300 px-2 py-1 text-sm tabular-nums"
        />
      )}

      {unit && <span className="text-xs text-stone-500">{unit}</span>}

      {/* UX-AUD-010 — helper d'équivalence MAD ↔ centimes (pas pour between). */}
      {mad && !isBetween && (
        <span className="text-xs text-stone-600" data-testid="mad-helper">
          = {nf.format(scalarValue)} centimes
        </span>
      )}

      {withSince && 'since' in rule && (
        <label className="flex items-center gap-1 text-xs text-stone-600">
          depuis
          <input
            type="date"
            aria-label="Depuis (date)"
            data-testid="num-since"
            value={(rule as { since?: string }).since ?? ''}
            onChange={(e) => onChange({ ...rule, since: e.target.value || undefined } as Rule)}
            className="rounded border border-stone-300 px-1 py-0.5 text-xs"
          />
        </label>
      )}

      {/* UX-AUD-004 — borne `until` pour order_count (« entre janv. et mars »). */}
      {withUntil && (
        <label className="flex items-center gap-1 text-xs text-stone-600">
          jusqu&apos;au
          <input
            type="date"
            aria-label="Jusqu'au (date)"
            data-testid="num-until"
            value={(rule as { until?: string }).until ?? ''}
            onChange={(e) => onChange({ ...rule, until: e.target.value || undefined } as Rule)}
            className="rounded border border-stone-300 px-1 py-0.5 text-xs"
          />
        </label>
      )}
    </div>
  );
}

function DateRuleEditor({
  rule,
  onChange,
}: {
  rule: Extract<Rule, { kind: 'created_at' | 'last_order_at' }>;
  onChange: (r: Rule) => void;
}) {
  // last_order_at value est typé string (pas de tuple Zod) → on ne propose
  // `between` que pour created_at, dont le Zod accepte le tuple [string, string].
  const supportsBetween = rule.kind === 'created_at';
  const operators = supportsBetween
    ? DATE_OPERATORS
    : DATE_OPERATORS.filter((o) => o.value !== 'between');

  const isBetween = rule.operator === 'between';
  const tuple = Array.isArray(rule.value) ? (rule.value as [string, string]) : null;

  function setOperator(nextOp: typeof rule.operator) {
    if (nextOp === 'between' && !isBetween) {
      const v = typeof rule.value === 'string' ? rule.value : '';
      onChange({ ...rule, operator: nextOp, value: [v, v] } as Rule);
    } else if (nextOp !== 'between' && isBetween) {
      onChange({ ...rule, operator: nextOp, value: tuple ? tuple[0] : '' } as Rule);
    } else {
      onChange({ ...rule, operator: nextOp } as Rule);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={rule.operator}
        onChange={(e) => setOperator(e.target.value as typeof rule.operator)}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
        aria-label="Opérateur"
      >
        {operators.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {isBetween ? (
        // UX-AUD-003 — plage de dates → value = [a, b] (tuple created_at).
        <span className="flex flex-wrap items-center gap-1" data-testid="date-between">
          <input
            type="date"
            aria-label="Date de début"
            data-testid="date-between-from"
            value={tuple ? tuple[0] : ''}
            onChange={(e) => onChange({ ...rule, value: [e.target.value, tuple ? tuple[1] : ''] } as Rule)}
            className="rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <span className="text-xs text-stone-500">et</span>
          <input
            type="date"
            aria-label="Date de fin"
            data-testid="date-between-to"
            value={tuple ? tuple[1] : ''}
            onChange={(e) => onChange({ ...rule, value: [tuple ? tuple[0] : '', e.target.value] } as Rule)}
            className="rounded border border-stone-300 px-2 py-1 text-sm"
          />
          {/* AUD-02 — début > fin : plage vide silencieuse. */}
          {tuple && (
            <BetweenBoundsError
              tuple={tuple}
              onSwap={(swapped) => onChange({ ...rule, value: swapped } as Rule)}
            />
          )}
        </span>
      ) : (
        <input
          type={rule.operator === 'within' ? 'text' : 'date'}
          aria-label={rule.operator === 'within' ? 'Durée (7d / 30d / 1h)' : 'Date'}
          value={Array.isArray(rule.value) ? rule.value[0] : rule.value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder={rule.operator === 'within' ? '7d / 30d / 1h' : ''}
          className="rounded border border-stone-300 px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}

function EmailOpenedClickedEditor({
  rule,
  onChange,
}: {
  rule: Extract<Rule, { kind: 'email_opened' | 'email_clicked' }>;
  onChange: (r: Rule) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2">
        dans les
        <DurationInput
          value={rule.within ?? ''}
          onChange={(v) => onChange({ ...rule, within: v || undefined })}
          placeholder="7d"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-stone-600">
        min count
        <input
          type="number"
          value={rule.minCount ?? ''}
          onChange={(e) =>
            onChange({
              ...rule,
              minCount: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="w-16 rounded border border-stone-300 px-2 py-1 text-sm"
        />
      </label>
      {rule.kind === 'email_opened' && (
        <label className="flex items-center gap-1 text-xs text-stone-600">
          template
          <TemplateAutocomplete
            value={(rule as { templateSlug?: string }).templateSlug ?? ''}
            onChange={(slug) =>
              onChange({
                ...rule,
                templateSlug: slug || undefined,
              })
            }
            placeholder="welcome"
            className="w-32 rounded border border-stone-300 px-2 py-1 text-sm"
          />
        </label>
      )}
      {/* UX-AUD-004 — urlPattern pour email_clicked (« a cliqué un lien vers /promo »). */}
      {rule.kind === 'email_clicked' && (
        <label className="flex items-center gap-1 text-xs text-stone-600">
          lien contient
          <span className="w-40" data-testid="url-pattern-field">
            <ClickUrlCombobox
              value={(rule as { urlPattern?: string }).urlPattern ?? ''}
              onChange={(pattern) =>
                onChange({
                  ...rule,
                  urlPattern: pattern || undefined,
                })
              }
              className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
            />
          </span>
        </label>
      )}
    </div>
  );
}

function InactiveSinceEditor({
  rule,
  onChange,
}: {
  rule: Extract<Rule, { kind: 'inactive_since' }>;
  onChange: (r: Rule) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="number"
        aria-label="Nombre de jours"
        value={rule.days}
        onChange={(e) => onChange({ ...rule, days: Number(e.target.value) })}
        className="w-20 rounded border border-stone-300 px-2 py-1 text-sm tabular-nums"
      />
      <span className="text-stone-600">jours</span>
    </div>
  );
}

function TagEditor({
  rule,
  onChange,
}: {
  rule: Extract<Rule, { kind: 'has_tag' | 'not_has_tag' }>;
  onChange: (r: Rule) => void;
}) {
  return (
    <div className="space-y-2">
      {/* AUD-01 — règle legacy : le compilateur la neutralise (FALSE), on le
          DIT au lieu de laisser croire que le ciblage fonctionne. */}
      {!TAGS_ENABLED && (
        <p
          role="alert"
          data-testid="tag-rule-banner"
          className="rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs text-rose-800"
        >
          {TAG_RULE_BANNER}
        </p>
      )}
      <TagAutocomplete
        value={rule.tag}
        onChange={(tag) => onChange({ ...rule, tag })}
        placeholder="vip"
      />
    </div>
  );
}

function ProductIdEditor({
  rule,
  onChange,
}: {
  rule: Extract<Rule, { kind: 'has_ordered_product' }>;
  onChange: (r: Rule) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ProductAutocomplete
        value={rule.productId}
        onChange={(slug) => onChange({ ...rule, productId: slug })}
        placeholder="kit-eclat-v2"
      />
      {/* UX-AUD-004 — borne `since` : « a commandé X depuis le … ». */}
      <label className="flex items-center gap-1 text-xs text-stone-600">
        depuis
        <input
          type="date"
          aria-label="Depuis (date)"
          data-testid="product-since"
          value={rule.since ?? ''}
          onChange={(e) => onChange({ ...rule, since: e.target.value || undefined })}
          className="rounded border border-stone-300 px-1 py-0.5 text-xs"
        />
      </label>
    </div>
  );
}

function ReceivedWithoutOpenEditor({
  rule,
  onChange,
}: {
  rule: Extract<Rule, { kind: 'received_without_open' }>;
  onChange: (r: Rule) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>≥</span>
      <input
        type="number"
        value={rule.threshold}
        onChange={(e) => onChange({ ...rule, threshold: Number(e.target.value) })}
        className="w-16 rounded border border-stone-300 px-2 py-1 text-sm tabular-nums"
      />
      <span>reçus dans</span>
      <DurationInput
        value={rule.within}
        onChange={(v) => onChange({ ...rule, within: v })}
        placeholder="14d"
      />
    </div>
  );
}

// ── Main RuleEditor (factory) ────────────────────────────────────────────

export function RuleEditor({ rule, onChange, onRemove }: RuleEditorProps) {
  return (
    <div
      className="flex items-start gap-3 rounded border border-stone-200 bg-white p-3"
      data-testid={`rule-editor-${rule.kind}`}
    >
      <div className="flex-1">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-stone-500">
          {ruleLabel(rule.kind as RuleKind)}
        </p>
        {renderEditor(rule, onChange)}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Supprimer ce critère"
          data-testid="remove-rule"
          className="rounded px-2 py-1 text-stone-600 hover:bg-rose-50 hover:text-rose-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function renderEditor(rule: Rule, onChange: (r: Rule) => void) {
  switch (rule.kind) {
    case 'email_pattern':
      return <EmailPatternEditor rule={rule} onChange={onChange} />;
    case 'consent_marketing':
      return <ConsentMarketingEditor rule={rule} onChange={onChange} />;
    case 'country':
      return <CountryEditor rule={rule} onChange={onChange} />;
    case 'order_count':
      return <NumericRuleEditor rule={rule} onChange={onChange} withSince withUntil />;
    case 'order_total':
      return <NumericRuleEditor rule={rule} onChange={onChange} withSince unit="MAD" mad />;
    case 'session_count':
      return <NumericRuleEditor rule={rule} onChange={onChange} />;
    case 'created_at':
    case 'last_order_at':
      return <DateRuleEditor rule={rule} onChange={onChange} />;
    case 'email_opened':
    case 'email_clicked':
      return <EmailOpenedClickedEditor rule={rule} onChange={onChange} />;
    case 'inactive_since':
      return <InactiveSinceEditor rule={rule} onChange={onChange} />;
    case 'has_tag':
    case 'not_has_tag':
      return <TagEditor rule={rule} onChange={onChange} />;
    case 'has_ordered_product':
      return <ProductIdEditor rule={rule} onChange={onChange} />;
    case 'received_without_open':
      return <ReceivedWithoutOpenEditor rule={rule} onChange={onChange} />;
  }
}
