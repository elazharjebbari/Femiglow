'use client';

/**
 * CommandPalette — cmdk-based palette pour le cockpit transactional (M5.1.4).
 *
 * Layout :
 *   ⌘K   [input filter / search ...]
 *   ────────────────────────────────
 *   🔍 Filtres (suggestions key:value)
 *   💾 Saved views (système + custom)
 *   ⚡ Actions (sur la sélection courante)
 *
 * Comportement :
 *   - ⌘K / Ctrl+K ouvre depuis n'importe où dans la page parent
 *   - Esc ferme, ↑/↓ navigue, Enter applique
 *   - Live parsing du buffer via parseFilters
 *   - On apply : appelle onApply({ filters, freetext, errors })
 *
 * Cf. docs/emailing/admin-evolution/03-frontend/04-cmd-k-palette.md
 *    docs/emailing/admin-evolution/04-ui-ux/01-wizard-spec-master.md §1.3
 */
import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import {
  OUTBOX_STATUSES,
  parseFilters,
  type ParseResult,
} from '@/lib/mail/transactional/filters-parser';

export type SavedView = {
  id: string;
  name: string;
  isSystem: boolean;
};

export type PaletteAction =
  | { id: 'retry'; label: string }
  | { id: 'suppress'; label: string }
  | { id: 'export'; label: string }
  | { id: 'save-view'; label: string };

export type CommandPaletteProps = {
  /** Vues sauvegardées pour le scope courant (sidebar list). */
  savedViews?: SavedView[];
  /** Actions disponibles selon le contexte (sélection, etc.). */
  actions?: PaletteAction[];
  /** Appelée quand l'admin applique les filtres (Enter sur le champ). */
  onApply?: (result: ParseResult) => void;
  /** Appelée quand l'admin sélectionne une view. */
  onSelectView?: (viewId: string) => void;
  /** Appelée quand l'admin sélectionne une action (save-view, retry…). */
  onAction?: (actionId: PaletteAction['id']) => void;
  /** Pre-fill (lors du re-open depuis URL state). */
  initialValue?: string;
};

const STATUS_HINTS: ReadonlyArray<{ value: string; label: string }> = OUTBOX_STATUSES.map((s) => ({
  value: s,
  label: s.replace(/_/g, ' '),
}));

/**
 * Hook ⌘K toggling — open quand Cmd/Ctrl+K, close on Esc.
 * Géré dans le composant pour ne pas dépendre du parent.
 */
function useCmdKShortcut(setOpen: (b: boolean) => void): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}

export function CommandPalette({
  savedViews = [],
  actions = [],
  onApply,
  onSelectView,
  onAction,
  initialValue = '',
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);

  useCmdKShortcut(setOpen);

  const parsed = useMemo(() => parseFilters(value), [value]);
  const hasErrors = parsed.errors.length > 0;
  const lastSegment = value.split(' ').pop() ?? '';
  const inStatusContext = /^status:/i.test(lastSegment);

  function handleApply() {
    onApply?.(parsed);
    setOpen(false);
  }

  function handleSelectView(viewId: string) {
    onSelectView?.(viewId);
    setOpen(false);
  }

  function handleAction(actionId: PaletteAction['id']) {
    onAction?.(actionId);
    setOpen(false);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      contentClassName="w-full max-w-2xl rounded-md border border-stone-200 bg-white shadow-2xl"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 -z-10 bg-stone-900/50"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <Command label="Command Menu" shouldFilter={false}>
        <div
          className={`flex items-center gap-2 border-b px-4 py-3 ${
            hasErrors ? 'border-red-300' : 'border-stone-200'
          }`}
        >
          <span className="font-mono text-xs text-stone-500">⌘K</span>
          <Command.Input
            value={value}
            onValueChange={setValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleApply();
              }
            }}
            placeholder="status:failed template:cart-* — Entrée pour appliquer"
            className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
            autoFocus
            aria-invalid={hasErrors}
          />
          {hasErrors && (
            <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
              {parsed.errors.length} erreur{parsed.errors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-stone-500">
            Aucune suggestion. Tape <code className="font-mono">status:</code>,{' '}
            <code className="font-mono">to:</code>, <code className="font-mono">template:</code>…
          </Command.Empty>

          {/* Suggestions contextuelles : si on tape "status:" → propose les valeurs */}
          {inStatusContext && (
            <Command.Group heading="Statuts" className="text-xs uppercase tracking-wider text-stone-500">
              {STATUS_HINTS.map((s) => (
                <Command.Item
                  key={s.value}
                  value={`status:${s.value}`}
                  onSelect={() => {
                    const parts = value.split(' ');
                    parts[parts.length - 1] = `status:${s.value}`;
                    setValue(parts.join(' ') + ' ');
                  }}
                  className="cursor-pointer rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50 data-[selected=true]:bg-sage-50"
                >
                  status:{s.value} <span className="ml-2 text-stone-400">— {s.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Filtres résolus actuellement (preview) */}
          {parsed.filters.length > 0 && (
            <Command.Group heading="Filtres résolus" className="mt-2 text-xs uppercase tracking-wider text-stone-500">
              {parsed.filters.map((f, idx) => (
                <Command.Item
                  key={idx}
                  value={`filter-${idx}-${f.key}`}
                  onSelect={handleApply}
                  className="cursor-pointer rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50 data-[selected=true]:bg-sage-50"
                >
                  <span className="font-mono text-xs text-stone-500">{f.key}:</span>{' '}
                  {f.key === 'status'
                    ? f.value.join(', ')
                    : f.key === 'after' || f.key === 'before'
                      ? f.value.toLocaleString('fr-FR')
                      : f.key === 'attempts'
                        ? `${f.operator}${f.value}`
                        : String(f.value)}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Erreurs de parsing */}
          {hasErrors && (
            <Command.Group heading="Erreurs" className="mt-2 text-xs uppercase tracking-wider text-red-500">
              {parsed.errors.map((err, idx) => (
                <Command.Item
                  key={idx}
                  value={`err-${idx}`}
                  className="cursor-default rounded px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 data-[selected=true]:bg-red-50"
                >
                  <code className="font-mono text-xs">{err.raw}</code> — {err.message}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Saved views */}
          {savedViews.length > 0 && (
            <Command.Group heading="Vues sauvegardées" className="mt-2 text-xs uppercase tracking-wider text-stone-500">
              {savedViews.map((v) => (
                <Command.Item
                  key={v.id}
                  value={`view-${v.id}-${v.name}`}
                  onSelect={() => handleSelectView(v.id)}
                  className="cursor-pointer rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50 data-[selected=true]:bg-sage-50"
                >
                  💾 {v.name}
                  {v.isSystem && <span className="ml-2 text-xs text-stone-400">système</span>}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <Command.Group heading="Actions" className="mt-2 text-xs uppercase tracking-wider text-stone-500">
              {actions.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`action-${a.id}`}
                  onSelect={() => handleAction(a.id)}
                  className="cursor-pointer rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50 data-[selected=true]:bg-sage-50"
                >
                  ⚡ {a.label}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span>
            <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono">↵</kbd> appliquer
            &nbsp;·&nbsp;
            <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono">Esc</kbd> fermer
          </span>
          <span>{parsed.filters.length} filtre{parsed.filters.length > 1 ? 's' : ''}</span>
        </div>
      </Command>
    </Command.Dialog>
  );
}
