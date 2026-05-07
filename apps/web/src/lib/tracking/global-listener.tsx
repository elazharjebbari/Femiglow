'use client';

import { useEffect } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface DataAttrs {
  event?: string;
  componentId?: string;
  componentName?: string;
  pageId?: string;
  params?: string;
}

function readDataAttrs(target: HTMLElement): DataAttrs {
  return {
    event: target.dataset.trackEvent,
    componentId: target.dataset.trackComponentId,
    componentName: target.dataset.trackComponentName,
    pageId: target.dataset.trackPageId,
    params: target.dataset.trackParams,
  };
}

export function TrackingGlobalListener(): null {
  const { emit } = useTracking();

  useEffect(() => {
    const handler = (evt: Event): void => {
      const target = evt.target as HTMLElement | null;
      if (!target) return;
      const node = target.closest('[data-track-event]') as HTMLElement | null;
      if (!node) return;
      const { event, componentId, componentName, pageId, params } = readDataAttrs(node);
      if (!event) return;
      let parsedParams: Record<string, unknown> = {};
      if (params) {
        try {
          parsedParams = JSON.parse(params) as Record<string, unknown>;
        } catch {
          parsedParams = {};
        }
      }
      emit(event, parsedParams, { componentId, componentName, pageId });
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('submit', handler, true);
    return (): void => {
      document.removeEventListener('click', handler, true);
      document.removeEventListener('submit', handler, true);
    };
  }, [emit]);

  return null;
}
