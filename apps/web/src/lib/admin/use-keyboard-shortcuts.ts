'use client';
import { useEffect, useRef } from 'react';

/**
 * Définition d'un raccourci clavier.
 * `key` est la touche brute (ex. "j", "?", "Escape").
 */
export interface KeyboardShortcut {
  key: string;
  description: string;
  /** Si false, le raccourci est ignoré (mais reste visible dans la cheatsheet, grisé). */
  enabled?: boolean;
  /** Si true, fonctionne aussi quand un input/textarea a le focus. */
  evenInInput?: boolean;
  /** Handler. Reçoit l'événement pour pouvoir le preventDefault. */
  handler: (event: KeyboardEvent) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Enregistre une liste de raccourcis clavier globaux pour la durée de vie du composant.
 *
 * Les raccourcis dont `enabled === false` sont ignorés à la frappe mais peuvent
 * encore être listés dans la cheatsheet (grisés). Les modifiers (Ctrl/Cmd/Alt)
 * désactivent automatiquement le raccourci pour éviter les conflits navigateur.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const list = shortcutsRef.current;
      const match = list.find((s) => s.key.toLowerCase() === event.key.toLowerCase());
      if (!match) return;
      if (match.enabled === false) return;
      if (!match.evenInInput && isEditableTarget(event.target)) return;
      event.preventDefault();
      match.handler(event);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
