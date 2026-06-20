// @vitest-environment node
/**
 * F05 — planification TZ-aware (é5, CMP-F07) : F05-U-026..030.
 * Conversion heure murale Africa/Casablanca ↔ UTC en lisant l'offset réel
 * (DST/ramadan), et validation (passé refusé, futur accepté, mode planifié
 * sans date).
 */
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_DEFAULT_TZ,
  tzOffsetMs,
  wallClockToUtc,
  utcToWallClock,
  validateSchedule,
  SCHEDULE_PAST_ERROR,
  SCHEDULE_MISSING_ERROR,
} from '@/lib/mail/campaigns/campaign-schedule';

describe('F05 — conversion datetime-local → UTC (TZ Casablanca)', () => {
  it('F05-U-026 — hiver +01 : 09:00 murale Casablanca = 08:00 UTC', () => {
    // Maroc en heure permanente +01 hors ramadan (depuis 2018).
    const utc = wallClockToUtc('2026-01-15T09:00', CAMPAIGN_DEFAULT_TZ);
    expect(utc).not.toBeNull();
    expect(utc!.toISOString()).toBe('2026-01-15T08:00:00.000Z');
    // Round-trip : ré-affichage en murale = saisie d'origine.
    expect(utcToWallClock(utc!, CAMPAIGN_DEFAULT_TZ)).toBe('2026-01-15T09:00');
  });

  it('F05-U-027 — DST/ramadan : la conversion lit l’offset RÉEL (round-trip exact toute l’année)', () => {
    // On n'épingle PAS l'offset ramadan (il dépend de la prédiction tzdata) :
    // on prouve la propriété de correction — round-trip identité quelle que soit
    // la bascule — sur des dates réparties (dont la fenêtre ramadan 2026 ≈ fév-mars).
    for (const local of [
      '2026-01-15T09:00',
      '2026-03-05T09:00', // fenêtre ramadan probable (offset potentiellement +00)
      '2026-07-15T18:30',
      '2026-10-20T23:45',
    ]) {
      const utc = wallClockToUtc(local, CAMPAIGN_DEFAULT_TZ);
      expect(utc, local).not.toBeNull();
      expect(utcToWallClock(utc!, CAMPAIGN_DEFAULT_TZ), `round-trip ${local}`).toBe(local);
    }
  });

  it('tzOffsetMs : UTC a un offset nul, Casablanca un offset multiple de l’heure', () => {
    const instant = new Date('2026-01-15T12:00:00.000Z');
    expect(tzOffsetMs(instant, 'UTC')).toBe(0);
    const casa = tzOffsetMs(instant, CAMPAIGN_DEFAULT_TZ);
    expect(casa % 3_600_000).toBe(0); // offset entier en heures
    expect(casa).toBeGreaterThanOrEqual(0);
  });

  it('format invalide → null (jamais de crash)', () => {
    expect(wallClockToUtc('pas une date', CAMPAIGN_DEFAULT_TZ)).toBeNull();
    expect(wallClockToUtc('', CAMPAIGN_DEFAULT_TZ)).toBeNull();
  });
});

describe('F05 — validation de planification', () => {
  const NOW = new Date('2026-06-20T12:00:00.000Z');

  it('F05-U-028 — date dans le passé refusée (sur l’instant converti)', () => {
    const res = validateSchedule('scheduled', '2026-06-20T10:00', CAMPAIGN_DEFAULT_TZ, NOW);
    // 10:00 Casablanca (+01) = 09:00 UTC < NOW (12:00 UTC) → refusé.
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(SCHEDULE_PAST_ERROR);
  });

  it('F05-U-029 — date future acceptée → instant UTC retourné', () => {
    const res = validateSchedule('scheduled', '2026-06-21T09:00', CAMPAIGN_DEFAULT_TZ, NOW);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.instant.getTime()).toBeGreaterThan(NOW.getTime());
      expect(res.instant.toISOString()).toBe('2026-06-21T08:00:00.000Z');
    }
  });

  it('F05-U-030 — mode planifié SANS date → erreur dédiée', () => {
    const res = validateSchedule('scheduled', '', CAMPAIGN_DEFAULT_TZ, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(SCHEDULE_MISSING_ERROR);
  });

  it('mode "now" → toujours ok (pas de date requise)', () => {
    expect(validateSchedule('now', null, CAMPAIGN_DEFAULT_TZ, NOW).ok).toBe(true);
  });
});
