'use client';

/**
 * Sandboxed iframe wrapping Listmonk UI under the FemiGlow admin shell.
 *
 *   - `src` always points at /api/listmonk/<path> (same-origin, proxied)
 *   - the proxy injects auth, so no Listmonk credentials leak to the browser
 *   - sandbox allows the minimal set needed (same-origin scripts forms popups)
 *   - listens for postMessage events from Listmonk for URL sync (optional —
 *     Listmonk doesn't post by default, but custom JS in its admin can)
 */
import { useEffect, useRef } from 'react';

type Props = {
  path?: string;
  title?: string;
  className?: string;
  onNavigate?: (path: string) => void;
};

export function ListmonkFrame({
  path = '/admin',
  title = 'Listmonk',
  className,
  onNavigate,
}: Props) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!onNavigate) return;
    function handler(evt: MessageEvent) {
      if (evt.origin !== window.location.origin) return;
      const data = evt.data as { type?: string; path?: string } | undefined;
      if (data?.type === 'listmonk:navigate' && typeof data.path === 'string') {
        onNavigate?.(data.path);
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onNavigate]);

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const src = `/api/listmonk${normalizedPath}`;

  return (
    <iframe
      ref={ref}
      title={title}
      src={src}
      // Allow same-origin (the proxy is same-origin), scripts (Listmonk
      // is a Vue SPA), forms (Listmonk uses forms internally), popups
      // (for confirmations). No `allow-top-navigation` — Listmonk
      // shouldn't be able to break out of the iframe.
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      className={
        className ??
        'h-[calc(100vh-12rem)] w-full rounded-lg border border-stone-200 bg-white'
      }
    />
  );
}
