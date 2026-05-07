/**
 * CHA-066 — Hook `useChatSession`.
 *
 * Charge la session via GET /api/chat/session au premier mount,
 * peuple le store. Idempotent : si déjà chargée, ne refait pas l'appel.
 */
'use client';

import { useEffect } from 'react';

import { useChatStore } from '../chat-store';
import type { ChatSessionSnapshot } from '@/lib/chat/contracts';

export function useChatSession(initialPage?: string): void {
  const sessionId = useChatStore((s) => s.sessionId);
  const setSession = useChatStore((s) => s.setSession);
  const setError = useChatStore((s) => s.setError);

  useEffect(() => {
    if (sessionId) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (initialPage) params.set('page', initialPage);
    fetch(`/api/chat/session${params.toString() ? `?${params.toString()}` : ''}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 404) {
          // Feature flag off — silencieux
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ChatSessionSnapshot;
      })
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        setSession({
          sessionId: snapshot.sessionId,
          language: snapshot.language,
          greeting: snapshot.greeting,
          suggestions: snapshot.suggestions,
          messages: snapshot.messages,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // CHA-230 Phase 2 — Erreur de chargement de session : non
        // retryable côté UI (le retry est déjà fait par useEffect au
        // remount). Pas de lastUserText (rien d'envoyé encore).
        setError({
          code: 'session-load-failed',
          message: (err as Error).message,
          retryable: false,
          lastUserText: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, initialPage, setSession, setError]);
}
