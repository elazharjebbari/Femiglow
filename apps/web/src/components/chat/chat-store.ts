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

// CHA-231 (gap 2) — Buffer pour les offres reçues alors que la
// précédente n'est pas encore traitée. Si une nouvelle offre arrive
// pendant que l'utilisateur a le formulaire `open`/`submitting`, on
// la met en attente plutôt que de l'écraser. Promue à `leadOffer`
// quand l'état se libère (dismissal, success).
export interface PendingLeadOffer {
  triggeringMessageId: string;
  reason: ChatLeadTriggerReason;
  copyKey: string;
  force: boolean;
  receivedAt: string;
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
  // CHA-231 (gap 2) — Offre en attente quand l'UI est occupée.
  pendingLeadOffer: PendingLeadOffer | null;
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
    /** CHA-231 (gap 3) — Force le bypass de la dismissal session. */
    force?: boolean;
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
  pendingLeadOffer: null,
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
      // CHA-231 (gap 2 + 3) — Logique de réception ré-écrite :
      //   1. Si lead déjà capturé pour la session → ignore (success final).
      //   2. Si user a dismissé ET `force !== true` → ignore.
      //   3. Si l'offer courante est ACTIVE (status=open|submitting) →
      //      buffer dans `pendingLeadOffer` (sera promue après dismiss/success).
      //   4. Sinon (idle ou offered passive) → écrase avec la nouvelle.
      receiveLeadOffer: ({ messageId, reason, copyKey, force = false }) =>
        set((s) => {
          // 1. Lead déjà soumis avec succès → on n'ouvre plus.
          if (s.leadCapturedSessionId === s.sessionId) return {};
          // 2. Dismissal session sticky — bypassable par `force`.
          if (s.leadOfferDismissedSessionId === s.sessionId && !force) return {};
          // 3. Buffer si UI active (l'utilisateur est en train de remplir).
          //    On évite d'écraser ses inputs — on stockera la dernière offre
          //    reçue pour la promouvoir dès que le formulaire se libère.
          if (s.leadOffer.status === 'open' || s.leadOffer.status === 'submitting') {
            return {
              pendingLeadOffer: {
                triggeringMessageId: messageId,
                reason,
                copyKey,
                force,
                receivedAt: new Date().toISOString(),
              },
            };
          }
          // 4. État idle / offered passif / error → on remplace.
          //    Si `force=true` et user avait dismissé, on RÉINITIALISE
          //    `leadOfferDismissedSessionId` pour ne pas re-bloquer la
          //    prochaine offre passive.
          return {
            leadOffer: {
              status: 'offered',
              triggeringMessageId: messageId,
              reason,
              copyKey,
              errorMessage: null,
              successMessage: null,
            },
            leadOfferDismissedSessionId: force ? null : s.leadOfferDismissedSessionId,
            pendingLeadOffer: null,
          };
        }),
      openLeadForm: () =>
        set((s) => ({
          leadOffer: { ...s.leadOffer, status: 'open' },
        })),
      dismissLeadForm: (_reason?: string) =>
        set((s) => {
          // CHA-231 (gap 2) — Si une offre était bufferée, on la promeut
          // après dismissal (l'utilisateur a refusé l'ancienne, mais on
          // peut lui re-proposer la nouvelle qui a un trigger différent).
          if (s.pendingLeadOffer) {
            const p = s.pendingLeadOffer;
            return {
              leadOffer: {
                status: 'offered',
                triggeringMessageId: p.triggeringMessageId,
                reason: p.reason,
                copyKey: p.copyKey,
                errorMessage: null,
                successMessage: null,
              },
              pendingLeadOffer: null,
              // Le buffer p.force déclenche aussi le bypass.
              leadOfferDismissedSessionId: p.force ? null : s.sessionId,
            };
          }
          return {
            leadOffer: { ...initialLeadOffer, status: 'idle' },
            leadOfferDismissedSessionId: s.sessionId,
          };
        }),
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
          // CHA-231 (gap 2) — Lead capturé : tout buffer en attente est
          // obsolète (success est terminal pour la session).
          pendingLeadOffer: null,
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
