// @vitest-environment jsdom
/**
 * F07 P3.4-a (Lot 1) — useTemplateDraft : brouillon local debounced + détection
 * de restauration (frais/divergent/format/serveur) + suspension de l'autosave
 * tant que la restauration n'est pas tranchée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useTemplateDraft,
  templateDraftKey,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
  type DraftStorage,
  type TemplateDraftState,
} from '../use-template-draft';

const KEY = templateDraftKey('t1');
const NOW = new Date('2026-06-21T12:00:00.000Z').getTime();
const SERVER_UPDATED = '2026-06-21T10:00:00.000Z';

const CURRENT: TemplateDraftState = {
  subject: 'Sujet serveur',
  preheader: '',
  htmlSource: '<p>serveur</p>',
  customVars: '{}',
};

type MapStorage = DraftStorage & { _map: Map<string, string> };
function makeStorage(initial: Record<string, string> = {}): MapStorage {
  const m = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    _map: m,
  };
}

function draftJson(over: { v?: number; savedAt?: string; data?: Partial<TemplateDraftState> } = {}) {
  return JSON.stringify({
    v: over.v ?? TEMPLATE_DRAFT_SCHEMA_VERSION,
    savedAt: over.savedAt ?? '2026-06-21T11:00:00.000Z',
    data: { ...CURRENT, htmlSource: '<p>brouillon</p>', ...(over.data ?? {}) },
  });
}

function setup(storage: DraftStorage, serverUpdatedAt = SERVER_UPDATED) {
  return renderHook(() =>
    useTemplateDraft({ templateId: 't1', current: CURRENT, serverUpdatedAt, storage, now: () => NOW }),
  );
}
function readDraft(st: MapStorage) {
  return JSON.parse(st._map.get(KEY)!) as { v: number; savedAt: string; data: TemplateDraftState };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('F07 — useTemplateDraft', () => {
  it('F07-C-001 — frappe → 1 écriture locale après le debounce (1 s)', () => {
    const st = makeStorage();
    const { result } = setup(st);
    act(() => result.current.schedule({ ...CURRENT, htmlSource: '<p>edit</p>' }));
    expect(st._map.has(KEY)).toBe(false); // pas avant 1 s
    act(() => vi.advanceTimersByTime(1000));
    expect(readDraft(st).data.htmlSource).toBe('<p>edit</p>');
    expect(readDraft(st).v).toBe(TEMPLATE_DRAFT_SCHEMA_VERSION);
    expect(result.current.status).toBe('saved');
  });

  it('F07-C-002 — rafale : le timer se réarme, 1 écriture après la DERNIÈRE frappe', () => {
    const st = makeStorage();
    const { result } = setup(st);
    act(() => result.current.schedule({ ...CURRENT, htmlSource: 'a' }));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.schedule({ ...CURRENT, htmlSource: 'ab' }));
    act(() => vi.advanceTimersByTime(999));
    expect(st._map.has(KEY)).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(readDraft(st).data.htmlSource).toBe('ab');
  });

  it('F07-C-003 — flush() écrit immédiatement', () => {
    const st = makeStorage();
    const { result } = setup(st);
    act(() => result.current.flush({ ...CURRENT, htmlSource: 'now' }));
    expect(readDraft(st).data.htmlSource).toBe('now');
  });

  it('F07-C-004 — brouillon DIVERGENT + frais → pendingRestore + autosave SUSPENDU', () => {
    const st = makeStorage({ [KEY]: draftJson({ data: { htmlSource: '<p>brouillon</p>' } }) });
    const { result } = setup(st);
    expect(result.current.pendingRestore?.data.htmlSource).toBe('<p>brouillon</p>');
    expect(result.current.pendingRestore?.savedAt).toBe('2026-06-21T11:00:00.000Z');
    // Suspendu : aucune écriture ne doit écraser le brouillon proposé.
    act(() => result.current.schedule({ ...CURRENT, htmlSource: 'ECRASEMENT' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(readDraft(st).data.htmlSource).toBe('<p>brouillon</p>');
  });

  it('F07-C-005 — brouillon IDENTIQUE au serveur → pas de restauration (purgé)', () => {
    const st = makeStorage({ [KEY]: draftJson({ data: { ...CURRENT } }) });
    const { result } = setup(st);
    expect(result.current.pendingRestore).toBeNull();
    expect(st._map.has(KEY)).toBe(false);
  });

  it('F07-C-006 — brouillon ANTÉRIEUR à updatedAt serveur → périmé (purgé)', () => {
    const st = makeStorage({ [KEY]: draftJson({ savedAt: '2026-06-21T09:00:00.000Z' }) }); // < 10:00
    const { result } = setup(st);
    expect(result.current.pendingRestore).toBeNull();
    expect(st._map.has(KEY)).toBe(false);
  });

  it('F07-C-007 — brouillon EXPIRÉ (TTL) → purgé', () => {
    // 11 jours avant NOW ; serveur encore plus ancien → seul le TTL tranche.
    const st = makeStorage({ [KEY]: draftJson({ savedAt: '2026-06-10T12:00:00.000Z' }) });
    const { result } = setup(st, '2026-06-05T00:00:00.000Z');
    expect(result.current.pendingRestore).toBeNull();
    expect(st._map.has(KEY)).toBe(false);
  });

  it('F07-C-008 — schemaVersion différent → purgé (jamais appliqué)', () => {
    const st = makeStorage({ [KEY]: draftJson({ v: 99 }) });
    const { result } = setup(st);
    expect(result.current.pendingRestore).toBeNull();
    expect(st._map.has(KEY)).toBe(false);
  });

  it('F07-C-009 — brouillon corrompu (JSON invalide) → purgé sans crash', () => {
    const st = makeStorage({ [KEY]: '{pas du json' });
    const { result } = setup(st);
    expect(result.current.pendingRestore).toBeNull();
    expect(st._map.has(KEY)).toBe(false);
  });

  it('F07-C-010 — discardDraft() supprime le brouillon ET reprend l’autosave', () => {
    const st = makeStorage({ [KEY]: draftJson() });
    const { result } = setup(st);
    act(() => result.current.discardDraft());
    expect(st._map.has(KEY)).toBe(false);
    expect(result.current.pendingRestore).toBeNull();
    act(() => result.current.schedule({ ...CURRENT, htmlSource: 'apres' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(readDraft(st).data.htmlSource).toBe('apres');
  });

  it('F07-C-011 — restoreResolved() reprend l’autosave sans supprimer le brouillon', () => {
    const st = makeStorage({ [KEY]: draftJson() });
    const { result } = setup(st);
    expect(result.current.pendingRestore).not.toBeNull();
    act(() => result.current.restoreResolved());
    expect(result.current.pendingRestore).toBeNull();
    act(() => result.current.schedule({ ...CURRENT, htmlSource: 'after' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(readDraft(st).data.htmlSource).toBe('after');
  });
});
