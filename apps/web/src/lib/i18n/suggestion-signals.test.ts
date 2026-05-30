/**
 * Lot L10 — `collectSignals` & helpers : photo DOM conservatrice, fail-soft.
 * Couvre les défauts sûrs (INV-13/14/17) : un signal absent n'ouvre jamais
 * un `show` ; SSR ne jette jamais.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  collectSignals,
  isFormElementFocused,
  isModalOpen,
  isVideoPlaying,
  pathIsCheckout,
} from './suggestion-signals';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('pathIsCheckout', () => {
  it.each([
    ['/fr/checkout', true],
    ['/ar/commander', true],
    ['/fr/kit/wizard', true],
    ['/fr/paiement/etape-2', true],
    ['/fr/kit', false],
    ['/ar/journal/post-1', false],
    ['/', false],
  ])('%s → %s', (path, expected) => {
    expect(pathIsCheckout(path)).toBe(expected);
  });
});

describe('isFormElementFocused', () => {
  it('aucun focus → false', () => {
    expect(isFormElementFocused()).toBe(false);
  });

  it('input focalisé → true', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(isFormElementFocused()).toBe(true);
  });

  it('textarea focalisé → true', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    expect(isFormElementFocused()).toBe(true);
  });

  it('div non éditable focalisé → false', () => {
    const div = document.createElement('div');
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();
    expect(isFormElementFocused()).toBe(false);
  });
});

describe('isModalOpen', () => {
  it('rien d’ouvert → false', () => {
    expect(isModalOpen()).toBe(false);
  });

  it('élément aria-modal → true', () => {
    document.body.innerHTML = '<div aria-modal="true">dialog</div>';
    expect(isModalOpen()).toBe(true);
  });

  it('chat ouvert (data-chat-open) → true', () => {
    document.body.innerHTML = '<div data-chat-open="true"></div>';
    expect(isModalOpen()).toBe(true);
  });
});

describe('isVideoPlaying', () => {
  it('aucune vidéo → false', () => {
    expect(isVideoPlaying()).toBe(false);
  });

  it('vidéo en lecture → true', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    Object.defineProperty(video, 'ended', { value: false, configurable: true });
    Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
    expect(isVideoPlaying()).toBe(true);
  });

  it('vidéo en pause → false', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);
    // jsdom : paused=true par défaut
    expect(isVideoPlaying()).toBe(false);
  });
});

describe('collectSignals', () => {
  it('photo DOM par défaut (rien d’actif) → tout permissif côté zones calmes DOM', () => {
    const s = collectSignals('/fr/kit');
    expect(s).toMatchObject({
      inCheckout: false,
      formFocused: false,
      modalOpen: false,
      videoPlaying: false,
    });
  });

  it('chemin checkout → inCheckout true', () => {
    expect(collectSignals('/fr/checkout').inCheckout).toBe(true);
  });

  it('input focalisé → formFocused true', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(collectSignals('/fr/kit').formFocused).toBe(true);
  });

  it('ne jette jamais et renvoie un objet partiel défini', () => {
    expect(() => collectSignals('/')).not.toThrow();
    const s = collectSignals('/');
    expect(Object.keys(s).length).toBeGreaterThan(0);
  });
});
