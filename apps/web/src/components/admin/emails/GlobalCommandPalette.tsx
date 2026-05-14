'use client';

/**
 * GlobalCommandPalette (M5.6) — universal Cmd-K / Ctrl-K navigation across the
 * admin emails area.
 *
 * Self-contained : no cmdk dep. Provides fuzzy filter over a registry of
 * commands (routes + future actions). Keyboard nav with ↑↓ + enter ; Escape
 * closes ; click on backdrop closes.
 *
 * a11y :
 *  - role="dialog" + aria-modal + focus trap (focus moves into input on open)
 *  - role="listbox" + aria-activedescendant on the result list
 *  - aria-label on items
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigation' | 'Actions' | 'Recherche';
  href?: string;
  action?: () => void | Promise<void>;
};

const DEFAULT_COMMANDS: Command[] = [
  { id: 'nav-dashboard', label: 'Dashboard emails', group: 'Navigation', href: '/admin/emails' },
  { id: 'nav-transactional', label: 'Emails transactionnels', group: 'Navigation', href: '/admin/emails/transactional' },
  { id: 'nav-campaigns', label: 'Campagnes', group: 'Navigation', href: '/admin/emails/campaigns' },
  { id: 'nav-automation', label: 'Automatisations', group: 'Navigation', href: '/admin/emails/automation' },
  { id: 'nav-audiences', label: 'Audiences', group: 'Navigation', href: '/admin/emails/audiences' },
  { id: 'nav-templates', label: 'Templates HTML', group: 'Navigation', href: '/admin/emails/templates' },
  { id: 'nav-events', label: 'Events (debug)', group: 'Navigation', href: '/admin/emails/events' },
  { id: 'nav-listmonk', label: 'Listmonk (admin natif)', group: 'Navigation', href: '/admin/emails/listmonk' },
  { id: 'new-campaign', label: 'Nouvelle campagne', group: 'Actions', href: '/admin/emails/campaigns/new', hint: 'créer' },
  { id: 'new-automation', label: 'Nouvelle automation', group: 'Actions', href: '/admin/emails/automation/new', hint: 'créer' },
  { id: 'new-audience', label: 'Nouvelle audience', group: 'Actions', href: '/admin/emails/audiences/new', hint: 'créer' },
  { id: 'new-template', label: 'Nouveau template', group: 'Actions', href: '/admin/emails/templates/new', hint: 'créer' },
];

function fuzzy(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (h.includes(n)) return true;
  // subseq match
  let hi = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const c = n[ni];
    while (hi < h.length && h[hi] !== c) hi++;
    if (hi >= h.length) return false;
    hi++;
  }
  return true;
}

export function GlobalCommandPalette({
  extraCommands = [],
}: {
  extraCommands?: Command[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd-K / Ctrl-K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input on open + reset state
  useEffect(() => {
    if (open) {
      setQ('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const allCommands = useMemo(() => [...DEFAULT_COMMANDS, ...extraCommands], [extraCommands]);

  const filtered = useMemo(
    () => allCommands.filter((c) => fuzzy(`${c.label} ${c.hint ?? ''}`, q)),
    [allCommands, q],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Reset activeIdx if it overflows
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIdx]);

  const run = useCallback(
    async (c: Command) => {
      setOpen(false);
      if (c.href) router.push(c.href);
      else if (c.action) await c.action();
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = filtered[activeIdx];
      if (c) void run(c);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/30 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tapez pour chercher (Cmd-K)…"
          aria-label="Recherche commandes"
          aria-activedescendant={
            filtered[activeIdx] ? `cmd-${filtered[activeIdx].id}` : undefined
          }
          aria-controls="cmd-list"
          aria-autocomplete="list"
          className="w-full border-b border-stone-200 px-4 py-3 text-sm outline-none placeholder:text-stone-400"
        />
        <ul
          id="cmd-list"
          role="listbox"
          className="max-h-96 overflow-y-auto py-1"
          aria-label="Résultats"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-stone-500" role="status">
              Aucun résultat
            </li>
          ) : (
            grouped.map(([group, items]) => (
              <li key={group}>
                <p className="border-t border-stone-100 bg-stone-50 px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  {group}
                </p>
                <ul>
                  {items.map((c) => {
                    const flatIdx = filtered.indexOf(c);
                    const isActive = flatIdx === activeIdx;
                    return (
                      <li
                        key={c.id}
                        id={`cmd-${c.id}`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <button
                          type="button"
                          onClick={() => void run(c)}
                          onMouseEnter={() => setActiveIdx(flatIdx)}
                          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                            isActive ? 'bg-stone-100 text-stone-900' : 'text-stone-700'
                          }`}
                        >
                          <span>{c.label}</span>
                          {c.hint && (
                            <span className="text-[10px] uppercase tracking-wider text-stone-400">
                              {c.hint}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-stone-100 bg-stone-50 px-4 py-1.5 text-[10px] text-stone-500">
          ↑↓ naviguer · ↵ ouvrir · Esc fermer
        </div>
      </div>
    </div>
  );
}
