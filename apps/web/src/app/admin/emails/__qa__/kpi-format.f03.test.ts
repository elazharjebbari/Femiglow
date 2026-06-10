/**
 * F03 — logique pure du dashboard fenêtré : batterie F03-U-001..024.
 *
 * Tri-état livraison (machine deliveredState — gardes exclusives ET
 * couvrantes, table de vérité exhaustive), tendances polarisées, fenêtre
 * (?window= → défaut 7d), horloge courte Casablanca.
 */
import { describe, expect, it } from 'vitest';
import {
  deliveredState,
  fmt,
  fmtClock,
  isDeliverySilent,
  parseWindow,
  pct,
  trendLabel,
  windowLabel,
  DELIVERED_SILENT_DIAGNOSE_HREF,
} from '@/app/admin/emails/kpi-format';

/** Référence stable (juin = Casablanca UTC+1, hors période Ramadan UTC+0). */
const NOW = new Date('2026-06-10T12:00:00.000Z');

describe('F03 — formatage de base', () => {
  it("F03-U-001 — pct(38,42) retourne '90.5 %'", () => {
    expect(pct(38, 42)).toBe('90.5 %');
  });

  it("F03-U-002 — pct(num,0) retourne '—' (jamais NaN ni 0.0 %)", () => {
    expect(pct(0, 0)).toBe('—');
    expect(pct(12, 0)).toBe('—');
  });

  it('F03-U-003 — fmt(12345) sépare les milliers en fr-FR', () => {
    expect(fmt(12345).replace(/[\s  ]/g, '')).toBe('12345');
    expect(fmt(12345)).toMatch(/^12[\s  ]345$/);
  });

  it("F03-U-004 — fmt(0) === '0'", () => {
    expect(fmt(0)).toBe('0');
  });
});

describe('F03 — tri-état livraison (deliveredState)', () => {
  it('F03-U-005 — delivered>0 → tracked, value=fmt, sub « des envoyés »', () => {
    const s = deliveredState({ sent: 42, delivered: 38, webhookLastSuccessAt: NOW.toISOString() }, NOW);
    expect(s.state).toBe('tracked');
    expect(s.value).toBe('38');
    expect(s.sub).toBe('90.5 % des envoyés');
    expect(s.silenceSince).toBeNull();
  });

  it('F03-U-006 — sent>0, delivered=0, webhook connu → silent rose « webhook muet depuis HH:MM »', () => {
    const s = deliveredState(
      { sent: 42, delivered: 0, webhookLastSuccessAt: '2026-06-10T10:00:00.000Z' },
      NOW,
    );
    expect(s.state).toBe('silent');
    expect(s.value).toBe('0');
    expect(s.tone).toBe('rose');
    expect(s.sub).toBe('webhook muet depuis 11:00'); // 10:00 UTC = 11:00 Casablanca
    expect(s.silenceSince).toBe('11:00');
    // Le lien diagnostiquer de l'E2 porte le contexte santé (DASH-12).
    expect(DELIVERED_SILENT_DIAGNOSE_HREF).toContain('from=health&check=deliveredFreshness');
  });

  it('F03-U-007 — sent=0 → untracked « — / non suivi », ton neutre', () => {
    const s = deliveredState({ sent: 0, delivered: 0, webhookLastSuccessAt: null }, NOW);
    expect(s).toMatchObject({ state: 'untracked', value: '—', sub: 'non suivi', tone: 'neutral' });
  });

  it("F03-U-008 — webhook JAMAIS armé (null) → untracked, PAS d'alerte rose", () => {
    const s = deliveredState({ sent: 12, delivered: 0, webhookLastSuccessAt: null }, NOW);
    expect(s.state).toBe('untracked');
    expect(s.tone).toBe('neutral');
  });

  it('F03-U-009 — table de vérité exhaustive : gardes exclusives et couvrantes', () => {
    const sents = [0, 42];
    const delivereds = [0, 38];
    const webhooks = [null, '2026-06-10T08:00:00.000Z'];
    for (const sent of sents) {
      for (const delivered of delivereds) {
        for (const webhookLastSuccessAt of webhooks) {
          const s = deliveredState({ sent, delivered, webhookLastSuccessAt }, NOW);
          // Couvrante : un état est TOUJOURS rendu.
          expect(['tracked', 'silent', 'untracked']).toContain(s.state);
          // Exclusive : l'état attendu est déterminé sans ambiguïté.
          const expected =
            delivered > 0
              ? 'tracked'
              : sent > 0 && webhookLastSuccessAt != null
                ? 'silent'
                : 'untracked';
          expect(s.state, `sent=${sent} delivered=${delivered} webhook=${webhookLastSuccessAt}`).toBe(
            expected,
          );
        }
      }
    }
  });

  it('F03-U-010 — tracked à ≥95 % des envoyés → ton emerald', () => {
    expect(deliveredState({ sent: 100, delivered: 98, webhookLastSuccessAt: null }, NOW).tone).toBe(
      'emerald',
    );
    expect(deliveredState({ sent: 100, delivered: 90, webhookLastSuccessAt: null }, NOW).tone).toBe(
      'neutral',
    );
  });

  it("F03-U-011 — fmtClock < 24 h → 'HH:MM' (Casablanca)", () => {
    expect(fmtClock('2026-06-10T10:00:00.000Z', NOW)).toBe('11:00');
  });

  it("F03-U-012 — fmtClock > 24 h → 'JJ/MM HH:MM'", () => {
    // 30 h avant NOW : 2026-06-09T06:00Z = 09/06 07:00 Casablanca.
    expect(fmtClock('2026-06-09T06:00:00.000Z', NOW)).toBe('09/06 07:00');
  });
});

