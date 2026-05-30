/**
 * Simulateur dry-run du moteur de suggestion (lot L11).
 *
 * Exécute `evaluateSuggestionPolicy` — la **même fonction pure** que la prod
 * (L9) — sur le **brouillon non publié** et des jeux de signaux d'exemple.
 * Aucune écriture, aucun event émis : pure simulation déterministe. Sert de
 * preuve **avant publication** des invariants durs : un preset checkout reste
 * `suppress / NEVER-CHECKOUT` même trigger armé (INV-14) ; moteur off ⇒
 * `suppress / engine-off` (INV-13).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/admin-feature-spec.md §1.7
 */
'use client';

import { useMemo, useState } from 'react';

import { type ResolvedEngineConfig } from '@/lib/i18n/engine-config-schema';
import { evaluateSuggestionPolicy } from '@/lib/i18n/suggestion-policy';
import { type Signals, withSafeDefaults } from '@/lib/i18n/suggestion-types';

type Preset = {
  id: string;
  label: string;
  signals: Partial<Signals> & Pick<Signals, 'servedLocale' | 'guessedLocale'>;
};

const PRESETS: Preset[] = [
  {
    id: 'entry-mismatch',
    label: 'Arrivée /fr, langue ar (breakpoint)',
    signals: {
      servedLocale: 'fr',
      guessedLocale: 'ar',
      confidence: 0.9,
      inCheckout: false,
      formFocused: false,
      isDeepReading: false,
      modalOpen: false,
      videoPlaying: false,
      dwellMs: 5000,
      scrollVelocity: 0,
      atBreakpoint: true,
      cooldownActive: false,
      impressionsThisVisitor: 0,
      dismissedPersistent: false,
    },
  },
  {
    id: 'no-breakpoint',
    label: 'Arrivée /fr, langue ar (sans breakpoint)',
    signals: {
      servedLocale: 'fr',
      guessedLocale: 'ar',
      confidence: 0.9,
      inCheckout: false,
      formFocused: false,
      isDeepReading: false,
      modalOpen: false,
      videoPlaying: false,
      dwellMs: 5000,
      scrollVelocity: 0,
      atBreakpoint: false,
      cooldownActive: false,
      impressionsThisVisitor: 0,
      dismissedPersistent: false,
    },
  },
  {
    id: 'checkout',
    label: 'En checkout (zone calme)',
    signals: {
      servedLocale: 'fr',
      guessedLocale: 'ar',
      confidence: 0.9,
      inCheckout: true,
      formFocused: false,
      isDeepReading: false,
      modalOpen: false,
      videoPlaying: false,
      dwellMs: 5000,
      scrollVelocity: 0,
      atBreakpoint: true,
      cooldownActive: false,
      impressionsThisVisitor: 0,
      dismissedPersistent: false,
    },
  },
  {
    id: 'fast-scroll',
    label: 'Scroll rapide',
    signals: {
      servedLocale: 'fr',
      guessedLocale: 'ar',
      confidence: 0.9,
      inCheckout: false,
      formFocused: false,
      isDeepReading: false,
      modalOpen: false,
      videoPlaying: false,
      dwellMs: 5000,
      scrollVelocity: 2000,
      atBreakpoint: true,
      cooldownActive: false,
      impressionsThisVisitor: 0,
      dismissedPersistent: false,
    },
  },
  {
    id: 'deep-read',
    label: 'Lecture profonde (article)',
    signals: {
      servedLocale: 'fr',
      guessedLocale: 'ar',
      confidence: 0.9,
      inCheckout: false,
      formFocused: false,
      isDeepReading: true,
      modalOpen: false,
      videoPlaying: false,
      dwellMs: 5000,
      scrollVelocity: 0,
      atBreakpoint: true,
      cooldownActive: false,
      impressionsThisVisitor: 0,
      dismissedPersistent: false,
    },
  },
  {
    id: 'budget',
    label: 'Budget épuisé',
    signals: {
      servedLocale: 'fr',
      guessedLocale: 'ar',
      confidence: 0.9,
      inCheckout: false,
      formFocused: false,
      isDeepReading: false,
      modalOpen: false,
      videoPlaying: false,
      dwellMs: 5000,
      scrollVelocity: 0,
      atBreakpoint: true,
      cooldownActive: false,
      impressionsThisVisitor: 9999,
      dismissedPersistent: false,
    },
  },
];

const DECISION_LABEL: Record<string, string> = {
  show: 'Afficher',
  suppress: 'Supprimer',
  defer: 'Différer',
};

export function EngineSimulator({
  config,
}: {
  config: ResolvedEngineConfig;
}): JSX.Element {
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]!;

  const decision = useMemo(
    () => evaluateSuggestionPolicy(withSafeDefaults(preset.signals), config),
    [preset, config],
  );

  return (
    <section
      aria-label="Simulateur (dry-run)"
      data-testid="engine-simulator"
      className="sticky top-4 rounded-lg border border-stone-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-stone-900">Simulateur</h2>
      <p className="mt-1 text-[11px] leading-snug text-stone-500">
        Exécute la politique sur le brouillon non publié. Aucune écriture, aucun
        event.
      </p>

      <label className="mt-3 block text-xs font-medium text-stone-700">
        Jeu de signaux
        <select
          data-testid="simulator-preset"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <dl
        data-testid="simulator-decision"
        data-decision={decision.decision}
        data-reason={decision.reason ?? ''}
        data-profile={decision.profileMatched ?? decision.neverProfile ?? ''}
        className="mt-4 space-y-2 text-sm"
      >
        <div className="flex items-center justify-between">
          <dt className="text-stone-500">Décision</dt>
          <dd className="font-semibold text-stone-900">
            {DECISION_LABEL[decision.decision] ?? decision.decision}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-stone-500">Raison</dt>
          <dd className="font-mono text-xs text-stone-700">
            {decision.reason ?? '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-stone-500">Profil</dt>
          <dd className="font-mono text-xs text-stone-700">
            {decision.profileMatched ?? decision.neverProfile ?? '—'}
          </dd>
        </div>
        {decision.suggested ? (
          <div className="flex items-center justify-between">
            <dt className="text-stone-500">Suggéré</dt>
            <dd className="font-semibold text-stone-900">
              {preset.signals.servedLocale} → {decision.suggested}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
