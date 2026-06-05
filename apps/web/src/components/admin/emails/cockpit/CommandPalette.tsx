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
import { useEffect, useMemo, useRef, useState } from 'react';
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

/** Suggestion d'entité affichée dans la palette (template/destinataire/source). */
type EntitySuggestion = { value: string; label: string; hint?: string };

/**
 * Contextes d'autocomplétion d'entité branchés sur les routes du socle FONDATION
 * (UX-COCKPIT-003). Avant : seul `status:` proposait des valeurs ; `template:`,
 * `to:`, `source:` étaient saisis à l'aveugle (le filtre exact non-glob échouait
 * silencieusement à un caractère près). Chaque contexte décrit comment
 * récupérer + mapper ses suggestions depuis la route prête mais non consommée.
 */
const ENTITY_CONTEXTS = {
  template: {
    regex: /^template:(.*)$/i,
    async fetch(q: string, signal: AbortSignal): Promise<EntitySuggestion[]> {
      const res = await fetch('/api/admin/emails/templates/autocomplete', {
        credentials: 'include',
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        templates: Array<{ slug: string; name: string; source: string }>;
      };
      const needle = q.toLowerCase();
      return data.templates
        .filter(
          (t) =>
            t.slug.toLowerCase().includes(needle) || t.name.toLowerCase().includes(needle),
        )
        .slice(0, 20)
        .map((t) => ({
          value: t.slug,
          label: t.slug,
          hint: t.source === 'system' ? 'système' : 'custom',
        }));
    },
  },
  to: {
    regex: /^to:(.*)$/i,
    async fetch(q: string, signal: AbortSignal): Promise<EntitySuggestion[]> {
      const res = await fetch(
        `/api/admin/emails/transactional/recipients-autocomplete?q=${encodeURIComponent(q)}`,
        { credentials: 'include', signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { recipients: string[] };
      return data.recipients.slice(0, 20).map((email) => ({ value: email, label: email }));
    },
  },
  source: {
    regex: /^source:(.*)$/i,
    async fetch(q: string, signal: AbortSignal): Promise<EntitySuggestion[]> {
      const res = await fetch(
        `/api/admin/emails/transactional/sources?q=${encodeURIComponent(q)}`,
        { credentials: 'include', signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sources: string[] };
      return data.sources.slice(0, 20).map((s) => ({ value: s, label: s }));
    },
  },
} as const;

type EntityContextKey = keyof typeof ENTITY_CONTEXTS;

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

  // ── Autocomplétion d'entité (UX-COCKPIT-003) ─────────────────────────
  // Détecte le contexte template:/to:/source: du dernier segment et récupère
  // ses suggestions depuis la route correspondante (debounce + AbortController :
  // le fetch précédent est annulé à chaque frappe → pas de suggestion fantôme).
  const entityContext = useMemo<{ key: EntityContextKey; prefix: string } | null>(() => {
    for (const key of Object.keys(ENTITY_CONTEXTS) as EntityContextKey[]) {
      const m = ENTITY_CONTEXTS[key].regex.exec(lastSegment);
      if (m) return { key, prefix: m[1] ?? '' };
    }
    return null;
  }, [lastSegment]);

  const [entitySuggestions, setEntitySuggestions] = useState<EntitySuggestion[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState(false);
  const entityAbortRef = useRef<AbortController | null>(null);
  const entitySeqRef = useRef(0);

  useEffect(() => {
    // Hors d'un contexte d'entité : on purge et on annule tout fetch en vol.
    if (!entityContext) {
      entityAbortRef.current?.abort();
      entitySeqRef.current++;
      setEntitySuggestions([]);
      setEntityLoading(false);
      setEntityError(false);
      return;
    }
    const ctx = ENTITY_CONTEXTS[entityContext.key];
    const prefix = entityContext.prefix;
    const seq = ++entitySeqRef.current;
    entityAbortRef.current?.abort();
    const controller = new AbortController();
    entityAbortRef.current = controller;
    setEntityLoading(true);
    setEntityError(false);

    const timer = setTimeout(() => {
      ctx
        .fetch(prefix, controller.signal)
        .then((opts) => {
          if (seq !== entitySeqRef.current) return;
          setEntitySuggestions(opts);
          setEntityError(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || seq !== entitySeqRef.current) return;
          void err;
          setEntitySuggestions([]);
          setEntityError(true);
        })
        .finally(() => {
          if (seq === entitySeqRef.current) setEntityLoading(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [entityContext]);

  /** Remplace le dernier segment par `<key>:<value>` (+ espace pour enchaîner). */
  function completeEntity(key: EntityContextKey, optValue: string) {
    const parts = value.split(' ');
    // Les valeurs avec espace sont impossibles ici (slug/email/source) ; pas de quote.
    parts[parts.length - 1] = `${key}:${optValue}`;
    setValue(parts.join(' ') + ' ');
  }

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

          {/* Suggestions d'entité (template / destinataire / source) — UX-COCKPIT-003 */}
          {entityContext && (
            <Command.Group
              heading={
                entityContext.key === 'template'
                  ? 'Templates'
                  : entityContext.key === 'to'
                    ? 'Destinataires'
                    : 'Sources'
              }
              className="text-xs uppercase tracking-wider text-stone-500"
            >
              {entityLoading && (
                <div
                  data-testid="palette-entity-loading"
                  role="status"
                  className="px-2 py-1.5 text-sm text-stone-400"
                >
                  Chargement des suggestions…
                </div>
              )}
              {!entityLoading && entityError && (
                <div
                  data-testid="palette-entity-error"
                  role="status"
                  className="px-2 py-1.5 text-sm text-rose-600"
                >
                  Suggestions indisponibles
                </div>
              )}
              {!entityLoading &&
                !entityError &&
                entitySuggestions.map((opt) => (
                  <Command.Item
                    key={`${entityContext.key}-${opt.value}`}
                    value={`${entityContext.key}:${opt.value}`}
                    onSelect={() => completeEntity(entityContext.key, opt.value)}
                    data-testid="palette-entity-option"
                    className="cursor-pointer rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50 data-[selected=true]:bg-sage-50"
                  >
                    {entityContext.key}:{opt.value}
                    {opt.hint ? <span className="ml-2 text-stone-400">— {opt.hint}</span> : null}
                  </Command.Item>
                ))}
              {!entityLoading && !entityError && entitySuggestions.length === 0 && (
                <div
                  data-testid="palette-entity-empty"
                  role="status"
                  className="px-2 py-1.5 text-sm text-stone-400"
                >
                  Aucun résultat
                </div>
              )}
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
