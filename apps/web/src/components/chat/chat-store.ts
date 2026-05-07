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

// CHA-230 Phase 2 — État d'erreur structuré pour permettre l'affichage
// d'un chip "Réessayer" quand l'erreur est transitoire (timeout, 5xx,
// rate-limit). Le `lastUserText` est conservé pour pouvoir le ré-envoyer
// en un clic sans saisie utilisateur.
export interface ChatErrorState {
  /** Code court (ex: 'timeout', 'rate-limit', 'auth', 'unknown'). */
  code: string;
  /** Message lisible affiché à l'utilisateur. */
  message: string | null;
  /** Si `true`, l'UI propose un chip "Réessayer". */
  retryable: boolean;
  /** Texte du dernier message user — re-envoyé par le chip. */
  lastUserText: string | null;
}

interface ChatVolatileState {
  isOpen: boolean;
  isStreaming: boolean;
  messages: ChatMessageDto[];
  pendingAssistantId: string | null;
  // CHA-230 Phase 2 — Structuré (était `string | null`).
  error: ChatErrorState | null;
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
  // CHA-230 Phase 2 — `null` clear l'erreur ; sinon payload complet.
  // Pas de surcharge string par mesure de simplicité (un seul shape).
  setError(error: ChatErrorState | null): void;
  /** CHA-230 Phase 2 — Clear l'erreur (équivaut à `setError(null)`). */
  clearError(): void;
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
      clearError: () => set({ error: null }),
      // CHA-212 — Lead form actions
      receiveLeadOffer: ({ messageId, reason, copyKey }) =>
        set((s) => {
          // Si déjà capturé ou rejeté pour cette session, on ignore.
          if (s.leadCapturedSessionId === s.sessionId) return {};
          if (s.leadOfferDismissedSessionId === s.sessionId) return {};
          return {
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
