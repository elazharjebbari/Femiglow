'use client';

/**
 * CHA-211b — Bouton "Importer depuis un fichier" pour les textareas admin.
 *
 * Permet de charger un fichier `.md` / `.markdown` / `.txt` depuis le poste
 * admin et de remplir directement la `<textarea>` cible. Pas d'envoi réseau,
 * pas de stockage : on lit le fichier côté navigateur via `FileReader`,
 * puis on l'injecte dans le DOM en déclenchant un évènement `input`/`change`
 * synthétique pour que React (state contrôlé) repique la valeur.
 *
 * Deux modes d'écriture :
 *   - `mode="replace"` (par défaut) : remplace tout le contenu actuel.
 *   - `mode="append"`               : ajoute à la fin (séparateur "\n\n").
 *
 * Usage côté admin :
 *   <textarea id="body" name="body" ... />
 *   <ImportFromFileButton targetId="body" label="Importer depuis un .md" />
 *
 * Limites :
 *   - taille max 200 KB (suffisant pour une instruction ou une fiche RAG).
 *   - extensions acceptées : .md, .markdown, .txt.
 *   - pas de validation de schéma (le serveur valide à la soumission).
 */
import { useId, useRef, useState } from 'react';

type Mode = 'replace' | 'append';

interface ImportFromFileButtonProps {
  /** `id` du textarea cible (doit exister dans le DOM au moment du clic). */
  targetId: string;
  /** Texte du bouton. */
  label?: string;
  /** Mode d'écriture (default `replace`). */
  mode?: Mode;
  /** Taille max en octets (default 200 000). */
  maxBytes?: number;
  /** Classe additionnelle. */
  className?: string;
}

const ACCEPTED = '.md,.markdown,.txt';

export function ImportFromFileButton({
  targetId,
  label = 'Importer un fichier',
  mode = 'replace',
  maxBytes = 200_000,
  className,
}: ImportFromFileButtonProps): React.ReactElement {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'ok'; name: string; size: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  function handlePick(): void {
    inputRef.current?.click();
  }

  function applyToTextarea(content: string): boolean {
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) {
      return false;
    }
    const next =
      mode === 'replace'
        ? content
        : target.value
          ? `${target.value.replace(/\s+$/, '')}\n\n${content}`
          : content;

    // Pour que React (textarea/input contrôlés) capte la nouvelle valeur,
    // on doit utiliser le setter natif puis dispatcher un évènement input.
    const proto =
      target instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(target, next);
    } else {
      target.value = next;
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Reset l'input pour permettre de réimporter le même fichier après édition.
    event.target.value = '';
    if (!file) {
      setStatus({ kind: 'idle' });
      return;
    }
    if (file.size > maxBytes) {
      setStatus({
        kind: 'error',
        message: `Fichier trop volumineux (${(file.size / 1024).toFixed(1)} KB > ${(maxBytes / 1024).toFixed(0)} KB).`,
      });
      return;
    }
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith('.md') &&
      !lower.endsWith('.markdown') &&
      !lower.endsWith('.txt')
    ) {
      setStatus({
        kind: 'error',
        message: 'Extension non supportée. Utilisez .md, .markdown ou .txt.',
      });
      return;
    }
    try {
      const text = await file.text();
      const ok = applyToTextarea(text);
      if (!ok) {
        setStatus({
          kind: 'error',
          message: `Impossible de trouver le champ cible (#${targetId}).`,
        });
        return;
      }
      setStatus({ kind: 'ok', name: file.name, size: file.size });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: (err as Error).message || 'Lecture du fichier impossible.',
      });
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFile}
          aria-label={label}
        />
        <button
          type="button"
          onClick={handlePick}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.61L6.97 9.07a.75.75 0 0 0-1.04 1.08l3.5 3.36a.75.75 0 0 0 1.04 0l3.5-3.36a.75.75 0 1 0-1.04-1.08L10.75 11.36V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.25 2.25 0 0 0 4.25 17.5h11.5A2.25 2.25 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75v-2.5Z" />
          </svg>
          {label}
        </button>
        <span className="text-[11px] text-stone-400">
          {mode === 'replace' ? 'remplace le contenu' : 'ajoute à la fin'} · .md, .txt
        </span>
      </div>
      {status.kind === 'ok' && (
        <p className="text-[11px] text-emerald-700" role="status">
          Fichier {status.name} chargé ({(status.size / 1024).toFixed(1)} KB).
        </p>
      )}
      {status.kind === 'error' && (
        <p className="text-[11px] text-rose-700" role="alert">
          {status.message}
        </p>
      )}
    </div>
  );
}
