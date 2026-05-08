/**
 * CHA-065 — Store Zustand pour le chat widget.
 *
 * État côté client : ouverture du panel, langue détectée, messages
 * (concaténation streamée), statut envoi. Persistance via
 * `localStorage` pour mémoriser que le widget a été ouvert (et
 * conserver `sessionId` à travers les rechargements).
 */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type {
  ChatLanguage,
  ChatLeadTriggerReason,
  ChatMessageDto,
} from '@/lib/chat/contracts';

interface ChatPersistedState {
  sessionId: string | null;
  language: ChatLanguage;
  hasInteracted: boolean;
  /** Persisted to avoid re-offering across reloads in the same session. */
  leadOfferDismissedSessionId: string | null;
  leadCapturedSessionId: string | null;
}

// CHA-212 — État du formulaire lead, volatil (pas persisté côté UI active).
export interface LeadOfferState {
  status: 'idle' | 'offered' | 'open' | 'submitting' | 'success' | 'error';
  triggeringMessageId: string | null;
  reason: ChatLeadTriggerReason | null;
  copyKey: string | null;
  errorMessage: string | null;
  successMessage: string | null;
}

interface ChatVolatileState {
  isOpen: boolean;
  isStreaming: boolean;
  messages: ChatMessageDto[];
  pendingAssistantId: string | null;
  error: string | null;
  greeting: string;
  suggestions: string[];
  leadOffer: LeadOfferState;
}

interface ChatActions {
  open(): void;
  close(): void;
  toggle(): void;
  setLanguage(lang: ChatLanguage): void;
  setSession(snapshot: {
    sessionId: string;
    language: ChatLanguage;
    greeting: string;
    suggestions: string[];
    messages: ChatMessageDto[];
  }): void;
  beginStreaming(messageId: string): void;
  appendDelta(messageId: string, delta: string): void;
  setSources(
    messageId: string,
    sources: NonNullable<ChatMessageDto['sources']>,
  ): void;
  endStreaming(messageId: string): void;
  pushUserMessage(message: ChatMessageDto): void;
  setError(message: string | null): void;
  // CHA-212 — Actions formulaire lead.
  receiveLeadOffer(payload: {
    messageId: string;
    reason: ChatLeadTriggerReason;
    copyKey: string;
  }): void;
  openLeadForm(): void;
  dismissLeadForm(reason?: string): void;
  setLeadFormSubmitting(): void;
  setLeadFormSuccess(message: string): void;
  setLeadFormError(message: string): void;
  reset(): void;
}

type ChatState = ChatPersistedState & ChatVolatileState & ChatActions;

const initialLeadOffer: LeadOfferState = {
  status: 'idle',
  triggeringMessageId: null,
  reason: null,
  copyKey: null,
  errorMessage: null,
  successMessage: null,
};

/**
 * CHA-229 — Raisons « fortes » qui passent outre un précédent `dismiss`.
 *
 * Sémantique :
 *   - `explicit-request` : la visiteuse a demandé explicitement à parler à
 *     un humain (« je veux qu'on m'appelle »).
 *   - `purchase-intent` : intention d'achat claire (« je veux commander »).
 *   - `inline-contact`  : la visiteuse a déjà tapé son numéro dans le chat —
 *     refuser de réafficher la bulle ferait perdre un lead chaud côté UI
 *     (le lead anonyme côté DB est déjà créé en parallèle, cf.
 *     `orchestrator.ts` §"Filet de sécurité commerciale").
 *   - `manual` : déclenchement explicite (jamais bloqué).
 *
 * Les autres raisons (`frustration`, `after-hours`, `out-of-knowledge`,
 * `objection-repeat`, `long-no-progress`, `b2b`) sont des heuristiques
 * « soft » : si la visiteuse a déjà fermé une fois la bulle, on respecte
 * son choix pour le reste de la session — pas de spam.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §6.2 (« Re-offre après
 * dismiss »).
 */
const STRONG_LEAD_REASONS: ReadonlySet<ChatLeadTriggerReason> = new Set([
  'explicit-request',
  'purchase-intent',
  'inline-contact',
  'manual',
]);

