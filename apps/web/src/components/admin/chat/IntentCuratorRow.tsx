'use client';

/**
 * CHA-230 Phase 3.3 — Bouton "Tag manuel" pour la page intent-curator.
 *
 * Pour un message user donné, ouvre un sélecteur d'intent (dropdown
 * inline ; pas de modal pour rester accessible et keyboardable) et
 * envoie un POST `/api/admin/chat/intent-curator/[messageId]`.
 *
 * Idempotence côté serveur : si le message est déjà tagué (409), on
 * affiche l'état "déjà tagué" et on propose un bouton "Retirer" qui
 * fait un DELETE.
 *
 * Ce composant est volontairement self-contained (pas de Zustand, pas
 * de SWR) — un seul fetch par interaction, et `router.refresh()` après
 * succès pour que la page Server Component se réhydrate avec l'état
 * à jour (le badge "déjà tagué" passe en vert, par exemple).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { IntentTag } from '@/lib/chat/schemas/intent';

interface Props {
  messageId: string;
  /** `true` si une entrée golden existe déjà pour ce message. */
  alreadyTagged: boolean;
  /** Intent actuellement détecté (regex/llm) — utilisé comme valeur par défaut. */
  detectedIntent: IntentTag | null;
  /** Liste des intents disponibles (alimentée par `intentEnumSchema.options`). */
  intents: readonly IntentTag[];
}

export function IntentCuratorRow({
  messageId,
  alreadyTagged,
  detectedIntent,
  intents,
}: Props): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<IntentTag>(detectedIntent ?? 'misc');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tagged, setTagged] = useState(alreadyTagged);
  const [pending, startTransition] = useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/chat/intent-curator/${encodeURIComponent(messageId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedIntent: intent,
            notes: notes.trim() ? notes.trim() : undefined,
          }),
        },
      );
      if (res.ok) {
        setTagged(true);
        setOpen(false);
        setNotes('');
        router.refresh();
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (res.status === 409) {
        setTagged(true);
        setError(null);
        setOpen(false);
        return;
      }
      setError(payload.message ?? payload.error ?? `HTTP ${res.status}`);
    });
  }

  function untag(): void {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/chat/intent-curator/${encodeURIComponent(messageId)}`,
        { method: 'DELETE' },
      );
      if (res.ok || res.status === 404) {
        setTagged(false);
        router.refresh();
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      setError(payload.message ?? payload.error ?? `HTTP ${res.status}`);
    });
  }

  if (tagged && !open) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
          <span aria-hidden>✓</span>
          Golden
        </span>
        <button
          type="button"
          onClick={untag}
          disabled={pending}
          className="self-start text-[11px] text-rose-700 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {pending ? '…' : 'Retirer'}
        </button>
        {error && (
          <p role="alert" className="text-[11px] text-rose-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
        >
          Tag manuel
        </button>
        {error && (
          <p role="alert" className="text-[11px] text-rose-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-stone-200 bg-stone-50 p-2">
      <label className="flex flex-col gap-0.5 text-[11px] text-stone-700">
        <span className="font-medium">Intent attendu</span>
        <select
          value={intent}
          onChange={(e) => setIntent(e.target.value as IntentTag)}
          className="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-xs"
        >
          {intents.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[11px] text-stone-700">
        <span className="font-medium">Notes (optionnel)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="ex. ambigu — mention prix sans demande explicite"
          className="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-xs"
        />
      </label>
      <div className="mt-0.5 flex gap-1">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-stone-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pending ? 'Envoi…' : 'Confirmer'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
