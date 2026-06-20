/**
 * F05 P3.1 — FILET DE NON-RÉGRESSION de la machine d'états campagne, posé AVANT
 * toute refonte du wizard (plan F05 §P3.1). Verrouille `isLegalTransition`
 * (table 7×7 exhaustive) et `mapListmonkStatus` : un poll/webhook rejoué ne doit
 * JAMAIS régresser un état terminal (sent/cancelled/failed), et le mapping
 * Listmonk→FemiGlow reste défensif (inconnu → null).
 *
 * Pur unitaire (aucune DB) — `listmonk-status-sync` exporte les deux fonctions.
 */
import { describe, expect, it } from 'vitest';
import {
  isLegalTransition,
  mapListmonkStatus,
  type FemiGlowCampaignStatus,
} from '@/lib/mail/campaigns/listmonk-status-sync';

const STATES: FemiGlowCampaignStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'paused',
  'sent',
  'cancelled',
  'failed',
];

/** Source de vérité de la spec (A-CMP-5) — DOIT rester synchrone avec le code. */
const LEGAL: Record<FemiGlowCampaignStatus, FemiGlowCampaignStatus[]> = {
  draft: ['scheduled', 'sending', 'cancelled', 'failed'],
  scheduled: ['sending', 'cancelled', 'failed'],
  sending: ['sent', 'cancelled', 'failed', 'paused'],
  paused: ['sending', 'cancelled', 'failed'],
  sent: [],
  cancelled: [],
  failed: [],
};

describe('F05 — isLegalTransition (machine d’états, filet P3.1)', () => {
  it('F05-U-001 — draft → scheduled légale', () => {
    expect(isLegalTransition('draft', 'scheduled')).toBe(true);
  });
  it('F05-U-002 — draft → sending légale (saut)', () => {
    expect(isLegalTransition('draft', 'sending')).toBe(true);
  });
  it('F05-U-003 — draft → cancelled légale', () => {
    expect(isLegalTransition('draft', 'cancelled')).toBe(true);
  });
  it('F05-U-004 — draft → failed légale', () => {
    expect(isLegalTransition('draft', 'failed')).toBe(true);
  });
  it('F05-U-005 — draft → paused ILLÉGALE', () => {
    expect(isLegalTransition('draft', 'paused')).toBe(false);
  });
  it('F05-U-006 — draft → sent ILLÉGALE', () => {
    expect(isLegalTransition('draft', 'sent')).toBe(false);
  });
  it('F05-U-007 — scheduled → sending légale', () => {
    expect(isLegalTransition('scheduled', 'sending')).toBe(true);
  });
  it('F05-U-008 — scheduled → cancelled légale', () => {
    expect(isLegalTransition('scheduled', 'cancelled')).toBe(true);
  });
  it('F05-U-009 — scheduled → paused ILLÉGALE', () => {
    expect(isLegalTransition('scheduled', 'paused')).toBe(false);
  });
  it('F05-U-010 — scheduled → sent ILLÉGALE', () => {
    expect(isLegalTransition('scheduled', 'sent')).toBe(false);
  });
  it('F05-U-011 — sending → sent légale', () => {
    expect(isLegalTransition('sending', 'sent')).toBe(true);
  });
  it('F05-U-012 — sending → paused légale', () => {
    expect(isLegalTransition('sending', 'paused')).toBe(true);
  });
  it('F05-U-013 — sending → cancelled légale', () => {
    expect(isLegalTransition('sending', 'cancelled')).toBe(true);
  });
  it('F05-U-014 — sending → failed légale', () => {
    expect(isLegalTransition('sending', 'failed')).toBe(true);
  });
  it('F05-U-015 — sending → scheduled ILLÉGALE (régression)', () => {
    expect(isLegalTransition('sending', 'scheduled')).toBe(false);
  });
  it('F05-U-016 — paused → sending légale (reprise)', () => {
    expect(isLegalTransition('paused', 'sending')).toBe(true);
  });
  it('F05-U-017 — paused → cancelled légale', () => {
    expect(isLegalTransition('paused', 'cancelled')).toBe(true);
  });
  it('F05-U-018 — paused → sent ILLÉGALE', () => {
    expect(isLegalTransition('paused', 'sent')).toBe(false);
  });

  it('F05-U-019 — sent → * tous ILLÉGAUX (terminal)', () => {
    for (const to of STATES) {
      if (to === 'sent') continue;
      expect(isLegalTransition('sent', to), `sent→${to}`).toBe(false);
    }
  });
  it('F05-U-020 — cancelled → * tous ILLÉGAUX (terminal)', () => {
    for (const to of STATES) {
      if (to === 'cancelled') continue;
      expect(isLegalTransition('cancelled', to), `cancelled→${to}`).toBe(false);
    }
  });
  it('F05-U-021 — failed → * tous ILLÉGAUX (terminal)', () => {
    for (const to of STATES) {
      if (to === 'failed') continue;
      expect(isLegalTransition('failed', to), `failed→${to}`).toBe(false);
    }
  });

  it('F05-U-022 — idempotence : from == to toujours légale', () => {
    for (const s of STATES) expect(isLegalTransition(s, s), `${s}→${s}`).toBe(true);
  });

  it('F05-U-023 — table 7×7 EXHAUSTIVE croisée (49 couples) conforme à la spec', () => {
    for (const from of STATES) {
      for (const to of STATES) {
        const expected = from === to || LEGAL[from].includes(to);
        expect(isLegalTransition(from, to), `${from}→${to}`).toBe(expected);
      }
    }
  });
});

describe('F05 — mapListmonkStatus (mapping défensif, filet P3.1)', () => {
  it('F05-U-024 — finished→sent, running→sending, scheduled→scheduled, cancelled→cancelled', () => {
    expect(mapListmonkStatus('finished')).toBe('sent');
    expect(mapListmonkStatus('running')).toBe('sending');
    expect(mapListmonkStatus('scheduled')).toBe('scheduled');
    expect(mapListmonkStatus('cancelled')).toBe('cancelled');
  });
  it('F05-U-025 — paused/draft/inconnu → null (no-op défensif)', () => {
    expect(mapListmonkStatus('paused')).toBeNull();
    expect(mapListmonkStatus('draft')).toBeNull();
    expect(mapListmonkStatus('n_importe_quoi')).toBeNull();
    expect(mapListmonkStatus('')).toBeNull();
  });
});
