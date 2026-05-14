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
import type { Rule, RuleKind } from '@/lib/mail/audiences/rules-types';
import { ruleLabel } from './rule-defaults';

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

function EmailPatternEditor({ rule, onChange }: { rule: Extract<Rule, { kind: 'email_pattern' }>; onChange: (r: Rule) => void }) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as typeof rule.operator })}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      >
        {STR_OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}
        onChange={(e) => onChange({ ...rule, value: e.target.value })}
        placeholder="@example.com"
        className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
      />
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
  return (
    <div className="flex items-center gap-2">
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as 'eq' | 'in' })}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      >
        <option value="eq">égal</option>
        <option value="in">parmi</option>
      </select>
      <input
        type="text"
        value={Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            ...rule,
            value: rule.operator === 'in' ? v.split(',').map((s) => s.trim()) : v,
          } as Rule);
        }}
        placeholder="MA, FR"
        className="w-32 rounded border border-stone-300 px-2 py-1 text-sm uppercase"
      />
    </div>
  );
}

function NumericRuleEditor({
  rule,
  onChange,
  withSince = false,
  unit,
}: {
  rule: Extract<Rule, { kind: 'order_count' | 'order_total' | 'session_count' }>;
  onChange: (r: Rule) => void;
  withSince?: boolean;
  unit?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as typeof rule.operator })}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      >
        {NUM_OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={typeof rule.value === 'number' ? rule.value : (rule.value as [number, number])[0]}
        onChange={(e) => onChange({ ...rule, value: Number(e.target.value) } as Rule)}
        className="w-24 rounded border border-stone-300 px-2 py-1 text-sm tabular-nums"
      />
      {unit && <span className="text-xs text-stone-500">{unit}</span>}
      {withSince && 'since' in rule && (
        <label className="flex items-center gap-1 text-xs text-stone-600">
          depuis
          <input
            type="date"
            value={rule.since ?? ''}
            onChange={(e) => onChange({ ...rule, since: e.target.value || undefined } as Rule)}
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
  return (
    <div className="flex items-center gap-2">
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as typeof rule.operator })}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      >
        {DATE_OPERATORS.filter((o) => o.value !== 'between').map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type={rule.operator === 'within' ? 'text' : 'date'}
        value={Array.isArray(rule.value) ? rule.value[0] : rule.value}
        onChange={(e) => onChange({ ...rule, value: e.target.value })}
        placeholder={rule.operator === 'within' ? '7d / 30d / 1h' : ''}
        className="rounded border border-stone-300 px-2 py-1 text-sm"
      />
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
      <label className="flex items-center gap-1">
        dans les
        <input
          type="text"
          value={rule.within ?? ''}
          onChange={(e) => onChange({ ...rule, within: e.target.value || undefined })}
          placeholder="7d"
          className="w-16 rounded border border-stone-300 px-2 py-1 text-sm"
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
          <input
            type="text"
            value={(rule as { templateSlug?: string }).templateSlug ?? ''}
            onChange={(e) =>
              onChange({
                ...rule,
                templateSlug: e.target.value || undefined,
              })
            }
            placeholder="welcome"
            className="w-32 rounded border border-stone-300 px-2 py-1 text-sm"
          />
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
    <input
      type="text"
      value={rule.tag}
      onChange={(e) => onChange({ ...rule, tag: e.target.value })}
      placeholder="vip"
      className="w-40 rounded border border-stone-300 px-2 py-1 text-sm"
    />
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
    <input
      type="text"
      value={rule.productId}
      onChange={(e) => onChange({ ...rule, productId: e.target.value })}
      placeholder="kit-eclat-v2"
      className="w-48 rounded border border-stone-300 px-2 py-1 text-sm"
    />
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
      <input
        type="text"
        value={rule.within}
        onChange={(e) => onChange({ ...rule, within: e.target.value })}
        placeholder="14d"
        className="w-16 rounded border border-stone-300 px-2 py-1 text-sm"
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
          className="rounded px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
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
      return <NumericRuleEditor rule={rule} onChange={onChange} withSince />;
    case 'order_total':
      return <NumericRuleEditor rule={rule} onChange={onChange} withSince unit="MAD" />;
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
