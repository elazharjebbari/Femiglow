/**
 * Tests `lib/video/iframe-tracker`. Mocks `window.YT` pour simuler
 * la YouTube IFrame Player API sans charger le vrai script.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetYouTubeIframeApiCache,
  attachVideoTracker,
  loadYouTubeIframeApi,
} from './iframe-tracker';

interface FakePlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
  __triggerStateChange: (data: number) => void;
  __setCurrentTime: (t: number) => void;
  __setDuration: (d: number) => void;
}

interface FakeYTHandle {
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
  Player: ReturnType<typeof vi.fn>;
  __lastPlayer: FakePlayer | null;
  __triggerReady: () => void;
}

function installFakeYT(): FakeYTHandle {
  let onReady: ((e: { target: FakePlayer }) => void) | undefined;
  let onStateChange: ((e: { data: number; target: FakePlayer }) => void) | undefined;
  let currentTime = 0;
  let duration = 100;
  let lastPlayer: FakePlayer | null = null;

  const PlayerCtor = vi.fn((_iframe: HTMLIFrameElement, opts: any) => {
    onReady = opts.events?.onReady;
    onStateChange = opts.events?.onStateChange;
    const player: FakePlayer = {
      getCurrentTime: () => currentTime,
      getDuration: () => duration,
      destroy: vi.fn(),
      __triggerStateChange: (data: number) => {
        onStateChange?.({ data, target: player });
      },
      __setCurrentTime: (t: number) => {
        currentTime = t;
      },
      __setDuration: (d: number) => {
        duration = d;
      },
    };
    lastPlayer = player;
    return player;
  });

  const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

  (window as any).YT = { Player: PlayerCtor, PlayerState };

  return {
    PlayerState,
    Player: PlayerCtor,
    get __lastPlayer() {
      return lastPlayer;
    },
    __triggerReady: () => {
      if (lastPlayer && onReady) onReady({ target: lastPlayer });
    },
  } as FakeYTHandle;
}

function uninstallFakeYT(): void {
  delete (window as any).YT;
  delete (window as any).onYouTubeIframeAPIReady;
}

function makeIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  return iframe;
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetYouTubeIframeApiCache();
});

afterEach(() => {
  vi.useRealTimers();
  uninstallFakeYT();
  document.body.innerHTML = '';
});

describe('loadYouTubeIframeApi', () => {
  it('résout immédiatement quand window.YT est déjà présent', async () => {
    installFakeYT();
    const yt = await loadYouTubeIframeApi();
    expect(typeof yt.Player).toBe('function');
  });

  it('partage la même promise sur appels multiples (idempotent)', async () => {
    installFakeYT();
    const p1 = loadYouTubeIframeApi();
    const p2 = loadYouTubeIframeApi();
    expect(p1).toBe(p2);
  });

  it('rejette si l\'API ne se charge pas (timeout 5 s)', async () => {
    const promise = loadYouTubeIframeApi();
    vi.advanceTimersByTime(5100);
    await expect(promise).rejects.toThrow(/timeout/i);
  });

  it('injecte le script une seule fois même sur appels multiples', () => {
    loadYouTubeIframeApi().catch(() => {});
    loadYouTubeIframeApi().catch(() => {});
    const scripts = document.querySelectorAll(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    expect(scripts.length).toBe(1);
  });

  it('appelle window.onYouTubeIframeAPIReady quand l\'API arrive', async () => {
    const promise = loadYouTubeIframeApi();
    // Simule l'API qui se charge
    installFakeYT();
    (window as any).onYouTubeIframeAPIReady?.();
    await expect(promise).resolves.toBeDefined();
  });
});

describe('attachVideoTracker — onComplete', () => {
  it('émet onComplete une seule fois au PlayerState.ENDED', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onComplete = vi.fn();
    await attachVideoTracker(iframe, { onComplete });

    fake.__lastPlayer!.__triggerStateChange(fake.PlayerState.ENDED);
    fake.__lastPlayer!.__triggerStateChange(fake.PlayerState.ENDED);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('n\'émet pas onComplete pour PLAYING ou PAUSED', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onComplete = vi.fn();
    await attachVideoTracker(iframe, { onComplete });

    fake.__lastPlayer!.__triggerStateChange(fake.PlayerState.PLAYING);
    fake.__lastPlayer!.__triggerStateChange(fake.PlayerState.PAUSED);

    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('attachVideoTracker — onProgress', () => {
  it('émet 25/50/75 dans l\'ordre au franchissement', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onProgress = vi.fn();
    await attachVideoTracker(iframe, { onProgress });
    fake.__lastPlayer!.__setDuration(100);
    fake.__triggerReady();

    fake.__lastPlayer!.__setCurrentTime(30);
    vi.advanceTimersByTime(600);
    expect(onProgress).toHaveBeenCalledWith(25);

    fake.__lastPlayer!.__setCurrentTime(60);
    vi.advanceTimersByTime(600);
    expect(onProgress).toHaveBeenCalledWith(50);

    fake.__lastPlayer!.__setCurrentTime(80);
    vi.advanceTimersByTime(600);
    expect(onProgress).toHaveBeenCalledWith(75);

    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  it('ne ré-émet pas un palier déjà franchi (même si on rejoue)', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onProgress = vi.fn();
    await attachVideoTracker(iframe, { onProgress });
    fake.__lastPlayer!.__setDuration(100);
    fake.__triggerReady();

    fake.__lastPlayer!.__setCurrentTime(30);
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(600);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(25);
  });

  it('force tous les paliers manqués au passage en ENDED', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    await attachVideoTracker(iframe, { onProgress, onComplete });
    fake.__lastPlayer!.__setDuration(100);
    fake.__triggerReady();

    // currentTime saute directement à la fin (skip via seek)
    fake.__lastPlayer!.__triggerStateChange(fake.PlayerState.ENDED);

    expect(onProgress).toHaveBeenCalledWith(25);
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(75);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('ne plante pas si getDuration retourne 0 (pas encore prêt)', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onProgress = vi.fn();
    await attachVideoTracker(iframe, { onProgress });
    fake.__lastPlayer!.__setDuration(0);
    fake.__triggerReady();

    fake.__lastPlayer!.__setCurrentTime(30);
    vi.advanceTimersByTime(600);

    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe('attachVideoTracker — onCurrentTime + onReady', () => {
  it('appelle onReady avec le player à la première dispo', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onReady = vi.fn();
    await attachVideoTracker(iframe, { onReady });
    fake.__triggerReady();

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0]![0]).toBe(fake.__lastPlayer);
  });

  it('appelle onCurrentTime toutes les ~500 ms tant que ready', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onCurrentTime = vi.fn();
    await attachVideoTracker(iframe, { onCurrentTime });
    fake.__lastPlayer!.__setDuration(100);
    fake.__triggerReady();

    fake.__lastPlayer!.__setCurrentTime(12);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);

    expect(onCurrentTime).toHaveBeenCalled();
    expect(onCurrentTime).toHaveBeenLastCalledWith(12);
  });
});

describe('attachVideoTracker — cleanup', () => {
  it('arrête le polling à detach()', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const onCurrentTime = vi.fn();
    const detach = await attachVideoTracker(iframe, { onCurrentTime });
    fake.__triggerReady();

    fake.__lastPlayer!.__setCurrentTime(5);
    vi.advanceTimersByTime(600);
    const callsBeforeDetach = onCurrentTime.mock.calls.length;

    detach();

    vi.advanceTimersByTime(2000);
    expect(onCurrentTime.mock.calls.length).toBe(callsBeforeDetach);
  });

  it('appelle player.destroy() à detach()', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const detach = await attachVideoTracker(iframe, {});
    fake.__triggerReady();
    const destroySpy = fake.__lastPlayer!.destroy;

    detach();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('ne crashe pas si destroy() lève', async () => {
    const fake = installFakeYT();
    const iframe = makeIframe();
    const detach = await attachVideoTracker(iframe, {});
    fake.__triggerReady();
    (fake.__lastPlayer!.destroy as any).mockImplementation(() => {
      throw new Error('detached');
    });

    expect(() => detach()).not.toThrow();
  });
});
