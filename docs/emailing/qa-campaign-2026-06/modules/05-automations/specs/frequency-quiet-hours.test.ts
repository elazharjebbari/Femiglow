/**
 * AUT-UNIT-030..045 — frequency.ts : quiet hours (tz / passage minuit / DST).
 *
 * Doctrine "promesse UI = comportement réel" : le réglage quiet hours promet
 * "pas d'envoi hors [start,end] dans le tz configuré". Ces tests encodent
 * l'oracle CIBLE (heure WALL-CLOCK locale du tz). Ils sont attendus en ROUGE
 * sur l'implémentation actuelle :
 *   - applyQuietHours calcule l'offset en UTC (setUTCMinutes) à partir d'une
 *     heure locale -> faux dès que l'offset tz != 0 (Casablanca = UTC+1, +DST) ;
 *   - la fenêtre enjambant minuit (08:00..22:00 => nuit hors fenêtre) n'est pas
 *     gérée proprement au passage de 00:00 ;
 *   - frequency.ts n'est de toute façon jamais importé par le runner (code mort).
 *
 * Style : table-driven (it.each), horloge contrôlée, oracle métier explicite.
 * Réf : src/lib/mail/automation/frequency.ts ; inventaire F-052.
 */
import { describe, it, expect } from 'vitest';
import { applyQuietHours } from '@/lib/mail/automation/frequency';

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

const cfg = (over: Partial<Parameters<typeof applyQuietHours>[1]> = {}) => ({
  quietHoursEnabled: true,
  quietHoursStart: '08:00',
  quietHoursEnd: '22:00',
  quietHoursTz: CASA,
  ...over,
});

describe('applyQuietHours — fenêtre [08:00,22:00] Africa/Casablanca', () => {
  // AUT-UNIT-031 : in-window inchangé
  it('AUT-UNIT-031 : un envoi à 10:00 Casablanca n’est pas différé', () => {
    // 2026-06-15 10:00 Casablanca (UTC+1 en été marocain) == 09:00 UTC.
    const at = new Date('2026-06-15T09:00:00Z');
    const out = applyQuietHours(at, cfg());
    expect(out.getTime()).toBe(at.getTime());
  });

  // AUT-UNIT-030 : 23:00 -> 08:00 lendemain (CIBLE)
  it('AUT-UNIT-030 : 23:00 Casablanca → différé à 08:00 le lendemain', () => {
    // 2026-06-15 23:00 Casablanca == 22:00 UTC.
    const at = new Date('2026-06-15T22:00:00Z');
    const out = applyQuietHours(at, cfg());
    const { h, m } = localHm(out, CASA);
    expect({ h, m }).toEqual({ h: 8, m: 0 }); // 08:00 wall-clock local
    expect(out.getTime()).toBeGreaterThan(at.getTime());
    // et le lendemain (date locale différente)
    const dIn = new Intl.DateTimeFormat('en-CA', { timeZone: CASA }).format(at);
    const dOut = new Intl.DateTimeFormat('en-CA', { timeZone: CASA }).format(out);
    expect(dOut > dIn).toBe(true);
  });

  // AUT-UNIT-033 : passage minuit — 00:30 -> 08:00 le jour même
  it('AUT-UNIT-033 : 00:30 Casablanca → différé à 08:00 le jour même', () => {
    // 2026-06-15 00:30 Casablanca == 2026-06-14 23:30 UTC.
    const at = new Date('2026-06-14T23:30:00Z');
    const out = applyQuietHours(at, cfg());
    const { h, m } = localHm(out, CASA);
    expect({ h, m }).toEqual({ h: 8, m: 0 });
    expect(out.getTime()).toBeGreaterThan(at.getTime());
  });

  // AUT-UNIT-040 : minute du start respectée
  it('AUT-UNIT-040 : start 08:30 → différé à 08:30 (pas 08:00)', () => {
    const at = new Date('2026-06-15T22:00:00Z'); // 23:00 Casa
    const out = applyQuietHours(at, cfg({ quietHoursStart: '08:30' }));
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 30 });
  });

  // AUT-UNIT-037 : disabled -> bypass
  it('AUT-UNIT-037 : quietHoursEnabled=false ne diffère jamais', () => {
    const at = new Date('2026-06-15T22:00:00Z');
    const out = applyQuietHours(at, cfg({ quietHoursEnabled: false }));
    expect(out.getTime()).toBe(at.getTime());
  });

  // AUT-UNIT-044 : jamais dans le passé
  it('AUT-UNIT-044 : le résultat n’est jamais antérieur à l’entrée', () => {
    for (const hourUtc of [0, 3, 6, 9, 12, 15, 18, 21]) {
      const at = new Date(`2026-06-15T${String(hourUtc).padStart(2, '0')}:00:00Z`);
      const out = applyQuietHours(at, cfg());
      expect(out.getTime()).toBeGreaterThanOrEqual(at.getTime());
    }
  });
});

describe('applyQuietHours — table-driven 24h x oracle wall-clock (AUT-UNIT-042)', () => {
  // Pour chaque heure locale Casablanca, l'oracle : si dans [08,22) -> inchangé,
  // sinon -> prochaine occurrence de 08:00 locale.
  const cases = Array.from({ length: 24 }, (_, localHour) => {
    const inWindow = localHour >= 8 && localHour < 22;
    return { localHour, inWindow };
  });

  it.each(cases)(
    'AUT-UNIT-042 : %j → fenêtre respectée',
    ({ localHour, inWindow }) => {
      // Construit une Date dont l'heure locale Casablanca == localHour.
      // Casablanca été = UTC+1 -> utcHour = localHour - 1 (mod 24).
      const utcHour = (localHour - 1 + 24) % 24;
      const at = new Date(`2026-06-15T${String(utcHour).padStart(2, '0')}:00:00Z`);
      const out = applyQuietHours(at, cfg());
      if (inWindow) {
        expect(out.getTime()).toBe(at.getTime());
      } else {
        expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 });
        expect(out.getTime()).toBeGreaterThan(at.getTime());
      }
    },
  );
});

describe('applyQuietHours — DST marocaine (AUT-UNIT-035/036)', () => {
  // Le Maroc applique des bascules DST (et une pause Ramadan). L'oracle CIBLE :
  // l'heure différée reste 08:00 WALL-CLOCK quel que soit l'offset effectif.
  it('AUT-UNIT-035 : différé reste 08:00 wall-clock autour d’une bascule', () => {
    // 23:00 local la veille d'une bascule.
    const at = new Date('2026-03-29T22:00:00Z');
    const out = applyQuietHours(at, cfg());
    expect(localHm(out, CASA)).toEqual({ h: 8, m: 0 });
  });

  it('AUT-UNIT-036 : pas de double-différé ni envoi à 07:00 après bascule', () => {
    const at = new Date('2026-10-25T23:30:00Z');
    const out = applyQuietHours(at, cfg());
    const { h } = localHm(out, CASA);
    expect(h).toBe(8); // jamais 7 ni 9
  });
});
