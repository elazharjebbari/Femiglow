/**
 * FRQ-UNIT-0xx — frequency.ts (logique pure) : quiet hours tz / minuit / DST,
 * + bornes du daily cap calé sur minuit Casablanca.
 *
 * Doctrine « promesse UI = comportement réel » : le réglage quiet hours promet
 * « pas d'envoi hors [start,end] dans le tz configuré ». Ces tests encodent
 * l'oracle CIBLE (heure WALL-CLOCK locale du tz), pas l'arithmétique UTC buggée
 * d'origine (`setUTCMinutes` à partir d'une heure locale → faux dès offset ≠ 0).
 *
 * Réf matrice : AUT-UNIT-030..045 (renommés FRQ-UNIT-030..052 ici).
 * Réf code : src/lib/mail/automation/frequency.ts ; inventaire F-052.
 *
 * Horloge contrôlée par des dates UTC fixes (aucun Date.now caché dans
 * applyQuietHours → pas besoin de fake timers pour la logique pure).
 */
import { describe, it, expect } from 'vitest';
import { applyQuietHours } from '../frequency';

const CASA = 'Africa/Casablanca';

/** Heure (HH, MM) lue dans un tz donné pour une Date. Helper d'oracle. */
function localHm(d: Date, tz: string): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { h: h === 24 ? 0 : h, m };
}

/** Date locale (YYYY-MM-DD) d'un instant dans un tz. */
function localDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

const cfg = (over: Partial<Parameters<typeof applyQuietHours>[1]> = {}) => ({
  quietHoursEnabled: true,
  quietHoursStart: '08:00',
  quietHoursEnd: '22:00',
  quietHoursTz: CASA,
  ...over,
});

describe('applyQuietHours — fenêtre autorisée [08:00,22:00] Africa/Casablanca', () => {
  // FRQ-UNIT-031 : in-window inchangé
  it('FRQ-UNIT-031 : un envoi à 10:00 Casablanca n’est pas différé', () => {
    // 2026-06-15 10:00 Casablanca (UTC+1 en été marocain) == 09:00 UTC.
    const at = new Date('2026-06-15T09:00:00Z');
    const out = applyQuietHours(at, cfg());
    expect(out.getTime()).toBe(at.getTime());
  });

  // FRQ-UNIT-030 : 23:00 -> 08:00 lendemain (CIBLE)
  it('FRQ-UNIT-030 : 23:00 Casablanca → différé à 08:00 le lendemain', () => {
    // 2026-06-15 23:00 Casablanca == 22:00 UTC.
    const at = new Date('2026-06-15T22:00:00Z');
    const out = applyQuietHours(at, cfg());
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 }); // 08:00 wall-clock local
    expect(out.getTime()).toBeGreaterThan(at.getTime());
    // et le lendemain (date locale différente)
    expect(localDate(out, CASA) > localDate(at, CASA)).toBe(true);
  });

  // FRQ-UNIT-032 : juste avant le start → différé à 08:00 le jour même
  it('FRQ-UNIT-032 : 07:59 Casablanca → différé à 08:00 le même jour', () => {
    // 2026-06-15 07:59 Casablanca == 06:59 UTC.
    const at = new Date('2026-06-15T06:59:00Z');
    const out = applyQuietHours(at, cfg());
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 });
    expect(localDate(out, CASA)).toBe(localDate(at, CASA)); // même jour
    expect(out.getTime()).toBeGreaterThan(at.getTime());
  });

  // FRQ-UNIT-033 : passage minuit — 00:30 -> 08:00 le jour même
  it('FRQ-UNIT-033 : 00:30 Casablanca → différé à 08:00 le jour même', () => {
    // 2026-06-15 00:30 Casablanca == 2026-06-14 23:30 UTC.
    const at = new Date('2026-06-14T23:30:00Z');
    const out = applyQuietHours(at, cfg());
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 });
    expect(localDate(out, CASA)).toBe('2026-06-15'); // 08:00 le 15 (jour local de 00:30)
    expect(out.getTime()).toBeGreaterThan(at.getTime());
  });

  // FRQ-UNIT-034 : offset tz appliqué en LOCAL pas en UTC (RED sur setUTCMinutes)
  it('FRQ-UNIT-034 : le différé tombe sur 08:00 LOCALE Casablanca, pas 08:00 UTC', () => {
    const at = new Date('2026-06-15T22:00:00Z'); // 23:00 Casa
    const out = applyQuietHours(at, cfg());
    // 08:00 Casa en été (UTC+1) == 07:00 UTC. Le bug UTC produirait 08:00 UTC.
    expect(out.getUTCHours()).toBe(7);
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 });
  });

  // FRQ-UNIT-040 : minute du start respectée
  it('FRQ-UNIT-040 : start 08:30 → différé à 08:30 (pas 08:00)', () => {
    const at = new Date('2026-06-15T22:00:00Z'); // 23:00 Casa
    const out = applyQuietHours(at, cfg({ quietHoursStart: '08:30' }));
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 30 });
  });

  // FRQ-UNIT-037 : disabled -> bypass total
  it('FRQ-UNIT-037 : quietHoursEnabled=false ne diffère jamais', () => {
    const at = new Date('2026-06-15T22:00:00Z');
    const out = applyQuietHours(at, cfg({ quietHoursEnabled: false }));
    expect(out.getTime()).toBe(at.getTime());
  });

  // FRQ-UNIT-038 : fenêtre vide start==end → no-op sûr (pas de boucle / NaN)
  it('FRQ-UNIT-038 : start==end (fenêtre vide) ne diffère pas et ne plante pas', () => {
    const at = new Date('2026-06-15T22:00:00Z');
    const out = applyQuietHours(at, cfg({ quietHoursStart: '08:00', quietHoursEnd: '08:00' }));
    expect(out.getTime()).toBe(at.getTime());
    expect(Number.isNaN(out.getTime())).toBe(false);
  });

  // FRQ-UNIT-039 : start invalide (non HH:mm) → valeur sûre (inchangé, pas de crash)
  it('FRQ-UNIT-039 : start invalide retourne nextActionAt inchangé sans NaN', () => {
    const at = new Date('2026-06-15T22:00:00Z');
    const out = applyQuietHours(at, cfg({ quietHoursStart: '99:99' }));
    expect(out.getTime()).toBe(at.getTime());
    expect(Number.isNaN(out.getTime())).toBe(false);
  });

  // FRQ-UNIT-041 : tz UTC nominal (sanity, contrôle de non-régression de l'ancien test)
  it('FRQ-UNIT-041 : en tz UTC, 23:30 → 08:00 UTC le lendemain', () => {
    const at = new Date('2026-05-14T23:30:00Z');
    const out = applyQuietHours(at, cfg({ quietHoursTz: 'UTC' }));
    expect(out.getUTCHours()).toBe(8);
    expect(out.getUTCDate()).toBe(15);
  });

  // FRQ-UNIT-043 : déterministe (pas de Date.now caché)
  it('FRQ-UNIT-043 : deux appels identiques retournent la même Date', () => {
    const at = new Date('2026-06-15T22:00:00Z');
    const a = applyQuietHours(at, cfg());
    const b = applyQuietHours(at, cfg());
    expect(a.getTime()).toBe(b.getTime());
  });

  // FRQ-UNIT-044 : différé jamais dans le passé (balayage 24h)
  it('FRQ-UNIT-044 : le résultat n’est jamais antérieur à l’entrée', () => {
    for (const hourUtc of [0, 3, 6, 9, 12, 15, 18, 21, 23]) {
      const at = new Date(`2026-06-15T${String(hourUtc).padStart(2, '0')}:00:00Z`);
      const out = applyQuietHours(at, cfg());
      expect(out.getTime()).toBeGreaterThanOrEqual(at.getTime());
    }
  });
});

