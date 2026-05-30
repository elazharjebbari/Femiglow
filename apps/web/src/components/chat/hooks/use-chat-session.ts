/**
 * CHA-066 — Hook `useChatSession`.
 *
 * Charge la session via GET /api/chat/session au mount du panel.
 *
 * Subtilité hydration (cf. bug 2026-05-13 « pills disparues après reload ») :
 * Zustand `persist` ne sauvegarde QUE `sessionId / language / hasInteracted /
 * leadOfferDismissedSessionId / leadCapturedSessionId` (cf. `partialize`).
 * Au reload, le store est rehydraté avec sessionId connu mais
 * `messages = [] / suggestions = []`. L'ancien guard `if (sessionId) return`
 * sautait alors la requête → pas de pills, pas d'historique → UX cassée.
 *
 * Nouveau contrat : on déclenche le fetch si on n'a pas encore d'identifiant
 * de session, OU si l'on a un sessionId rehydraté mais le snapshot client est
 * vide (pas de messages ni de suggestions). Pendant un stream actif on
 * s'abstient (le store contient déjà l'optimistic user + le bubble streamée).
 */
'use client';

import { useEffect } from 'react';

import { useChatStore } from '../chat-store';
import type { ChatSessionSnapshot } from '@/lib/chat/contracts';

export function useChatSession(initialPage?: string, lang?: string): void {
  const sessionId = useChatStore((s) => s.sessionId);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const hasSuggestions = useChatStore((s) => s.suggestions.length > 0);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const setSession = useChatStore((s) => s.setSession);
  const setError = useChatStore((s) => s.setError);

  useEffect(() => {
    // Déjà rempli côté client : pas besoin de re-fetch.
    if (sessionId && (hasMessages || hasSuggestions)) return;
    // Optimistic user en cours de stream : ne pas écraser le store.
    if (isStreaming) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (initialPage) params.set('page', initialPage);
    // Phase 9bis — propage la locale de la page pour que la session soit
    // créée/alignée dans la bonne langue (pills + greeting + réponses AR).
    if (lang) params.set('lang', lang);
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
        setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    hasMessages,
    hasSuggestions,
    isStreaming,
    initialPage,
    lang,
    setSession,
    setError,
  ]);
}
