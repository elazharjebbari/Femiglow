'use client';

/**
 * SavedViewsSidebar — liste des vues système + custom dans le sidebar
 * gauche du cockpit transactional (M5.1.6).
 *
 * - Section "Système" : non éditable (is_system=true). Affichées en premier.
 * - Section "Mes vues" : own admin uniquement, avec menu 3-dots pour
 *   Renommer / Supprimer.
 * - Bouton "+ Nouvelle vue" déclenche `onCreate()`.
 *
 * Le composant est *présentationnel* : les data viennent du parent via props,
 * idem pour les actions destructives.
 */
import { useState } from 'react';

export type SidebarView = {
  id: string;
  name: string;
  isSystem: boolean;
  /**
   * État de filtres persisté de la vue (filters/sort/cols). Optionnel pour
   * compat ascendante ; quand présent, sélectionner la vue applique réellement
   * ces filtres au tableau (F-016, sinon highlight no-op).
   */
  filterState?: {
    filters?: Record<string, unknown>;
    sort?: string;
    cols?: string[];
  };
};

export type SavedViewsSidebarProps = {
  views: SidebarView[];
  activeViewId?: string | null;
  onSelect?: (viewId: string) => void;
  onCreate?: () => void;
  onRename?: (viewId: string, newName: string) => void;
  onDelete?: (viewId: string) => void;
};

export function SavedViewsSidebar({
  views,
  activeViewId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SavedViewsSidebarProps) {
  const systemViews = views.filter((v) => v.isSystem);
  const customViews = views.filter((v) => !v.isSystem);

  return (
    <aside
      aria-label="Vues sauvegardées"
      data-testid="saved-views-sidebar"
      className="w-56 shrink-0 border-r border-stone-200 bg-stone-50/50 px-3 py-4"
    >
      {/* Section système */}
      <ViewsSection
        heading="Vues système"
        views={systemViews}
        activeViewId={activeViewId}
        onSelect={onSelect}
        readOnly
      />

      {/* Section custom */}
      <div className="mt-6">
        <ViewsSection
          heading="Mes vues"
          views={customViews}
          activeViewId={activeViewId}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
        />
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            data-testid="create-view-btn"
            className="mt-2 w-full rounded px-2 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            + Nouvelle vue
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Section interne ─────────────────────────────────────────────────────

type SectionProps = {
  heading: string;
  views: SidebarView[];
  activeViewId?: string | null;
  onSelect?: (viewId: string) => void;
  onRename?: (viewId: string, newName: string) => void;
  onDelete?: (viewId: string) => void;
  readOnly?: boolean;
};

function ViewsSection({ heading, views, activeViewId, onSelect, onRename, onDelete, readOnly }: SectionProps) {
  if (views.length === 0 && readOnly) return null;

  return (
    <div>
      <h3 className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-stone-600">
        {heading}
      </h3>
      <ul className="space-y-0.5">
        {views.map((v) => (
          <ViewRow
            key={v.id}
            view={v}
            active={v.id === activeViewId}
            onSelect={onSelect}
            onRename={readOnly ? undefined : onRename}
            onDelete={readOnly ? undefined : onDelete}
          />
        ))}
        {views.length === 0 && !readOnly && (
          <li className="px-2 py-1 text-xs italic text-stone-600">Aucune vue personnalisée</li>
        )}
      </ul>
    </div>
  );
}

// ── Ligne de view (avec menu inline) ────────────────────────────────────

type ViewRowProps = {
  view: SidebarView;
  active: boolean;
  onSelect?: (viewId: string) => void;
  onRename?: (viewId: string, newName: string) => void;
  onDelete?: (viewId: string) => void;
};

function ViewRow({ view, active, onSelect, onRename, onDelete }: ViewRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(view.name);

  if (renaming) {
    return (
      <li>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setRenaming(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim().length > 0) {
              onRename?.(view.id, draft.trim());
              setRenaming(false);
            }
            if (e.key === 'Escape') {
              setDraft(view.name);
              setRenaming(false);
            }
          }}
          className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
          aria-label="Renommer la vue"
        />
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect?.(view.id)}
        data-testid={`view-${view.id}`}
        aria-current={active ? 'true' : undefined}
        className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm transition-colors ${
          active ? 'bg-sage-100 text-sage-900' : 'text-stone-700 hover:bg-stone-100'
        }`}
      >
        {view.name}
      </button>
      {(onRename || onDelete) && (
        <ViewRowMenu
          onRename={onRename ? () => setRenaming(true) : undefined}
          onDelete={onDelete ? () => onDelete(view.id) : undefined}
        />
      )}
    </li>
  );
}

function ViewRowMenu({ onRename, onDelete }: { onRename?: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Actions"
        className="rounded px-1 py-1 text-stone-500 hover:bg-stone-200"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-32 rounded border border-stone-200 bg-white shadow-md"
          onMouseLeave={() => setOpen(false)}
        >
          {onRename && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onRename();
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              Renommer
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-red-700 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
