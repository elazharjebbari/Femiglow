'use client';

/**
 * ProductAutocomplete — input avec `<datalist>` (HTML5 natif) pour piocher
 * un product slug parmi les produits FemiGlow.
 *
 * Fetch /api/admin/catalog/products/autocomplete au mount (200 max).
 * Fallback silencieux si DB indisponible : reste un input texte.
 */
import { useEffect, useState } from 'react';

interface Product {
  id: string;
  slug: string;
  title: string;
  status: string;
}

interface Props {
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  className?: string;
}

let cache: Product[] | null = null;
let inFlight: Promise<Product[]> | null = null;

async function loadProducts(): Promise<Product[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/admin/catalog/products/autocomplete', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { products: Product[] };
      cache = data.products;
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

const LIST_ID = 'fg-products-datalist';

export function ProductAutocomplete({
  value,
  onChange,
  placeholder = 'kit-eclat-v2',
  className = 'w-64 rounded border border-stone-300 px-2 py-1 text-sm',
}: Props) {
  const [list, setList] = useState<Product[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setList(cache);
      return;
    }
    let cancelled = false;
    loadProducts().then((items) => {
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
        {list.map((p) => (
          <option key={p.id} value={p.slug}>
            {p.title}
            {p.status === 'draft' ? ' (brouillon)' : ''}
          </option>
        ))}
      </datalist>
    </>
  );
}
