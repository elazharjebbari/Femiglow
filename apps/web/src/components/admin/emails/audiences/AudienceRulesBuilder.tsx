'use client';

/**
 * AudienceRulesBuilder — éditeur récursif pour RulesGroup (M5.3.7).
 *
 * Compose `<RuleEditor>` pour chaque condition Rule, avec récursion sur
 * les sous-groupes (RulesGroup). Le toggle ET/OU s'applique au groupe
 * courant. Boutons : ajouter critère (menu hiérarchique), ajouter
 * sous-groupe OR.
 *
 * Le composant est *contrôlé* : reçoit `value` + `onChange`.
 */
import { useCallback, useState } from 'react';
import type { Rule, RuleKind, RulesGroup } from '@/lib/mail/audiences/rules-types';
import { RULE_CATEGORIES, defaultRule } from './rule-defaults';
import { RuleEditor } from './RuleEditor';

export type AudienceRulesBuilderProps = {
  value: RulesGroup;
  onChange: (next: RulesGroup) => void;
  /** Si > 0, désactive l'ajout de sous-groupes (limite profondeur). */
  depth?: number;
  maxDepth?: number;
};

// ── Add-rule menu (dropdown hierarchical) ────────────────────────────────

function AddRuleMenu({ onPick }: { onPick: (kind: RuleKind) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="add-rule-btn"
        className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
      >
        + Ajouter un critère
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 w-72 rounded border border-stone-200 bg-white shadow-md"
          onMouseLeave={() => setOpen(false)}
        >
          {RULE_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p className="border-b border-stone-100 bg-stone-50 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-stone-500">
                {cat.label}
              </p>
              {cat.items.map((item) =>
                item.disabled ? (
                  // AUD-01 : règle non opérationnelle (M5.5 non livré) —
                  // visible mais non sélectionnable, avec la raison.
                  <button
                    key={item.kind}
                    type="button"
                    role="menuitem"
                    disabled
                    aria-disabled="true"
                    title={item.disabledHint}
                    data-testid={`add-rule-${item.kind}`}
                    className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-stone-600"
                  >
                    {item.label}
                    {item.disabledHint ? (
                      <span className="ml-2 text-xs text-stone-600">({item.disabledHint})</span>
                    ) : null}
                  </button>
                ) : (
                  <button
                    key={item.kind}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPick(item.kind);
                      setOpen(false);
                    }}
                    data-testid={`add-rule-${item.kind}`}
                    className="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-emerald-50"
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main builder (récursive) ─────────────────────────────────────────────

export function AudienceRulesBuilder({
  value,
  onChange,
  depth = 0,
  maxDepth = 3,
}: AudienceRulesBuilderProps) {
  const updateAt = useCallback(
    (idx: number, next: Rule | RulesGroup) => {
      const conditions = [...value.conditions];
      conditions[idx] = next;
      onChange({ ...value, conditions });
    },
    [value, onChange],
  );

  const removeAt = useCallback(
    (idx: number) => {
      const conditions = value.conditions.filter((_, i) => i !== idx);
      onChange({ ...value, conditions });
    },
    [value, onChange],
  );

  const addRule = useCallback(
    (kind: RuleKind) => {
      onChange({ ...value, conditions: [...value.conditions, defaultRule(kind)] });
    },
    [value, onChange],
  );

  const addSubGroup = useCallback(() => {
    onChange({
      ...value,
      conditions: [
        ...value.conditions,
        { kind: value.kind === 'all' ? 'any' : 'all', conditions: [] } as RulesGroup,
      ],
    });
  }, [value, onChange]);

  const toggleCombinator = useCallback(() => {
    onChange({ ...value, kind: value.kind === 'all' ? 'any' : 'all' });
  }, [value, onChange]);

  const canNest = depth < maxDepth;

  return (
    // AUD-F03 a11y — chaque groupe est un fieldset dont la legend annonce le
    // combinateur (les fieldsets imbriqués matérialisent l'imbrication pour
    // les lecteurs d'écran).
    <fieldset
      data-testid={`rules-group-${depth}`}
      className={
        depth > 0
          ? 'min-w-0 rounded border-2 border-dashed border-stone-200 bg-stone-50/50 p-3'
          : 'min-w-0 rounded border-0 p-0'
      }
    >
      <legend className="sr-only">
        {value.kind === 'all'
          ? 'Groupe de critères — ET (toutes les conditions)'
          : 'Groupe de critères — OU (au moins une condition)'}
      </legend>

      {/* Combinator toggle */}
      {value.conditions.length > 1 && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="text-stone-500">Combiner :</span>
          <button
            type="button"
            onClick={toggleCombinator}
            data-testid="toggle-combinator"
            className={`rounded px-2 py-0.5 font-medium ${
              value.kind === 'all' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
            }`}
          >
            {value.kind === 'all' ? 'ET (toutes)' : 'OU (au moins une)'}
          </button>
        </div>
      )}

      {/* AUD-08 — la logique de combinaison est annoncée DÈS la 1re règle,
          pas seulement quand le toggle apparaît à 2. */}
      {value.conditions.length === 1 && (
        <p className="mb-2 text-xs text-stone-500" data-testid="combinator-hint">
          Une seule condition pour l&apos;instant — ajoutez-en d&apos;autres pour les
          combiner (ET/OU).
        </p>
      )}

      {/* Conditions list */}
      <div className="space-y-2">
        {value.conditions.map((cond, idx) => {
          if ('conditions' in cond && Array.isArray(cond.conditions)) {
            return (
              <div key={idx} className="relative">
                <AudienceRulesBuilder
                  value={cond as RulesGroup}
                  onChange={(next) => updateAt(idx, next)}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  aria-label="Supprimer ce sous-groupe"
                  className="absolute right-2 top-2 rounded px-2 py-1 text-stone-600 hover:bg-rose-50 hover:text-rose-600"
                >
                  ✕
                </button>
              </div>
            );
          }
          return (
            <RuleEditor
              key={idx}
              rule={cond as Rule}
              onChange={(next) => updateAt(idx, next)}
              onRemove={() => removeAt(idx)}
            />
          );
        })}

        {value.conditions.length === 0 && (
          <p className="rounded border border-dashed border-stone-200 bg-stone-50 px-3 py-2 text-sm italic text-stone-600">
            Aucun critère. Ajoute au moins un critère pour cibler les contacts.
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-2">
        <AddRuleMenu onPick={addRule} />
        {canNest && (
          <button
            type="button"
            onClick={addSubGroup}
            data-testid="add-group-btn"
            className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          >
            + Ajouter un groupe {value.kind === 'all' ? 'OU' : 'ET'}
          </button>
        )}
      </div>
    </fieldset>
  );
}
