'use client';

import { useCallback, useContext } from 'react';
import { TrackingContext } from '@/lib/tracking/provider';
import { DENIED_CONSENT } from '@/lib/tracking/consent';
import type { EmitOptions } from '@/lib/tracking/client';
import type { TrackingConsentState } from '@/lib/db/types';

export type EmitFn = (
  event: string,
  params?: Record<string, unknown>,
  options?: EmitOptions,
) => void;

/**
 * Hook tracking. Si aucun TrackingProvider n'est monté (tests / SSR),
 * retourne un emit noop pour ne jamais casser le rendu.
 */
export function useTracking(): { emit: EmitFn; consent: TrackingConsentState } {
  const ctx = useContext(TrackingContext);
  const emit = useCallback<EmitFn>(
    (event, params = {}, options = {}) => {
      if (!ctx) return;
      ctx.client.emit(event, params, options);
    },
    [ctx],
  );
  return { emit, consent: ctx?.consent ?? DENIED_CONSENT };
}
