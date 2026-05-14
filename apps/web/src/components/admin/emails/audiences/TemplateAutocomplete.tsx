'use client';

/**
 * TemplateAutocomplete — datalist HTML5 sur tous les templates emails
 * (système + custom). Cache mémoire module.
 */
import { useEffect, useState } from 'react';

interface TemplateEntry {
  slug: string;
  name: string;
  source: 'system' | 'custom';
}

interface Props {
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  className?: string;
}

let cache: TemplateEntry[] | null = null;
let inFlight: Promise<TemplateEntry[]> | null = null;

async function loadTemplates(): Promise<TemplateEntry[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/admin/emails/templates/autocomplete', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { templates: TemplateEntry[] };
      cache = data.templates;
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

const LIST_ID = 'fg-email-templates-datalist';

export function TemplateAutocomplete({
  value,
  onChange,
  placeholder = 'welcome',
  className = 'w-40 rounded border border-stone-300 px-2 py-1 text-sm',
}: Props) {
  const [list, setList] = useState<TemplateEntry[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setList(cache);
      return;
    }
    let cancelled = false;
    loadTemplates().then((items) => {
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
          <option key={`${t.source}-${t.slug}`} value={t.slug}>
            {t.name}
            {t.source === 'custom' ? ' (custom)' : ''}
          </option>
        ))}
      </datalist>
    </>
  );
}
