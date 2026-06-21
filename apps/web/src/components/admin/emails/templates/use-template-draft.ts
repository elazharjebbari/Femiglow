'use client';

/**
 * useTemplateDraft — brouillon LOCAL (localStorage) de l'éditeur de template
 * (F07 P3.4-a, Lot 1). Filet anti-perte : la frappe est sauvegardée localement
 * (debounce 1 s) ; à la réouverture, si un brouillon DIVERGENT et FRAIS existe,
 * on propose de le restaurer (le composant affiche le ConfirmDialog).
 *
 * Sécurité/robustesse (G12/G15) :
 *  - `schemaVersion` : un brouillon d'un ancien format est purgé (jamais appliqué) ;
 *  - TTL : un brouillon trop vieux est purgé (pas de PII qui traîne indéfiniment
 *    sur une machine partagée) ;
 *  - tant que la restauration n'est pas TRANCHÉE, l'autosave est SUSPENDU (sinon
 *    l'état serveur fraîchement monté écraserait le brouillon qu'on propose).
 *
 * Pur/injectable (storage + now) → testable sans navigateur.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type TemplateDraftState = {
  subject: string;
  preheader: string;
  htmlSource: string;
  customVars: string;
};

export type TemplateDraftRecord = {
  /** Version de schéma du brouillon (purge si différent). */
  v: number;
  /** ISO de la dernière écriture locale. */
  savedAt: string;
  data: TemplateDraftState;
};

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const TEMPLATE_DRAFT_SCHEMA_VERSION = 1;
export const TEMPLATE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export function templateDraftKey(templateId: string): string {
  return `femiglow:tpl-draft:${templateId}`;
}

function sameState(a: TemplateDraftState, b: TemplateDraftState): boolean {
  return (
    a.subject === b.subject &&
    a.preheader === b.preheader &&
    a.htmlSource === b.htmlSource &&
    a.customVars === b.customVars
  );
}

export type TemplateDraft = {
  status: 'idle' | 'saved';
  savedAt: string | null;
  /** Brouillon proposé à la restauration (null si rien à restaurer). */
  pendingRestore: { data: TemplateDraftState; savedAt: string } | null;
  /** Programme une écriture locale (debounce trailing). */
  schedule: (state: TemplateDraftState) => void;
  /** Écrit immédiatement l'état fourni (blur / changement d'onglet). */
  flush: (state: TemplateDraftState) => void;
  /** Tranche la restauration (acceptée OU refusée) → reprend l'autosave. */
  restoreResolved: () => void;
  /** Supprime le brouillon (refus de restauration OU enregistrement réussi). */
  discardDraft: () => void;
};

export function useTemplateDraft(opts: {
  templateId: string;
  current: TemplateDraftState;
  /** `updatedAt` du template côté serveur (ISO) — départage brouillon vs serveur. */
  serverUpdatedAt: string;
  debounceMs?: number;
  ttlMs?: number;
  storage?: DraftStorage;
  now?: () => number;
}): TemplateDraft {
  const {
    templateId,
    current,
    serverUpdatedAt,
    debounceMs = 1000,
    ttlMs = TEMPLATE_DRAFT_TTL_MS,
    storage,
    now,
  } = opts;

  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<
    { data: TemplateDraftState; savedAt: string } | null
  >(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suspendedRef = useRef(false);
  const key = templateDraftKey(templateId);

  // Refs pour des callbacks stables (l'identité ne change pas à chaque frappe).
  const cfgRef = useRef({ storage, now, key, ttlMs });
  cfgRef.current = { storage, now, key, ttlMs };

  const getStorage = useCallback((): DraftStorage | null => {
    const s = cfgRef.current.storage;
    if (s) return s;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }, []);

  const nowMs = useCallback((): number => (cfgRef.current.now ? cfgRef.current.now() : Date.now()), []);

  const write = useCallback(
    (state: TemplateDraftState) => {
      const s = getStorage();
      if (!s) return;
      const at = new Date(nowMs()).toISOString();
      const rec: TemplateDraftRecord = { v: TEMPLATE_DRAFT_SCHEMA_VERSION, savedAt: at, data: state };
      try {
        s.setItem(cfgRef.current.key, JSON.stringify(rec));
        setSavedAt(at);
        setStatus('saved');
      } catch {
        /* quota / mode privé : on n'interrompt jamais la frappe */
      }
    },
    [getStorage, nowMs],
  );

  const schedule = useCallback(
    (state: TemplateDraftState) => {
      if (suspendedRef.current) return; // restauration non tranchée → ne pas écraser
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => write(state), debounceMs);
    },
    [write, debounceMs],
  );

  const flush = useCallback(
    (state: TemplateDraftState) => {
      if (suspendedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      write(state);
    },
    [write],
  );

  const discardDraft = useCallback(() => {
    const s = getStorage();
    try {
      s?.removeItem(cfgRef.current.key);
    } catch {
      /* ignore */
    }
    suspendedRef.current = false;
    setPendingRestore(null);
  }, [getStorage]);

  const restoreResolved = useCallback(() => {
    suspendedRef.current = false;
    setPendingRestore(null);
  }, []);

  // Au montage : décide si un brouillon est restaurable (existe + frais + format
  // courant + DIVERGENT du serveur + plus récent que le serveur). Sinon purge.
  // Tant qu'une restauration est proposée, l'autosave est suspendu.
  useEffect(() => {
    const s = getStorage();
    if (!s) return;
    let raw: string | null = null;
    try {
      raw = s.getItem(key);
    } catch {
      return;
    }
    if (!raw) return;

    const purge = () => {
      try {
        s.removeItem(key);
      } catch {
        /* ignore */
      }
    };

    let rec: TemplateDraftRecord;
    try {
      rec = JSON.parse(raw) as TemplateDraftRecord;
    } catch {
      purge(); // corrompu
      return;
    }
    if (!rec || rec.v !== TEMPLATE_DRAFT_SCHEMA_VERSION || !rec.data) {
      purge(); // ancien format
      return;
    }
    const savedMs = new Date(rec.savedAt).getTime();
    if (!Number.isFinite(savedMs) || nowMs() - savedMs > cfgRef.current.ttlMs) {
      purge(); // expiré
      return;
    }
    if (sameState(rec.data, current)) {
      purge(); // identique au serveur → inutile
      return;
    }
    if (savedMs <= new Date(serverUpdatedAt).getTime()) {
      purge(); // le serveur a été mis à jour APRÈS ce brouillon → périmé
      return;
    }
    suspendedRef.current = true;
    setPendingRestore({ data: rec.data, savedAt: rec.savedAt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nettoyage du timer au démontage.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { status, savedAt, pendingRestore, schedule, flush, restoreResolved, discardDraft };
}
