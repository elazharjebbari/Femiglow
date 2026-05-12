'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type WallView = 'list' | 'wizard' | 'policy';

interface WallUrlState {
  isOpen: boolean;
  view: WallView;
  scrollToSlug: string | null;
  preselectFilter: string | null;
  open: (opts?: { view?: WallView; cardSlug?: string }) => void;
  close: () => void;
  setView: (view: WallView) => void;
}

/**
 * Hook qui synchronise l'état du drawer avec l'URL `?wall=*`.
 * Cf. docs/reviews-wall/execution/05-frontend-plan-action.md § 8.3
 */
export function useWallUrlState(): WallUrlState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  const wallParam = searchParams?.get('wall') ?? null;
  const isOpen = wallParam !== null;
  let view: WallView = 'list';
  let scrollToSlug: string | null = null;
  if (wallParam === 'share') view = 'wizard';
  else if (wallParam === 'policy') view = 'policy';
  else if (wallParam?.startsWith('card-')) {
    view = 'list';
    scrollToSlug = wallParam.slice('card-'.length);
  }

  const updateParam = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
      if (next === null) {
        params.delete('wall');
      } else {
        params.set('wall', next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const open = useCallback<WallUrlState['open']>(
    (opts) => {
      const v = opts?.view ?? 'list';
      if (opts?.cardSlug) updateParam(`card-${opts.cardSlug}`);
      else if (v === 'wizard') updateParam('share');
      else if (v === 'policy') updateParam('policy');
      else updateParam('open');
    },
    [updateParam],
  );

  const close = useCallback(() => updateParam(null), [updateParam]);
  const setView = useCallback(
    (v: WallView) => updateParam(v === 'list' ? 'open' : v === 'wizard' ? 'share' : 'policy'),
    [updateParam],
  );

  return {
    isOpen,
    view,
    scrollToSlug,
    preselectFilter: null,
    open,
    close,
    setView,
  };
}
