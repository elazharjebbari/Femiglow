/**
 * Locale Switcher V2 — `LocaleVeil` (lot L3).
 *
 * Voile ivoire de transition (fallback pour les navigateurs sans View
 * Transitions, ADR-002). Présentationnel pur : piloté par l'état `veil`
 * du hook. Fondu sobre 160 ms (charte), `pointer-events: none`,
 * `aria-hidden` (purement décoratif).
 *
 * @see docs/locale-switcher-v2/02-design-ui-ux/components-spec.md
 */
'use client';

import { AnimatePresence, motion } from 'framer-motion';

import type { VeilState } from './use-locale-transition';

export function LocaleVeil({ veil }: { veil: VeilState }): JSX.Element {
  return (
    <AnimatePresence>
      {veil.active && (
        <motion.div
          aria-hidden="true"
          data-testid="locale-veil"
          data-phase={veil.phase ?? ''}
          initial={{ opacity: 0 }}
          animate={{ opacity: veil.phase === 'out' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-0 z-[120] bg-creme"
        />
      )}
    </AnimatePresence>
  );
}
