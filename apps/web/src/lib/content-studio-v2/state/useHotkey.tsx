'use client';

import { useHotkeys, type HotkeyCallback, type Options } from 'react-hotkeys-hook';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Thin wrapper around `react-hotkeys-hook` that also registers each
 * binding in a HotkeyRegistry, so the help/cheatsheet modal can list
 * every active shortcut without a parallel inventory file.
 *
 * Typical usage:
 *   useHotkey('mod+s', save, { description: 'Sauvegarder le brouillon' });
 *
 * `mod+` matches ⌘ on macOS and Ctrl on Windows/Linux (handled by the
 * underlying lib).
 */

export interface HotkeyBinding {
  combo: string;
  description: string;
}

interface HotkeyRegistryValue {
  bindings: HotkeyBinding[];
  register: (binding: HotkeyBinding) => () => void;
}

const HotkeyRegistryContext = createContext<HotkeyRegistryValue | null>(null);

export function HotkeyRegistryProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState<HotkeyBinding[]>([]);

  const register = useCallback((binding: HotkeyBinding) => {
    setBindings((current) => {
      const filtered = current.filter((b) => b.combo !== binding.combo);
      return [...filtered, binding];
    });
    return () => {
      setBindings((current) => current.filter((b) => b.combo !== binding.combo));
    };
  }, []);

  const value = useMemo<HotkeyRegistryValue>(() => ({ bindings, register }), [bindings, register]);

  return <HotkeyRegistryContext.Provider value={value}>{children}</HotkeyRegistryContext.Provider>;
}

export function useHotkeyRegistry(): HotkeyRegistryValue {
  const ctx = useContext(HotkeyRegistryContext);
  // If no provider is mounted, behave as a no-op registry so consumers can
  // still call useHotkey() during isolated tests without crashing.
  if (!ctx) return { bindings: [], register: () => () => undefined };
  return ctx;
}

export function useHotkey(
  combo: string,
  handler: HotkeyCallback,
  options?: Options & { description?: string },
) {
  const { register } = useHotkeyRegistry();
  const description = options?.description ?? combo;

  useEffect(() => {
    return register({ combo, description });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, description]);

  useHotkeys(combo, handler, {
    preventDefault: true,
    enableOnFormTags: false,
    enableOnContentEditable: false,
    ...options,
  });
}
