'use client';

import { cloneElement, isValidElement, useEffect, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

export type TrackMode = 'mount' | 'visible' | 'click' | 'submit';

export interface TrackProps {
  event: string;
  params?: Record<string, unknown>;
  componentId?: string;
  componentName?: string;
  pageId?: string;
  mode?: TrackMode;
  threshold?: number;
  once?: boolean;
  children: React.ReactElement;
}

export function Track({
  event,
  params,
  componentId,
  componentName,
  pageId,
  mode = 'click',
  threshold = 0.5,
  once = true,
  children,
}: TrackProps): JSX.Element {
  const { emit } = useTracking();
  const ref = useRef<HTMLElement | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (mode === 'mount') {
      if (firedRef.current && once) return;
      firedRef.current = true;
      emit(event, params, { componentId, componentName, pageId });
      return;
    }
    if (mode === 'visible') {
      const node = ref.current;
      if (!node || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (firedRef.current && once) return;
              firedRef.current = true;
              emit(event, params, { componentId, componentName, pageId });
              if (once) observer.disconnect();
            }
          }
        },
        { threshold },
      );
      observer.observe(node);
      return (): void => observer.disconnect();
    }
    return;
  }, [emit, event, params, componentId, componentName, pageId, mode, once, threshold]);

  if (!isValidElement(children)) return children as unknown as JSX.Element;

  if (mode === 'click' || mode === 'submit') {
    type AnyHandler = (evt: React.SyntheticEvent) => void;
    type ChildProps = {
      onClick?: AnyHandler;
      onSubmit?: AnyHandler;
      ref?: React.Ref<HTMLElement>;
    };
    const childProps = (children as React.ReactElement<ChildProps>).props;
    const eventHandlerName = mode === 'click' ? 'onClick' : 'onSubmit';
    const original = childProps[eventHandlerName];
    const handler: AnyHandler = (evt) => {
      try {
        emit(event, params, { componentId, componentName, pageId });
      } catch {
        // ignore tracking errors
      }
      original?.(evt);
    };
    const refSetter: React.RefCallback<HTMLElement> = (node) => {
      ref.current = node;
    };
    return cloneElement(children as React.ReactElement<ChildProps>, {
      [eventHandlerName]: handler,
      ref: refSetter,
    } as Partial<ChildProps>);
  }

  const refSetter: React.RefCallback<HTMLElement> = (node) => {
    ref.current = node;
  };
  return cloneElement(children, { ref: refSetter } as { ref?: React.Ref<HTMLElement> });
}
