import { describe, expect, it } from 'vitest';

import {
  resolveCapiBatching,
  resolveChatFallback,
  resolveChatModeration,
  resolveRedisState,
} from './live-systems';

describe('resolveChatModeration', () => {
  it('default off quand env undefined', () => {
    expect(resolveChatModeration(undefined)).toBe('off');
  });

  it('on quand env vaut "on"', () => {
    expect(resolveChatModeration('on')).toBe('on');
  });

  it('off pour "ON" majuscule (strict)', () => {
    expect(resolveChatModeration('ON')).toBe('off');
  });

  it('off pour "true"', () => {
    expect(resolveChatModeration('true')).toBe('off');
  });

  it('off pour string vide', () => {
    expect(resolveChatModeration('')).toBe('off');
  });
});

describe('resolveRedisState', () => {
  it('default v1 quand env undefined', () => {
    expect(resolveRedisState(undefined)).toBe('v1');
  });

  it('v2 quand env vaut "true"', () => {
    expect(resolveRedisState('true')).toBe('v2');
  });

  it('v1 pour autre valeur', () => {
    expect(resolveRedisState('TRUE')).toBe('v1');
    expect(resolveRedisState('1')).toBe('v1');
    expect(resolveRedisState('on')).toBe('v1');
  });
});

describe('resolveCapiBatching', () => {
  it('default off', () => {
    expect(resolveCapiBatching(undefined)).toBe('off');
  });

  it('on quand env vaut "on"', () => {
    expect(resolveCapiBatching('on')).toBe('on');
  });

  it('off pour "true"', () => {
    expect(resolveCapiBatching('true')).toBe('off');
  });
});

describe('resolveChatFallback', () => {
  it('default off', () => {
    expect(resolveChatFallback(undefined)).toBe('off');
  });

  it('anthropic quand env vaut "anthropic"', () => {
    expect(resolveChatFallback('anthropic')).toBe('anthropic');
  });

  it('off pour autre provider', () => {
    expect(resolveChatFallback('openai')).toBe('off');
    expect(resolveChatFallback('Anthropic')).toBe('off');
  });
});
