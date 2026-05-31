'use client';

import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Home,
  Sparkles,
  LayoutGrid,
  CalendarDays,
  Sun,
  Moon,
  ExternalLink,
  Keyboard,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useCommand, useCommandRegistry, type StudioCommand } from '@/lib/content-studio-v2/state/CommandRegistry';
import { useHotkey } from '@/lib/content-studio-v2/state/useHotkey';
import { useTheme } from './ThemeProvider';

interface Props {
  onOpenCheatsheet?: () => void;
}

export function CommandPalette({ onOpenCheatsheet }: Props) {
  const { commands, open, setOpen, toggle } = useCommandRegistry();
  const router = useRouter();
  const { resolved, toggle: toggleTheme } = useTheme();

  // Global hotkey: ⌘K / Ctrl+K opens/closes the palette.
  useHotkey('mod+k', () => toggle(), { description: 'Ouvrir la palette de commandes' });
  // ? opens the cheatsheet (only when no input is focused — react-hotkeys-hook handles it).
  useHotkey('shift+/', () => onOpenCheatsheet?.(), { description: 'Voir tous les raccourcis (?)' });
  useHotkey('?', () => onOpenCheatsheet?.(), { description: 'Voir tous les raccourcis' });

  // Built-in navigation commands. Registered once per palette mount.
  useCommand(useMemo<StudioCommand>(() => ({
    id: 'nav.home',
    group: 'Navigation',
    label: 'Aller à l\'Accueil',
    shortcut: 'g h',
    icon: <Home size={14} />,
    perform: () => router.push('/admin/content-studio-v2/home'),
  }), [router]));
  useCommand(useMemo<StudioCommand>(() => ({
    id: 'nav.create',
    group: 'Navigation',
    label: 'Aller à la Création',
    shortcut: 'g c',
    icon: <Sparkles size={14} />,
    perform: () => router.push('/admin/content-studio-v2/create'),
  }), [router]));
  useCommand(useMemo<StudioCommand>(() => ({
    id: 'nav.library',
    group: 'Navigation',
    label: 'Aller à la Bibliothèque',
    shortcut: 'g l',
    icon: <LayoutGrid size={14} />,
    perform: () => router.push('/admin/content-studio-v2/library'),
  }), [router]));
  useCommand(useMemo<StudioCommand>(() => ({
    id: 'nav.plan',
    group: 'Navigation',
    label: 'Aller au Planning',
    shortcut: 'g p',
    icon: <CalendarDays size={14} />,
    perform: () => router.push('/admin/content-studio-v2/plan'),
  }), [router]));
  useCommand(useMemo<StudioCommand>(() => ({
    id: 'theme.toggle',
    group: 'Thème',
    label: resolved === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre',
    shortcut: 'mod+shift+l',
    icon: resolved === 'dark' ? <Sun size={14} /> : <Moon size={14} />,
    perform: toggleTheme,
  }), [resolved, toggleTheme]));
  useCommand(useMemo<StudioCommand>(() => ({
    id: 'nav.legacy',
    group: 'Navigation',
    label: 'Ouvrir l\'ancien Studio',
    icon: <ExternalLink size={14} />,
    perform: () => router.push('/admin/content-studio-legacy'),
  }), [router]));
  useCommand(useMemo<StudioCommand>(() => ({
    id: 'help.cheatsheet',
    group: 'Navigation',
    label: 'Voir tous les raccourcis',
    shortcut: '?',
    icon: <Keyboard size={14} />,
    perform: () => onOpenCheatsheet?.(),
  }), [onOpenCheatsheet]));

  useHotkey('mod+shift+l', toggleTheme, { description: 'Basculer le thème' });

  // ESC closes the palette (cmdk handles this internally if onOpenChange wired).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const grouped = useMemo(() => {
    const groups = new Map<StudioCommand['group'], StudioCommand[]>();
    for (const command of commands) {
      const existing = groups.get(command.group) ?? [];
      existing.push(command);
      groups.set(command.group, existing);
    }
    return Array.from(groups.entries());
  }, [commands]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--cs-bg-overlay)',
        zIndex: 90,
        display: 'grid',
        placeItems: 'start center',
        paddingTop: '12vh',
        animation: 'cs-fade-in 160ms var(--cs-easing)',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, calc(100vw - 32px))',
          background: 'var(--cs-bg-elevated)',
          borderRadius: 'var(--cs-radius-lg)',
          border: '1px solid var(--cs-border)',
          boxShadow: 'var(--cs-shadow-lg)',
          overflow: 'hidden',
          fontFamily: 'var(--cs-font-body)',
        }}
      >
        <Command label="Palette de commandes" loop>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--cs-border-hair)' }}>
            <Command.Input
              autoFocus
              placeholder="Tape une commande ou recherche…"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 'var(--cs-text-lg)',
                fontFamily: 'var(--cs-font-body)',
                color: 'var(--cs-fg-primary)',
              }}
            />
          </div>
          <Command.List
            style={{
              maxHeight: 420,
              overflowY: 'auto',
              padding: 8,
            }}
          >
            <Command.Empty style={{ padding: 20, textAlign: 'center', color: 'var(--cs-fg-muted)', fontSize: 'var(--cs-text-sm)' }}>
              Aucun résultat.
            </Command.Empty>
            {grouped.map(([group, list]) => (
              <Command.Group
                key={group}
                heading={group}
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: 'var(--cs-fg-muted)',
                  fontFamily: 'var(--cs-font-mono)',
                }}
              >
                {list.map((command) => (
                  <Command.Item
                    key={command.id}
                    value={`${command.group} ${command.label}`}
                    onSelect={() => {
                      setOpen(false);
                      void command.perform();
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--cs-radius)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      color: 'var(--cs-fg-primary)',
                      fontFamily: 'var(--cs-font-body)',
                      fontSize: 'var(--cs-text-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--cs-fg-secondary)' }}>{command.icon}</span>
                    <span style={{ flex: 1 }}>
                      {command.label}
                      {command.description ? (
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--cs-fg-muted)', marginTop: 2 }}>
                          {command.description}
                        </span>
                      ) : null}
                    </span>
                    {command.shortcut ? (
                      <kbd
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'var(--cs-bg-sunken)',
                          fontFamily: 'var(--cs-font-mono)',
                          fontSize: 11,
                          color: 'var(--cs-fg-muted)',
                          border: '1px solid var(--cs-border-hair)',
                        }}
                      >
                        {command.shortcut}
                      </kbd>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <div
            style={{
              padding: '10px 18px',
              borderTop: '1px solid var(--cs-border-hair)',
              fontSize: 11,
              color: 'var(--cs-fg-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--cs-font-mono)',
            }}
          >
            <span>↑↓ naviguer · ↵ valider · esc fermer</span>
            <span>? aide</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
