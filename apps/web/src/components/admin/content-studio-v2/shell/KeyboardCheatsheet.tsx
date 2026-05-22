'use client';

import { useState } from 'react';
import { Dialog } from '../primitives';
import { useHotkeyRegistry } from '@/lib/content-studio-v2/state/useHotkey';

/**
 * Modal that lists every active hotkey, fed by the HotkeyRegistry.
 * Controlled by the parent (CommandPalette can call open via ?-hotkey).
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'mod') return navigator?.platform?.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
      if (lower === 'shift') return '⇧';
      if (lower === 'alt') return '⌥';
      if (lower === 'ctrl') return 'Ctrl';
      if (lower === 'enter') return '↵';
      if (lower === 'escape') return 'esc';
      if (lower === 'space') return '␣';
      return part.toUpperCase();
    })
    .join(' + ');
}

export function KeyboardCheatsheet({ open, onOpenChange }: Props) {
  const { bindings } = useHotkeyRegistry();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Raccourcis clavier"
      description="Tous les raccourcis actuellement actifs dans le Studio v2."
      size="md"
    >
      {bindings.length === 0 ? (
        <p style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>
          Aucun raccourci enregistré pour l'instant.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bindings.map((binding) => (
            <li
              key={binding.combo}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 'var(--cs-radius-sm)',
                background: 'var(--cs-bg-sunken)',
                fontSize: 'var(--cs-text-sm)',
              }}
            >
              <span style={{ color: 'var(--cs-fg-primary)' }}>{binding.description}</span>
              <kbd
                style={{
                  padding: '3px 9px',
                  borderRadius: 4,
                  background: 'var(--cs-bg-elevated)',
                  border: '1px solid var(--cs-border-hair)',
                  fontFamily: 'var(--cs-font-mono)',
                  fontSize: 11,
                  color: 'var(--cs-fg-primary)',
                }}
              >
                {formatCombo(binding.combo)}
              </kbd>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/**
 * Stateful wrapper most pages will mount. Tracks its own open state and
 * is opened either via the `?` hotkey (registered globally in
 * CommandPalette) or via a command palette entry.
 */
export function KeyboardCheatsheetController() {
  const [open, setOpen] = useState(false);
  return <KeyboardCheatsheet open={open} onOpenChange={setOpen} />;
}
