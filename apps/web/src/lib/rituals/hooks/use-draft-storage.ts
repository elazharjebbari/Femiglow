'use client';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ritual-draft-v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DraftPayload {
  body: string;
  wouldRecommend: 'oui' | 'hesite' | 'non' | null;
  ritualTags: string[];
  authorFirstName: string;
  authorCity: string;
  initiatedSinceMonth: number | null;
  initiatedSinceYear: number | null;
  isAnonymous: boolean;
}

interface StoredDraft {
  payload: DraftPayload;
  timestamp: number;
}

export function useDraftStorage() {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDraft;
      if (Date.now() - parsed.timestamp > TTL_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setHasDraft(true);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const save = useCallback((payload: DraftPayload) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ payload, timestamp: Date.now() } as StoredDraft),
      );
      setHasDraft(true);
    } catch {
      // quota plein ou storage indispo : on ignore silencieusement
    }
  }, []);

  const restore = useCallback((): DraftPayload | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredDraft;
      if (Date.now() - parsed.timestamp > TTL_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed.payload;
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
    setHasDraft(false);
  }, []);

  return { hasDraft, save, restore, clear };
}