const initial: ChatPersistedState & ChatVolatileState = {
  sessionId: null,
  language: 'fr',
  hasInteracted: false,
  leadOfferDismissedSessionId: null,
  leadCapturedSessionId: null,
  isOpen: false,
  isStreaming: false,
  messages: [],
  pendingAssistantId: null,
  error: null,
  greeting: '',
  suggestions: [],
  leadOffer: initialLeadOffer,
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      ...initial,
      open: () => set({ isOpen: true, hasInteracted: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set({ isOpen: !get().isOpen, hasInteracted: true }),
      setLanguage: (language) => set({ language }),
      setSession: ({ sessionId, language, greeting, suggestions, messages }) =>
        set({ sessionId, language, greeting, suggestions, messages }),
      beginStreaming: (messageId) =>
        set((s) => ({
          isStreaming: true,
          pendingAssistantId: messageId,
          messages: [
            ...s.messages,
            {
              id: messageId,
              role: 'assistant',
              content: '',
              language: s.language,
              status: 'streaming',
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      appendDelta: (messageId, delta) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, content: m.content + delta } : m,
          ),
        })),
      setSources: (messageId, sources) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, sources } : m,
          ),
        })),
      endStreaming: (messageId) =>
        set((s) => ({
          isStreaming: false,
          pendingAssistantId: null,
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, status: 'sent' } : m,
          ),
        })),
      pushUserMessage: (m) =>
        set((s) => ({ messages: [...s.messages, m], hasInteracted: true })),
      setError: (error) => set({ error }),
      // CHA-212 / CHA-229 — Lead form actions.
      receiveLeadOffer: ({ messageId, reason, copyKey }) =>
        set((s) => {
          // Lead déjà capturé : on n'embête plus jamais la visiteuse.
          if (s.leadCapturedSessionId === s.sessionId) return {};
          // Bulle déjà refusée pour cette session : on respecte le choix
          // SAUF pour une intention forte arrivant *après* le dismiss
          // (achat explicite, demande humain, numéro tapé en clair) — sinon
          // on rate la conversion exactement au moment où elle est mûre.
          const dismissed =
            s.leadOfferDismissedSessionId === s.sessionId &&
            !STRONG_LEAD_REASONS.has(reason);
          if (dismissed) return {};
          return {
            // Si la précédente offre avait été dismiss, on remet la jauge
            // à zéro côté UI (le flag persistant `leadOfferDismissedSessionId`
            // est volontairement conservé : si la visiteuse re-dismiss cette
            // bulle « forte », les *soft* suivantes restent bloquées).
            leadOffer: {
              status: 'offered',
              triggeringMessageId: messageId,
              reason,
              copyKey,
              errorMessage: null,
              successMessage: null,
            },
          };
        }),
      openLeadForm: () =>
        set((s) => ({
          leadOffer: { ...s.leadOffer, status: 'open' },
        })),
      dismissLeadForm: (_reason?: string) =>
        set((s) => ({
          leadOffer: { ...initialLeadOffer, status: 'idle' },
          leadOfferDismissedSessionId: s.sessionId,
        })),
      setLeadFormSubmitting: () =>
        set((s) => ({
          leadOffer: { ...s.leadOffer, status: 'submitting', errorMessage: null },
        })),
      setLeadFormSuccess: (message) =>
        set((s) => ({
          leadOffer: {
            ...s.leadOffer,
            status: 'success',
            successMessage: message,
            errorMessage: null,
          },
          leadCapturedSessionId: s.sessionId,
        })),
      setLeadFormError: (message) =>
        set((s) => ({
          leadOffer: { ...s.leadOffer, status: 'error', errorMessage: message },
        })),
      reset: () => set(initial),
    }),
    {
      name: 'femiglow-chat',
      storage: createJSONStorage(() => localStorage),
      partialize: (s): ChatPersistedState => ({
        sessionId: s.sessionId,
        language: s.language,
        hasInteracted: s.hasInteracted,
        leadOfferDismissedSessionId: s.leadOfferDismissedSessionId,
        leadCapturedSessionId: s.leadCapturedSessionId,
      }),
    },
  ),
);
