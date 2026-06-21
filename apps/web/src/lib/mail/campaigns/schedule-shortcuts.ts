/**
 * Raccourcis de planification (F05 P3.2-c3, assistance G11) — PUR.
 *
 * Produit des valeurs `datetime-local` (« YYYY-MM-DDTHH:mm », heure MURALE) pour
 * l'input de l'étape Planification, à partir d'un `now` injecté (déterministe,
 * testable). On reste en heure murale locale du navigateur — exactement ce que
 * l'input datetime-local et `validateSchedule` consomment — sans dépendre d'une
 * lib TZ côté client.
 *
 * Invariant : toutes les valeurs sont STRICTEMENT futures (> now) → satisfont la
 * garde « la date doit être dans le futur » de l'étape 5.
 */

export type ScheduleShortcut = {
  id: string;
  label: string;
  /** Valeur prête pour <input type="datetime-local"> : « YYYY-MM-DDTHH:mm ». */
  value: string;
};

/** Formate une Date en valeur datetime-local locale (heure murale, sans TZ). */
export function toDatetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Renvoie une copie de `base` avec l'heure fixée à h:m (locale). */
function atHour(base: Date, h: number, m = 0): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Copie de `now` décalée de `n` jours (locale). */
function plusDays(now: Date, n: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d;
}

/** Prochain lundi STRICTEMENT après `now` (jamais aujourd'hui). */
function nextMonday(now: Date): Date {
  const d = new Date(now);
  const delta = ((8 - d.getDay()) % 7) || 7; // 0=dim..6=sam ; toujours >= 1
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Liste ordonnée de raccourcis, tous futurs relativement à `now`.
 *  - « Dans 1 heure » : envoi proche, conserve les minutes courantes ;
 *  - « Demain 9 h » / « Dans 3 jours, 9 h » : créneaux matinaux usuels ;
 *  - « Lundi prochain, 9 h » : reprise de semaine.
 */
export function scheduleShortcuts(now: Date): ScheduleShortcut[] {
  return [
    { id: 'in-1h', label: 'Dans 1 heure', value: toDatetimeLocal(new Date(now.getTime() + 3_600_000)) },
    { id: 'tomorrow-9', label: 'Demain 9 h', value: toDatetimeLocal(atHour(plusDays(now, 1), 9)) },
    { id: 'in-3d-9', label: 'Dans 3 jours, 9 h', value: toDatetimeLocal(atHour(plusDays(now, 3), 9)) },
    { id: 'next-monday-9', label: 'Lundi prochain, 9 h', value: toDatetimeLocal(atHour(nextMonday(now), 9)) },
  ];
}
