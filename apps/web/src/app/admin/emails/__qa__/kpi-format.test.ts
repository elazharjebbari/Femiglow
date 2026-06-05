/**
 * Module 01 — Dashboard santé : fonctions pures de formatage KPI (F-001).
 *
 * Couche : unit (vitest). Oracles métier sur le formatage fr-FR, l'anti-
 * division-par-zéro, et la sémantique couleur des cartes. Ces helpers sont la
 * source de vérité partagée par `page.tsx` et `<KpiCards>`.
 */
import { describe, expect, it } from 'vitest';
import {
  DELIVERY_SILENCE_MIN_SENT,
  PENDING_AMBER_THRESHOLD,
  deliveredTone,
  dlqTone,
  failedTone,
  fmt,
  isDeliverySilent,
  pct,
  pendingTone,
} from '@/app/admin/emails/kpi-format';

describe('kpi-format — formatage & sémantique', () => {
  // DSH-UNIT-001 — anti-division-par-zéro : den=0 → '—', jamais 'NaN %'.
  it("DSH-UNIT-001 : pct(num, 0) retourne le tiret '—' (pas de NaN ni division)", () => {
    expect(pct(0, 0)).toBe('—');
    expect(pct(5, 0)).toBe('—');
    expect(pct(0, 0)).not.toContain('NaN');
    expect(pct(0, 0)).not.toContain('%');
  });

  // DSH-UNIT-002 — pct(108,120) = 90.0 % (1 décimale exacte).
  it("DSH-UNIT-002 : pct(108, 120) formate '90.0 %' (1 décimale)", () => {
    expect(pct(108, 120)).toBe('90.0 %');
    // 1140/1200 = 95.0 % (scénario nominal).
    expect(pct(1140, 1200)).toBe('95.0 %');
    // Arrondi à 1 décimale, pas de troncature brute.
    expect(pct(1, 3)).toBe('33.3 %');
  });

  // DSH-UNIT-003 — fmt(1234) en fr-FR : '1' et '234' séparés par un espace
  // insécable (U+202F ou U+00A0 selon ICU). On vérifie la présence des blocs
  // ET l'absence du chiffre brut '1234' collé.
  it("DSH-UNIT-003 : fmt(1234) sépare les milliers en fr-FR", () => {
    const out = fmt(1234);
    expect(out).not.toBe('1234');
    // Les chiffres restent dans l'ordre, séparés par un caractère d'espacement.
    expect(out.replace(/[\s  ]/g, '')).toBe('1234');
    expect(out).toMatch(/^1[\s  ]234$/);
    // Gros volume : 50 000.
    expect(fmt(50000).replace(/[\s  ]/g, '')).toBe('50000');
  });

  // DSH-UNIT-001 (complément) — fmt(0) === '0' : un zéro est un vrai chiffre,
  // pas « pas de données ».
  it("DSH-UNIT-001b : fmt(0) === '0' (zéro est une donnée légitime)", () => {
    expect(fmt(0)).toBe('0');
  });

  // ── Sémantique couleur (alimente DSH-MSW-012/013/014/018) ───────────────

  it('failedTone : ambre dès 1 échec, neutre à 0', () => {
    expect(failedTone(0)).toBe('neutral');
    expect(failedTone(1)).toBe('amber');
    expect(failedTone(12)).toBe('amber');
  });

  it('dlqTone : rose dès 1 DLQ, neutre à 0', () => {
    expect(dlqTone(0)).toBe('neutral');
    expect(dlqTone(5)).toBe('rose');
  });

  it('pendingTone : ambre STRICTEMENT au-dessus du seuil (50 reste neutre, 51 ambre)', () => {
    expect(PENDING_AMBER_THRESHOLD).toBe(50);
    expect(pendingTone(50)).toBe('neutral');
    expect(pendingTone(51)).toBe('amber');
    expect(pendingTone(640)).toBe('amber');
  });

  // F-001 — la carte Livrés alerte (rose) SSI des envois existent mais 0 livré.
  it('isDeliverySilent : sent>=seuil & delivered=0 → true ; sinon false', () => {
    expect(DELIVERY_SILENCE_MIN_SENT).toBe(1);
    expect(isDeliverySilent(4200, 0)).toBe(true);
    expect(isDeliverySilent(1, 0)).toBe(true);
    // Pas d'envois → pas d'anomalie (base vide n'est pas une panne).
    expect(isDeliverySilent(0, 0)).toBe(false);
    // Au moins une livraison confirmée → tout va bien.
    expect(isDeliverySilent(4200, 1)).toBe(false);
  });

  it('deliveredTone : rose quand livraison silencieuse, neutre quand des livraisons arrivent', () => {
    expect(deliveredTone({ sentLast7d: 4200, deliveredLast7d: 0 })).toBe('rose');
    expect(deliveredTone({ sentLast7d: 1200, deliveredLast7d: 1140 })).toBe('neutral');
    expect(deliveredTone({ sentLast7d: 0, deliveredLast7d: 0 })).toBe('neutral');
  });
});
