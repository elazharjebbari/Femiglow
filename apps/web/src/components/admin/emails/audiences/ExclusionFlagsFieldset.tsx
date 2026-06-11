'use client';

/**
 * ExclusionFlagsFieldset — édition des 4 flags de suppression list (UX-AUD-002).
 *
 * Avant : les exclusions (hard_bounce / unsubscribe / manual_suppression /
 * marketing_optout) étaient figées en dur dans le wizard et purement read-only
 * sur la page détail → un opérateur ne pouvait jamais inclure les optout
 * marketing ni retirer une exclusion par défaut, alors que le compilateur
 * (applyExclusions) le permet.
 *
 * 4 cases à cocher, libellés FR + impact explicite. Contrôlé :
 * `value: ExclusionFlags` + `onChange(next)`.
 */
import type { ExclusionFlags } from '@/lib/mail/audiences/rules-types';

export interface ExclusionFlagsFieldsetProps {
  value: ExclusionFlags;
  onChange: (next: ExclusionFlags) => void;
}

const FLAGS: Array<{ key: keyof ExclusionFlags; label: string; impact: string }> = [
  {
    key: 'hard_bounce',
    label: 'Exclure les adresses en rebond dur (hard bounce)',
    impact: 'Adresses invalides/inexistantes — réenvoyer dégrade la réputation.',
  },
  {
    key: 'unsubscribe',
    label: 'Exclure les désinscrits',
    impact: 'Contacts ayant cliqué « se désabonner ». Obligatoire (RGPD/CAN-SPAM).',
  },
  {
    key: 'manual_suppression',
    label: 'Exclure les suppressions manuelles (admin)',
    impact: 'Adresses bloquées à la main par un administrateur.',
  },
  {
    key: 'marketing_optout',
    label: 'Exclure les refus de consentement marketing',
    impact:
      'Ne cibler que les contacts ayant accepté le marketing (consent = oui). ' +
      'Coché = restriction supplémentaire, décoché = on inclut les non-consentants.',
  },
];

export function ExclusionFlagsFieldset({ value, onChange }: ExclusionFlagsFieldsetProps) {
  return (
    <fieldset
      className="rounded border border-stone-200 p-3"
      data-testid="exclusion-flags-fieldset"
    >
      <legend className="px-2 text-sm font-medium text-stone-700">
        Exclusions automatiques (suppression list)
      </legend>
      <p className="px-2 pb-2 text-xs text-stone-500">
        Contacts retirés de la cible avant l&apos;envoi. Décocher élargit la cible — à vos risques.
      </p>
      <ul className="space-y-2">
        {FLAGS.map((f) => (
          <li key={f.key}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                data-testid={`exclusion-${f.key}`}
                checked={value[f.key]}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                <span className="text-stone-800">{f.label}</span>
                <span className="block text-xs text-stone-500">{f.impact}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
