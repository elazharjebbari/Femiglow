'use client';

/**
 * useCampaignAutosave — autosave du wizard campagne (F05 P3.2-c, CMP-F10).
 *
 * Contrat :
 *  - `schedule(patch)` : enregistre un patch partiel après un debounce TRAILING
 *    (2 s par défaut) ; une rafale réarme le timer (1 seul save après la
 *    dernière frappe — F05-U-031/032) ; les patchs successifs sont FUSIONNÉS.
 *  - `flush()` : sauvegarde immédiate (passage d'étape / blur) — annule le timer.
 *  - optimistic-lock : le `_rev` retourné par le serveur est renvoyé en
 *    `expectedRev` au save suivant ; un `conflict` fige l'autosave (statut
 *    'conflict') pour ne JAMAIS écraser une écriture concurrente.
 *  - machine de statut observable : idle → saving → saved | conflict | error.
 *
 * `save` est INJECTÉ (wrapper de la server action saveWizardProgress) → le hook
 * est testable sans réseau.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export type AutosaveSaveResult =
  | { ok: true; rev: number; updatedAt: string }
  | { ok: false; reason: 'not_found' | 'not_draft' | 'conflict' };

export type AutosavePatch = Record<string, unknown>;

export type CampaignAutosave = {
  status: AutosaveStatus;
  /** ISO du dernier enregistrement réussi (pour l'indicateur Freshness). */
  savedAt: string | null;
  /** Programme un save (debounce trailing) avec un patch fusionné. */
  schedule: (patch: AutosavePatch) => void;
  /** Force un save immédiat (passage d'étape / blur) ; no-op si rien en attente. */
  flush: () => Promise<void>;
  /** Révision courante connue (optimistic-lock). */
  currentRev: () => number | undefined;
};

export function useCampaignAutosave(opts: {
  save: (patch: AutosavePatch & { expectedRev?: number }) => Promise<AutosaveSaveResult>;
  initialRev?: number;
  debounceMs?: number;
}): CampaignAutosave {
  const { save, initialRev, debounceMs = 2000 } = opts;
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const revRef = useRef<number | undefined>(initialRev);
  const pendingRef = useRef<AutosavePatch | null>(null);
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflictRef = useRef(false);
  // `save` peut changer d'identité à chaque render (closure sur l'état du
  // wizard) — on le lit via une ref pour que schedule/flush restent stables et
  // n'arment/désarment pas le debounce à chaque frappe (gotcha P2.1).
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const doSave = useCallback(async (): Promise<void> => {
    if (conflictRef.current) return; // figé après conflit — ne jamais écraser
    if (inFlightRef.current) return; // un save en vol ; le trailing rejouera
    if (!pendingRef.current) return;
    const patch = pendingRef.current;
    pendingRef.current = null;
    inFlightRef.current = true;
    setStatus('saving');
    try {
      const res = await saveRef.current({ ...patch, expectedRev: revRef.current });
      if (res.ok) {
        revRef.current = res.rev;
        setSavedAt(res.updatedAt);
        setStatus('saved');
      } else if (res.reason === 'conflict') {
        conflictRef.current = true;
        setStatus('conflict');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      inFlightRef.current = false;
      // Des changements arrivés PENDANT le vol → on rejoue (coalescés).
      if (pendingRef.current && !conflictRef.current) void doSave();
    }
  }, []);

  const schedule = useCallback(
    (patch: AutosavePatch) => {
      if (conflictRef.current) return;
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void doSave(), debounceMs);
    },
    [doSave, debounceMs],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await doSave();
  }, [doSave]);

  // Nettoyage : timer dégagé au démontage (zéro timer résiduel).
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const currentRev = useCallback(() => revRef.current, []);

  return { status, savedAt, schedule, flush, currentRev };
}
