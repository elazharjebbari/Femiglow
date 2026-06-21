// @vitest-environment node
/**
 * F05 P3.2-c3 — raccourcis de planification (datetime-local, déterministes).
 *
 * `now` construit en heure LOCALE (constructeur numérique) pour que getDate/
 * getDay/getHours soient cohérents quelle que soit la TZ de l'environnement.
 */
import { describe, expect, it } from 'vitest';
import { scheduleShortcuts, toDatetimeLocal } from '../schedule-shortcuts';

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// 15 juin 2026, 12:30 (local).
const NOW = new Date(2026, 5, 15, 12, 30, 0, 0);

describe('F05 — schedule-shortcuts', () => {
  it('F05-U-050 — toutes les valeurs sont au format datetime-local', () => {
    for (const s of scheduleShortcuts(NOW)) {
      expect(s.value).toMatch(DATETIME_LOCAL);
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it('F05-U-051 — toutes les valeurs sont STRICTEMENT futures (> now)', () => {
    for (const s of scheduleShortcuts(NOW)) {
      expect(new Date(s.value).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('F05-U-052 — « Demain 9 h » = jour suivant à 09:00', () => {
    const tomorrow9 = scheduleShortcuts(NOW).find((s) => s.id === 'tomorrow-9')!;
    expect(tomorrow9.value).toBe('2026-06-16T09:00');
  });

  it('F05-U-053 — « Lundi prochain » tombe un lundi strictement après now', () => {
    const monday = scheduleShortcuts(NOW).find((s) => s.id === 'next-monday-9')!;
    const d = new Date(monday.value);
    expect(d.getDay()).toBe(1); // lundi
    expect(d.getTime()).toBeGreaterThan(NOW.getTime());
    expect(monday.value.endsWith('T09:00')).toBe(true);
  });

  it('F05-U-054 — « Dans 1 heure » = now + 1 h (heure murale)', () => {
    const inHour = scheduleShortcuts(NOW).find((s) => s.id === 'in-1h')!;
    expect(inHour.value).toBe(toDatetimeLocal(new Date(NOW.getTime() + 3_600_000)));
    expect(inHour.value).toBe('2026-06-15T13:30');
  });
});
