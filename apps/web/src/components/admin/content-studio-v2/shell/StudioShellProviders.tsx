'use client';

import { useState, type ReactNode } from 'react';
import { CommandRegistryProvider } from '@/lib/content-studio-v2/state/CommandRegistry';
import { HotkeyRegistryProvider } from '@/lib/content-studio-v2/state/useHotkey';
import { CommandPalette } from './CommandPalette';
import { KeyboardCheatsheet } from './KeyboardCheatsheet';

/**
 * Combines all the v2-wide client providers (command palette, hotkey
 * registry, cheatsheet modal) under a single mount so layout files don't
 * grow client-component imports beyond ThemeProvider.
 *
 * Drop this once inside the v2 root layout (between ThemeProvider and the
 * page tree). Theme is already provided one level above so the palette
 * can read it.
 */
export function StudioShellProviders({ children }: { children: ReactNode }) {
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  return (
    <HotkeyRegistryProvider>
      <CommandRegistryProvider>
        {children}
        <CommandPalette onOpenCheatsheet={() => setCheatsheetOpen(true)} />
        <KeyboardCheatsheet open={cheatsheetOpen} onOpenChange={setCheatsheetOpen} />
      </CommandRegistryProvider>
    </HotkeyRegistryProvider>
  );
}