describe('F03 — prédicat silence (bandeau)', () => {
  it('F03-U-013 — isDeliverySilent(1,0) → true', () => {
    expect(isDeliverySilent(1, 0)).toBe(true);
  });
  it('F03-U-014 — isDeliverySilent(0,0) → false (aucun envoi)', () => {
    expect(isDeliverySilent(0, 0)).toBe(false);
  });
  it('F03-U-015 — isDeliverySilent(5,2) → false (livraisons présentes)', () => {
    expect(isDeliverySilent(5, 2)).toBe(false);
  });
});

describe('F03 — tendances polarisées (trendLabel)', () => {
  it("F03-U-016 — pct undefined → '—' neutre (fenêtre sans comparaison)", () => {
    expect(trendLabel(undefined, '7 j préc.', 'good')).toEqual({ text: '—', tone: 'neutral' });
  });

  it('F03-U-017 — +12 % de livrés → emerald', () => {
    expect(trendLabel(12, '7 j préc.', 'good')).toEqual({
      text: '+12% vs 7 j préc.',
      tone: 'emerald',
    });
  });

  it("F03-U-018 — +1 % d'échecs → ROSE (hausse d'échecs = mauvais)", () => {
    expect(trendLabel(1, '7 j préc.', 'bad')).toEqual({ text: '+1% vs 7 j préc.', tone: 'rose' });
  });

  it('F03-U-019 — -30 % de livrés → rose (baisse de livrés = mauvais)', () => {
    expect(trendLabel(-30, '24 h préc.', 'good')).toEqual({
      text: '-30% vs 24 h préc.',
      tone: 'rose',
    });
  });

  it("F03-U-020 — 0 % → '= vs …' neutre", () => {
    expect(trendLabel(0, '30 j préc.', 'good')).toEqual({ text: '= vs 30 j préc.', tone: 'neutral' });
  });
});

describe('F03 — fenêtre (?window=)', () => {
  it("F03-U-021 — parseWindow('30d') → '30d'", () => {
    expect(parseWindow('30d')).toBe('30d');
  });
  it("F03-U-022 — parseWindow(undefined) → '7d' (défaut)", () => {
    expect(parseWindow(undefined)).toBe('7d');
  });
  it("F03-U-023 — parseWindow('bogus') → '7d' (jamais d'erreur ; '1h' refusé aussi : cockpit only)", () => {
    expect(parseWindow('bogus')).toBe('7d');
    expect(parseWindow('1h')).toBe('7d');
  });
  it('F03-U-024 — windowLabel : 24h/7d/30d → 24 h / 7 j / 30 j', () => {
    expect(windowLabel('24h')).toBe('24 h');
    expect(windowLabel('7d')).toBe('7 j');
    expect(windowLabel('30d')).toBe('30 j');
  });
});
