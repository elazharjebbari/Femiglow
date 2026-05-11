'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

interface RitualsAdminSearchProps {
  /** Délai de debounce en ms. */
  debounceMs?: number;
}

/**
 * Champ de recherche full-text au-dessus d'une table admin.
 * Sérialise via `?q=...` et utilise next/navigation pour préserver le scroll.
 */
export function RitualsAdminSearch({ debounceMs = 300 }: RitualsAdminSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get('q') ?? '';
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (value.trim().length > 0) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // searchParams est volontairement omis : c'est lui qui est *muté*.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs, pathname, router]);

  return (
    <div className="mb-3 flex items-center gap-2">
      <label className="flex w-full max-w-md items-center gap-2 text-sm">
        <span className="text-stone-700">Rechercher</span>
        <input
          type="search"
          value={value}
          placeholder="Citation, prénom, ville…"
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 border border-stone-300 px-3 py-1.5 text-sm"
          data-testid="admin-search"
          aria-label="Recherche full-text"
        />
      </label>
    </div>
  );
}

/**
 * Helper d'highlight des matches dans un texte donné.
 * Retourne un tableau de fragments (string | { match: true; text: string }).
 */
export function highlightMatches(
  text: string,
  query: string | null | undefined,
): Array<string | { match: true; text: string }> {
  if (!query || query.length === 0) return [text];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  return parts.map((p) =>
    p.toLowerCase() === query.toLowerCase() ? { match: true as const, text: p } : p,
  );
}
