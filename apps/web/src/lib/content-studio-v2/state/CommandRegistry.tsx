'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

/**
 * Lightweight registry for the v2 command palette (Cmd+K).
 *
 * Pattern: any component can call `useCommand({...})` to register a command
 * for as long as it is mounted. The palette reads the live registry. This
 * way contextual actions (e.g. "Approve selected draft") appear only when
 * a draft is selected — and disappear when navigating away.
 *
 * The Provider exposes `open/close/toggle` so the global Cmd+K hotkey can
 * drive UI state without prop drilling.
 */

export interface StudioCommand {
  /** Stable id. Same id → same slot. Used as React key. */
  id: string;
  label: string;
  /** Optional sub-label or hint. */
  description?: string;
  /** Visual grouping in the palette. */
  group: 'Navigation' | 'Thème' | 'Création' | 'Bibliothèque' | 'Planning' | 'Actions';
  /** Keyboard shortcut hint, displayed in the palette. */
  shortcut?: string;
  /** Optional icon to render before the label. */
  icon?: ReactNode;
  perform: () => void | Promise<void>;
}

interface CommandRegistryValue {
  commands: StudioCommand[];
  register: (command: StudioCommand) => () => void;
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
}

const CommandRegistryContext = createContext<CommandRegistryValue | null>(null);

export function CommandRegistryProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<StudioCommand[]>([]);
  const [open, setOpen] = useState(false);

  const register = useCallback((command: StudioCommand) => {
    setCommands((current) => {
      const filtered = current.filter((c) => c.id !== command.id);
      return [...filtered, command];
    });
    return () => {
      setCommands((current) => current.filter((c) => c.id !== command.id));
    };
  }, []);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo<CommandRegistryValue>(
    () => ({ commands, register, open, setOpen, toggle }),
    [commands, register, open, toggle],
  );

  return <CommandRegistryContext.Provider value={value}>{children}</CommandRegistryContext.Provider>;
}

export function useCommandRegistry(): CommandRegistryValue {
  const ctx = useContext(CommandRegistryContext);
  if (!ctx) throw new Error('useCommandRegistry must be used inside <CommandRegistryProvider>');
  return ctx;
}

/**
 * Register a command for the lifetime of the calling component.
 *
 * Pass a stable `id` so the entry is keyed correctly across re-renders.
 * The command object itself is captured per render — define it inline.
 *
 * The optional `enabled` flag lets a component conditionally register
 * a command without an awkward early-return.
 */
export function useCommand(command: StudioCommand | null) {
  const { register } = useCommandRegistry();
  useEffect(() => {
    if (!command) return;
    return register(command);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.id, command?.label, command?.shortcut]);
}
