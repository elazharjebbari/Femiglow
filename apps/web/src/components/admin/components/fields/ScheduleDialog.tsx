/**
 * ScheduleDialog — modale pour programmer la publication d'un draft.
 *
 * Champs :
 *   - date (input type=date),
 *   - heure (input type=time),
 *   - timezone (read-only — Europe/Paris pour le projet FemiGlow),
 *   - aperçu lisible "Le 12 mai 2026 à 09:00 (heure de Paris)".
 *
 * À la confirmation : POST /api/admin/components/[key]/fields/[fieldKey]/schedule
 * avec `{ scheduledAt: ISO }`. Le composant n'effectue pas le fetch lui-même —
 * il appelle `onConfirm(isoString)` que le parent (FieldsPanel) câble.
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P10.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';

const TZ_LABEL = 'Europe/Paris';

interface Props {
  open: boolean;
  fieldLabel: string;
  /** Si une programmation existe déjà, on la pré-remplit (ISO 8601). */
  initialScheduledAt?: string | null;
  onConfirm: (isoString: string) => void;
  onCancel: () => void;
  /** Erreur de la dernière tentative de programmation (affichée inline). */
  error?: string | null;
}

/**
 * Convertit un Date en `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` exprimé
 * dans le fuseau Europe/Paris. On utilise `Intl.DateTimeFormat` pour
 * éviter les pièges du fuseau de la machine du client.
 */
function toParisParts(d: Date): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_LABEL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** Formate un Date en `'YYYY-MM-DD HH:MM'` exprimé en Europe/Paris. */
function formatParisYMDHM(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_LABEL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/**
 * Convertit `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` (interprété en
 * Europe/Paris) en ISO 8601 UTC. Approche itérative robuste qui gère
 * automatiquement l'heure d'été (DST) : on cherche le timestamp UTC
 * dont la projection Europe/Paris correspond au `date+time` voulu.
 */
function fromParisToISO(date: string, time: string): string {
  const target = `${date} ${time}`;
  // Initial guess : interprète `date+time` comme UTC, puis on ajuste.
  let guessMs = new Date(`${date}T${time}:00.000Z`).getTime();
  for (let i = 0; i < 3; i++) {
    const parisFmt = formatParisYMDHM(new Date(guessMs));
    if (parisFmt === target) break;
    const targetAsUtcMs = Date.parse(`${date}T${time}:00Z`);
    const parisAsUtcMs = Date.parse(parisFmt.replace(' ', 'T') + ':00Z');
    if (Number.isNaN(targetAsUtcMs) || Number.isNaN(parisAsUtcMs)) break;
    guessMs += targetAsUtcMs - parisAsUtcMs;
  }
  return new Date(guessMs).toISOString();
}

function formatHumanReadable(date: string, time: string): string {
  if (!date || !time) return '';
  try {
    const iso = fromParisToISO(date, time);
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: TZ_LABEL,
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function ScheduleDialog({
  open,
  fieldLabel,
  initialScheduledAt,
  onConfirm,
  onCancel,
  error,
}: Props): JSX.Element | null {
  const initial = useMemo<{ date: string; time: string }>(() => {
    if (initialScheduledAt) {
      try {
        return toParisParts(new Date(initialScheduledAt));
      } catch {
        // fallthrough
      }
    }
    // Par défaut : maintenant + 1 h, arrondi à la minute supérieure.
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return toParisParts(d);
  }, [initialScheduledAt]);

  const [date, setDate] = useState<string>(initial.date);
  const [time, setTime] = useState<string>(initial.time);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(initial.date);
    setTime(initial.time);
    setLocalError(null);
  }, [open, initial.date, initial.time]);

  if (!open) return null;

  const human = formatHumanReadable(date, time);

  function handleConfirm(): void {
    if (!date || !time) {
      setLocalError('Renseignez une date et une heure.');
      return;
    }
    let iso: string;
    try {
      iso = fromParisToISO(date, time);
    } catch {
      setLocalError('Date / heure invalide.');
      return;
    }
    const target = new Date(iso).getTime();
    const minTarget = Date.now() + 60_000; // anti-flap : ≥ +1 min
    if (target < minTarget) {
      setLocalError('La publication doit être programmée au moins 1 minute dans le futur.');
      return;
    }
    setLocalError(null);
    onConfirm(iso);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-dialog-title"
      className="schedule-dialog fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="schedule-dialog-title" className="text-lg font-semibold text-stone-900">
          Programmer la publication
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Choisissez la date et l'heure (heure de Paris) à laquelle
          publier le brouillon de <strong>{fieldLabel}</strong>.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Heure</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-2 py-1.5"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-stone-500">
          Fuseau : <code className="font-mono">Europe/Paris</code>. {human ? (
            <>
              Publication prévue : <strong>{human}</strong>.
            </>
          ) : null}
        </p>

        {(localError || error) ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {localError || error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="button"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white"
            onClick={handleConfirm}
          >
            Programmer
          </button>
        </div>
      </div>
    </div>
  );
}

export const __test = { toParisParts, fromParisToISO, formatHumanReadable };