describe('applyQuietHours — table-driven 24h x oracle wall-clock (FRQ-UNIT-042)', () => {
  // Pour chaque heure locale Casablanca, oracle : si dans [08,22) → inchangé,
  // sinon → prochaine occurrence de 08:00 locale.
  const cases = Array.from({ length: 24 }, (_, localHour) => ({
    localHour,
    inWindow: localHour >= 8 && localHour < 22,
  }));

  it.each(cases)('FRQ-UNIT-042 : heure locale %j respecte la fenêtre', ({ localHour, inWindow }) => {
    // Casablanca été = UTC+1 → utcHour = (localHour - 1) mod 24.
    const utcHour = (localHour - 1 + 24) % 24;
    const at = new Date(`2026-06-15T${String(utcHour).padStart(2, '0')}:00:00Z`);
    const out = applyQuietHours(at, cfg());
    if (inWindow) {
      expect(out.getTime()).toBe(at.getTime());
    } else {
      expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 });
      expect(out.getTime()).toBeGreaterThan(at.getTime());
    }
  });
});

describe('applyQuietHours — DST marocaine (FRQ-UNIT-035/036)', () => {
  // Le Maroc applique des bascules d'offset (heure d'été + pause Ramadan).
  // Oracle CIBLE : l'heure différée reste 08:00 WALL-CLOCK quel que soit l'offset.
  // FRQ-UNIT-035 : printemps
  it('FRQ-UNIT-035 : différé reste 08:00 wall-clock autour d’une bascule de printemps', () => {
    const at = new Date('2026-03-29T22:00:00Z'); // soirée près d'une bascule
    const out = applyQuietHours(at, cfg());
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 });
    expect(out.getTime()).toBeGreaterThan(at.getTime());
  });

  // FRQ-UNIT-036 : automne — jamais 07:00 ni double-différé
  it('FRQ-UNIT-036 : pas d’envoi à 07:00 après une bascule d’automne', () => {
    const at = new Date('2026-10-25T23:30:00Z');
    const out = applyQuietHours(at, cfg());
    expect(localHm(out, CASA).h).toBe(8); // jamais 7 ni 9
  });
});
