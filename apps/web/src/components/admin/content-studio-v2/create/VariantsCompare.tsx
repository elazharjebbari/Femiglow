'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Sparkles } from 'lucide-react';
import type { ContentBrandViolation, ContentDraft } from '@/lib/content-studio/types';
import { Badge, Button } from '@/components/admin/content-studio-v2/primitives';

export interface VariantViewModel {
  draft: ContentDraft;
  score?: number | null;
  violations?: ContentBrandViolation[];
}

interface VariantsCompareProps {
  variants: VariantViewModel[];
  selectedId: string | null;
  onSelect: (variant: VariantViewModel) => void;
  loading?: boolean;
}

export function VariantsCompare({ variants, selectedId, onSelect, loading }: VariantsCompareProps) {
  const [highlightDiff, setHighlightDiff] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--cs-fg-secondary)',
          fontSize: 'var(--cs-text-sm)',
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
        }}
      >
        Génération des variantes en cours…
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          background: 'var(--cs-bg-elevated)',
          border: '1px dashed var(--cs-border)',
          borderRadius: 'var(--cs-radius-md)',
        }}
      >
        <Sparkles size={20} style={{ color: 'var(--cs-accent)', marginBottom: 8 }} />
        <p style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)', margin: 0 }}>
          Lance la génération pour voir 3 variantes ici.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Comparer les variantes"
      data-cs-variants-compare
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-lg)',
            fontWeight: 500,
            color: 'var(--cs-fg-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {variants.length} variantes
        </h3>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--cs-fg-secondary)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={highlightDiff}
            onChange={(event) => setHighlightDiff(event.target.checked)}
          />
          Voir les différences
        </label>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(variants.length, 3)}, minmax(0, 1fr))`,
          gap: 12,
        }}
      >
        {variants.map((variant) => (
          <VariantCard
            key={variant.draft.id}
            variant={variant}
            selected={variant.draft.id === selectedId}
            onSelect={() => onSelect(variant)}
            highlightDiff={highlightDiff}
            baselineCaption={variants[0]?.draft.caption ?? ''}
          />
        ))}
      </div>
    </section>
  );
}

function VariantCard({
  variant,
  selected,
  onSelect,
  highlightDiff,
  baselineCaption,
}: {
  variant: VariantViewModel;
  selected: boolean;
  onSelect: () => void;
  highlightDiff: boolean;
  baselineCaption: string;
}) {
  const { draft, score, violations = [] } = variant;
  const blocked = violations.some((v) => v.severity === 'blocked');
  return (
    <article
      data-variant-id={draft.id}
      data-selected={selected ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        background: 'var(--cs-bg-elevated)',
        border: selected ? '2px solid var(--cs-accent)' : '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        boxShadow: selected ? '0 0 0 4px var(--cs-accent-bg)' : 'none',
        transition: 'border-color var(--cs-motion-fast) var(--cs-easing)',
      }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <Badge tone={selected ? 'accent' : 'neutral'} size="sm">
          {draft.variantLabel}
        </Badge>
        {score !== undefined && score !== null ? (
          <span
            style={{
              fontFamily: 'var(--cs-font-mono)',
              fontSize: 11,
              color: 'var(--cs-fg-secondary)',
            }}
          >
            {Math.round(score)}/100
          </span>
        ) : null}
      </header>
      {draft.hook ? (
        <p
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-base)',
            fontWeight: 500,
            color: 'var(--cs-fg-primary)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {draft.hook}
        </p>
      ) : null}
      <p
        style={{
          fontSize: 13,
          color: 'var(--cs-fg-secondary)',
          lineHeight: 1.55,
          margin: 0,
          whiteSpace: 'pre-wrap',
          maxHeight: 220,
          overflow: 'auto',
        }}
      >
        {highlightDiff ? renderDiff(baselineCaption, draft.caption) : draft.caption}
      </p>
      {violations.length > 0 ? (
        <ul
          aria-label="Violations brand"
          style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, listStyle: 'none' }}
        >
          {violations.map((v, idx) => (
            <li
              key={`${draft.id}-violation-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: v.severity === 'blocked' ? 'var(--cs-danger-bg)' : 'var(--cs-warning-bg)',
                color: v.severity === 'blocked' ? 'var(--cs-danger)' : 'var(--cs-warning)',
                borderRadius: 'var(--cs-radius-sm)',
                fontSize: 11,
              }}
            >
              <AlertTriangle size={11} />
              <span>{v.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        variant={selected ? 'secondary' : 'primary'}
        size="sm"
        disabled={blocked}
        leftIcon={selected ? <Check size={14} /> : undefined}
        onClick={onSelect}
        type="button"
      >
        {selected ? 'Sélectionnée' : blocked ? 'Bloquée (violations)' : 'Choisir cette variante'}
      </Button>
    </article>
  );
}

/**
 * Lightweight word-level diff highlight. Words from `candidate` that are
 * absent from `baseline` are wrapped in a span. Cheap and good enough
 * for the "spot the difference" UX — we are not building Git here.
 */
function renderDiff(baseline: string, candidate: string): React.ReactNode {
  if (!baseline) return candidate;
  const baseWords = new Set(baseline.toLowerCase().split(/\s+/).filter(Boolean));
  return candidate.split(/(\s+)/).map((token, idx) => {
    if (/^\s+$/.test(token)) return token;
    const isNew = !baseWords.has(token.toLowerCase());
    if (!isNew) return token;
    return (
      <mark
        key={`diff-${idx}`}
        style={{
          background: 'var(--cs-accent-bg)',
          color: 'var(--cs-accent)',
          padding: '0 2px',
          borderRadius: 3,
        }}
      >
        {token}
      </mark>
    );
  });
}
