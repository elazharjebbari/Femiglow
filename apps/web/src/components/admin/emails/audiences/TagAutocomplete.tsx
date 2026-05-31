'use client';

/**
 * TagAutocomplete — `<datalist>` HTML5 sur les tags distincts présents dans
 * lead_tag. Mémoize au niveau module. Si la DB n'a aucun tag, l'input reste
 * libre (l'utilisateur peut quand même taper un nouveau tag).
 */
import { useEffect, useState } from 'react';

interface TagEntry {
  tag: string;
  count: number;
}

interface Props {
  value: string;
  onChange: (tag: string) => void;
  placeholder?: string;
  className?: string;
}

let cache: TagEntry[] | null = null;
let inFlight: Promise<TagEntry[]> | null = null;

async function loadTags(): Promise<TagEntry[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/admin/leads/tags/autocomplete', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tags: TagEntry[] };
      cache = data.tags;
      return cache;
    } catch {
      cache = [];
      return cache;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

const LIST_ID = 'fg-tags-datalist';

export function TagAutocomplete({
  value,
  onChange,
  placeholder = 'vip',
  className = 'w-40 rounded border border-stone-300 px-2 py-1 text-sm',
}: Props) {
  const [list, setList] = useState<TagEntry[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setList(cache);
      return;
    }
    let cancelled = false;
    loadTags().then((items) => {
      if (!cancelled) setList(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <input
        type="text"
        list={LIST_ID}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <datalist id={LIST_ID}>
        {list.map((t) => (
          <option key={t.tag} value={t.tag}>
            {t.count} contact{t.count > 1 ? 's' : ''}
          </option>
        ))}
      </datalist>
    </>
  );
}
