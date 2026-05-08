/**
 * CHA-229 — Fenêtre rapide pour consulter la conversation rattachée à un lead.
 *
 * Pourquoi ce composant existe :
 *   `/admin/leads` (vue unifiée ecommerce + chat) et `/admin/chat/leads`
 *   listent des leads sans contexte conversationnel. Pour traiter le lead
 *   à froid, l'admin avait deux options coûteuses :
 *     1. ouvrir l'onglet « Conversations » et chercher manuellement la
 *        session (mauvais : c'est un identifiant `cs_…` opaque) ;
 *     2. cliquer sur le lien « session » qui charge la page de détail
 *        full-fat (events + RAG hits + sources) — perte de contexte sur
 *        la liste des leads.
 *   Cette QuickView est un **drawer** qui charge à la demande un payload
 *   léger (`/api/admin/chat/sessions/[id]/messages`) et affiche les
 *   messages dans une popup. L'admin ne quitte pas la liste.
 *
 * Garanties :
 *   - Fetch **lazy** : aucun appel HTTP avant que l'utilisateur clique.
 *   - Auth admin : la route le vérifie ; ici on se contente d'afficher
 *     proprement les erreurs 401/403/404.
 *   - Accessibilité : `role="dialog"`, `aria-modal`, `Escape` ferme,
 *     focus initial sur le bouton de fermeture, body-scroll lock.
 *   - Pas de regression de perfs sur la liste : composant client isolé,
 *     pas de hydration de payload côté serveur.
 *
 * cf. `apps/web/src/app/api/admin/chat/sessions/[id]/messages/route.ts`
 *     pour le contrat de réponse.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface AdminConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  language: string | null;
  status: 'pending' | 'streaming' | 'sent' | 'error' | 'deleted';
  createdAt: string;
  latencyMs: number | null;
  modelName: string | null;
}

interface AdminConversationPayload {
  session: {
    id: string;
    language: string;
    status: string;
    openedAt: string;
  };
  messages: AdminConversationMessage[];
}

interface Props {
  /** ID `cs_…` de la session de chat à charger. */
  sessionId: string;
  /** Libellé affiché sur le bouton de déclenchement. */
  triggerLabel?: string;
  /** Sous-libellé optionnel (prénom du lead, par ex.). */
  subtitle?: string | null;
  /** Classe utilitaire pour customiser le bouton de déclenchement. */
  triggerClassName?: string;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; payload: AdminConversationPayload };

export function ConversationQuickView({
  sessionId,
  triggerLabel = 'Conversation',
  subtitle = null,
  triggerClassName,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(
        `/api/admin/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
        { headers: { accept: 'application/json' } },
      );
      if (!res.ok) {
        if (res.status === 404) {
          setState({ kind: 'error', message: 'Session introuvable.' });
          return;
        }
        if (res.status === 401 || res.status === 403) {
          setState({
            kind: 'error',
            message: 'Session admin expirée — recharge la page.',
          });
          return;
        }
        setState({
          kind: 'error',
          message: `Erreur HTTP ${res.status}.`,
        });
        return;
      }
      const payload = (await res.json()) as AdminConversationPayload;
      setState({ kind: 'ready', payload });
    } catch (err) {
      setState({
        kind: 'error',
        message: (err as Error).message ?? 'Erreur réseau.',
      });
    }
  }, [sessionId]);

  // Body-scroll lock + focus initial + Escape pour fermer.
  useEffect(() => {
    if (!open) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => closeBtnRef.current?.focus(), 30);

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    // On ne re-fetch pas si on a déjà un payload (toggle rapide
    // ouvert/fermé). L'admin peut cliquer « Recharger » dans l'erreur.
    if (state.kind === 'idle' || state.kind === 'error') {
      void load();
    }
  }, [state.kind, load]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          triggerClassName ??
          'inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:border-stone-400 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1'
        }
        aria-haspopup="dialog"
        data-testid="quickview-trigger"
      >
        {triggerLabel}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Conversation ${sessionId}`}
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-stone-900/40 backdrop-blur-sm"
          data-testid="quickview-dialog"
        >
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <aside
            className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
            data-testid="quickview-panel"
          >
            <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900">
                  Conversation
                </p>
                <p className="truncate font-mono text-xs text-stone-500">
                  {sessionId}
                </p>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-stone-600">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/admin/chat/conversations/${encodeURIComponent(sessionId)}`}
                  className="text-xs text-stone-600 underline-offset-2 hover:underline"
                >
                  Détail complet
                </a>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:border-stone-400 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                  aria-label="Fermer"
                  data-testid="quickview-close"
                >
                  Fermer
                  <kbd className="ml-1.5 rounded border border-stone-300 bg-stone-50 px-1 font-mono text-[10px] text-stone-500">
                    Esc
                  </kbd>
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto px-5 py-4">
              <Body state={state} onRetry={load} />
            </main>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function Body({
  state,
  onRetry,
}: {
  state: LoadState;
  onRetry: () => void;
}): JSX.Element {
  if (state.kind === 'idle') {
    return (
      <p className="text-sm text-stone-500">Chargement de la conversation…</p>
    );
  }
  if (state.kind === 'loading') {
    return (
      <p
        className="text-sm text-stone-500"
        role="status"
        aria-live="polite"
      >
        Chargement de la conversation…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <div
        role="alert"
        className="space-y-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
      >
        <p>{state.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
        >
          Réessayer
        </button>
      </div>
    );
  }
  const { session, messages } = state.payload;
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        {session.language.toUpperCase()} · {session.status} · ouverte le{' '}
        {session.openedAt.slice(0, 16).replace('T', ' ')} ·{' '}
        {messages.length} message{messages.length === 1 ? '' : 's'}
      </p>
      {messages.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
          Aucun message visible pour cette session.
        </p>
      ) : (
        <ol className="space-y-2" aria-label="Messages de la conversation">
          {messages.map((m) => (
            <li
              key={m.id}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-lg bg-stone-900 px-3 py-2 text-sm text-white'
                  : 'mr-auto max-w-[85%] rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-900'
              }
              data-testid={`quickview-msg-${m.role}`}
            >
              <div className="mb-1 text-[10px] uppercase opacity-70">
                {m.role}
                {m.modelName ? ` · ${m.modelName}` : ''}
                {m.latencyMs ? ` · ${m.latencyMs} ms` : ''}
              </div>
              <div className="whitespace-pre-wrap break-words">
                {m.content}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
