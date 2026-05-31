/**
 * CHA-231 — Test du parsing SSE avec validation Zod (gap 4).
 *
 * On vérifie :
 *   - Les events valides sont passés tel quel.
 *   - Les events avec payload invalide retournent `null` + log via callback.
 *   - JSON malformé → `null` + log.
 *   - Bloc sans event field → `null` (silent).
 */
import { describe, expect, it, vi } from 'vitest';

import { parseSseBlock } from './sse-reader';

describe('parseSseBlock — Zod validation (CHA-231 gap 4)', () => {
  it('parse un event start valide', () => {
    const block = 'event: start\ndata: {"messageId":"m1","language":"fr"}';
    const ev = parseSseBlock(block);
    expect(ev).not.toBeNull();
    expect(ev?.event).toBe('start');
    if (ev?.event === 'start') {
      expect(ev.data.messageId).toBe('m1');
      expect(ev.data.language).toBe('fr');
    }
  });

  it('parse un chunk valide', () => {
    const block = 'event: chunk\ndata: {"messageId":"m1","delta":"Bonj"}';
    const ev = parseSseBlock(block);
    expect(ev?.event).toBe('chunk');
  });

  it('parse un lead-form-offer avec force optionnel', () => {
    const block =
      'event: lead-form-offer\ndata: {"messageId":"m1","reason":"explicit-request","copyKey":"explicit-request","force":true}';
    const ev = parseSseBlock(block);
    expect(ev?.event).toBe('lead-form-offer');
    if (ev?.event === 'lead-form-offer') {
      expect(ev.data.force).toBe(true);
    }
  });

  it('parse un lead-form-offer sans force (rétro-compat)', () => {
    const block =
      'event: lead-form-offer\ndata: {"messageId":"m1","reason":"purchase-intent","copyKey":"purchase-intent"}';
    const ev = parseSseBlock(block);
    expect(ev?.event).toBe('lead-form-offer');
  });

  it('rejette un event avec language invalide', () => {
    const onInvalid = vi.fn();
    const block = 'event: start\ndata: {"messageId":"m1","language":"klingon"}';
    const ev = parseSseBlock(block, onInvalid);
    expect(ev).toBeNull();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onInvalid.mock.calls[0]?.[0]?.rawEvent).toBe('start');
    expect(onInvalid.mock.calls[0]?.[0]?.issues).toContain('language');
  });

  it('rejette un event avec champ requis manquant', () => {
    const onInvalid = vi.fn();
    const block = 'event: chunk\ndata: {"messageId":"m1"}'; // delta manque
    const ev = parseSseBlock(block, onInvalid);
    expect(ev).toBeNull();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onInvalid.mock.calls[0]?.[0]?.issues).toContain('delta');
  });

  it('rejette un JSON malformé', () => {
    const onInvalid = vi.fn();
    const block = 'event: chunk\ndata: {malformed json';
    const ev = parseSseBlock(block, onInvalid);
    expect(ev).toBeNull();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onInvalid.mock.calls[0]?.[0]?.issues).toBe('JSON parse failed');
  });

  it('rejette un event inconnu', () => {
    const onInvalid = vi.fn();
    const block = 'event: hacked\ndata: {"foo":"bar"}';
    const ev = parseSseBlock(block, onInvalid);
    expect(ev).toBeNull();
    expect(onInvalid).toHaveBeenCalledOnce();
  });

  it('retourne null silencieusement si pas de field event', () => {
    const onInvalid = vi.fn();
    const block = 'data: {"messageId":"m1"}';
    const ev = parseSseBlock(block, onInvalid);
    expect(ev).toBeNull();
    // Pas de log : c'est juste un keepalive ou un comment, pas une erreur.
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('parse un event error avec retryable=true', () => {
    const block =
      'event: error\ndata: {"code":"timeout","message":"Provider unreachable","retryable":true}';
    const ev = parseSseBlock(block);
    expect(ev?.event).toBe('error');
    if (ev?.event === 'error') {
      expect(ev.data.retryable).toBe(true);
      expect(ev.data.code).toBe('timeout');
    }
  });
});
