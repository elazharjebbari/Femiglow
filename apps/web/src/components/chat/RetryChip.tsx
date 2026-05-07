/**
 * CHA-230 Phase 2 — `RetryChip`.
 *
 * Petit bouton-chip affiché sous un message d'erreur du chat quand
 * l'erreur est marquée `retryable: true` côté store. Permet à
 * l'utilisateur de re-déclencher l'envoi du dernier message en un
 * clic, sans avoir à le retaper dans le composeur.
 *
 * Comportement :
 *  1. Au clic, on lit `error.lastUserText` du store.
 *  2. On clear l'erreur via `clearError()`.
 *  3. On délègue à `useChatSend.send(text)` — qui ré-utilise la
 *     même logique d'envoi que la première fois (push user message,
 *     SSE, cadenceur, tracking).
 *
 * Accessibilité :
 *  - `<button type="button">` : focus / clavier OK.
 *  - `aria-label` localisé en FR (langue par défaut FemiGlow).
 *  - Visible sous l'alert `role=alert` ; conserve le contexte de
 *    l'erreur sans la masquer.
 *
 * Le composant N'EST RENDU QUE si `error.retryable === true` ET
 * `error.lastUserText` est non-null. Cas où le retry serait inutile
 * (auth, content-filter, charter-blocked) : pas de chip, l'utilisateur
 * voit seulement le message d'erreur.
 */
'use client';

import { useChatStore } from './chat-store';
import { useChatSend } from './hooks/use-chat-send';

const RETRY_COPY: Record<'fr' | 'ar' | 'ar-MA', { label: string; aria: string }> = {
  fr: { label: 'Réessayer', aria: 'Réessayer le dernier message' },
  ar: { label: 'إعادة المحاولة', aria: 'إعادة إرسال آخر رسالة' },
  'ar-MA': { label: 'عاود', aria: 'عاود صيفط آخر رسالة' },
};

export function RetryChip() {
  const error = useChatStore((s) => s.error);
  const language = useChatStore((s) => s.language);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const clearError = useChatStore((s) => s.clearError);
  const { send } = useChatSend();

  // Garde-fous : on ne rend rien si pas d'erreur OU pas retryable OU
  // pas de texte à réenvoyer. Cela rend le composant safe à mounter
  // partout : il décide lui-même s'il doit s'afficher.
  if (!error) return null;
  if (!error.retryable) return null;
  if (!error.lastUserText) return null;
  // Pendant un stream actif, on n'autorise pas de nouveau send : on
  // masque le chip pour éviter un double envoi confus.
  if (isStreaming) return null;

  const copy = RETRY_COPY[language] ?? RETRY_COPY.fr;
  const text = error.lastUserText;
  const isRtl = language === 'ar' || language === 'ar-MA';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="mt-2 flex"
      data-testid="chat-retry-chip-wrap"
    >
      <button
        type="button"
        onClick={() => {
          clearError();
          // `send` est déjà guardé contre concurrent calls (cf. hook).
          // On ne `await` pas — onClick handler reste sync pour l'UI.
          void send(text);
        }}
        aria-label={copy.aria}
        data-testid="chat-retry-chip"
        className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <RetryIcon />
        <span>{copy.label}</span>
      </button>
    </div>
  );
}

function RetryIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 8a6 6 0 1 1-1.76-4.24" />
      <path d="M14 2v3.5h-3.5" />
    </svg>
  );
}
