/**
 * CHA-LEAD-V2 — Tests des constants kind.
 */
import { describe, it, expect } from 'vitest';

import {
  CHAT_SESSION_KINDS,
  ADMIN_CHAT_VISIBLE_KINDS,
  ADMIN_CHAT_VISIBLE_LEAD_SOURCES,
  isChatSessionKind,
} from './kind';

describe('CHAT_SESSION_KINDS', () => {
  it('contient les 3 kinds attendus', () => {
    expect(CHAT_SESSION_KINDS).toEqual(['chat', 'wizard_pivot', 'system']);
  });

  it('ADMIN_CHAT_VISIBLE_KINDS ne contient que "chat" par défaut', () => {
    expect(ADMIN_CHAT_VISIBLE_KINDS).toEqual(['chat']);
  });

  it('ADMIN_CHAT_VISIBLE_LEAD_SOURCES contient chat_widget + inline', () => {
    expect(ADMIN_CHAT_VISIBLE_LEAD_SOURCES).toEqual(['chat_widget', 'inline']);
  });
});

describe('isChatSessionKind', () => {
  it('renvoie true pour les kinds valides', () => {
    expect(isChatSessionKind('chat')).toBe(true);
    expect(isChatSessionKind('wizard_pivot')).toBe(true);
    expect(isChatSessionKind('system')).toBe(true);
  });

  it('renvoie false pour les kinds invalides', () => {
    expect(isChatSessionKind('admin')).toBe(false);
    expect(isChatSessionKind('')).toBe(false);
    expect(isChatSessionKind(null)).toBe(false);
    expect(isChatSessionKind(undefined)).toBe(false);
    expect(isChatSessionKind(123)).toBe(false);
  });
});
