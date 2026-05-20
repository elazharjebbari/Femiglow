/**
 * Tests `VideoIFrameTracker` — composant qui attache le YT.Player tracker.
 *
 * Stratégie : mock complet de `lib/video/iframe-tracker` pour capturer
 * les callbacks passés à `attachVideoTracker` et les déclencher manuellement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { useRef, useEffect } from 'react';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));

type Callbacks = {
  onReady?: (player: { getDuration: () => number; getCurrentTime: () => number }) => void;
  onCurrentTime?: (s: number) => void;
  onProgress?: (pct: 25 | 50 | 75) => void;
  onComplete?: () => void;
};

let capturedCallbacks: Callbacks | null = null;
const detachMock = vi.fn();

const attachVideoTrackerMock = vi.fn(async (_iframe: HTMLIFrameElement, cbs: Callbacks) => {
  capturedCallbacks = cbs;
  return detachMock;
});

vi.mock('@/lib/video/iframe-tracker', () => ({
  attachVideoTracker: (...args: any[]) => (attachVideoTrackerMock as any)(...args),
}));

import { VideoIFrameTracker } from './VideoIFrameTracker';

function Harness({
  onCurrentTime,
  onDuration,
  videoId = 'rituel-4-gestes',
}: {
  onCurrentTime?: (s: number) => void;
  onDuration?: (s: number) => void;
  videoId?: string;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  // Force-create un iframe DOM pour que ref.current ne soit pas null.
  useEffect(() => {
    if (!ref.current) {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      ref.current = iframe;
    }
  }, []);
  return (
    <>
      <iframe ref={ref} title="t" />
      <VideoIFrameTracker
        iframeRef={ref}
        videoId={videoId}
        onCurrentTime={onCurrentTime}
        onDuration={onDuration}
      />
    </>
  );
}

beforeEach(() => {
  capturedCallbacks = null;
  attachVideoTrackerMock.mockClear();
  detachMock.mockClear();
  emitMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('VideoIFrameTracker — attach + tracking', () => {
  it('attache le tracker quand l\'iframe existe', async () => {
    render(<Harness />);
    await waitFor(() => expect(attachVideoTrackerMock).toHaveBeenCalledTimes(1));
  });

  it('émet video_progress_25/50/75 quand onProgress fire', async () => {
    render(<Harness />);
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    capturedCallbacks!.onProgress!(25);
    capturedCallbacks!.onProgress!(50);
    capturedCallbacks!.onProgress!(75);

    expect(emitMock).toHaveBeenCalledWith('video_progress_25', {
      video_id: 'rituel-4-gestes',
      video_provider: 'youtube',
    });
    expect(emitMock).toHaveBeenCalledWith('video_progress_50', {
      video_id: 'rituel-4-gestes',
      video_provider: 'youtube',
    });
    expect(emitMock).toHaveBeenCalledWith('video_progress_75', {
      video_id: 'rituel-4-gestes',
      video_provider: 'youtube',
    });
  });

  it('émet video_complete quand onComplete fire', async () => {
    render(<Harness />);
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    capturedCallbacks!.onComplete!();

    expect(emitMock).toHaveBeenCalledWith('video_complete', {
      video_id: 'rituel-4-gestes',
      video_provider: 'youtube',
      video_title: 'Rituel — 4 gestes',
    });
  });

  it('propage onCurrentTime via le prop callback', async () => {
    const onCurrentTime = vi.fn();
    render(<Harness onCurrentTime={onCurrentTime} />);
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    capturedCallbacks!.onCurrentTime!(42);

    expect(onCurrentTime).toHaveBeenCalledWith(42);
  });

  it('propage onDuration via player.getDuration au ready', async () => {
    const onDuration = vi.fn();
    render(<Harness onDuration={onDuration} />);
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    capturedCallbacks!.onReady!({
      getDuration: () => 90,
      getCurrentTime: () => 0,
    });

    expect(onDuration).toHaveBeenCalledWith(90);
  });

  it('n\'appelle pas onDuration si getDuration retourne 0', async () => {
    const onDuration = vi.fn();
    render(<Harness onDuration={onDuration} />);
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    capturedCallbacks!.onReady!({
      getDuration: () => 0,
      getCurrentTime: () => 0,
    });

    expect(onDuration).not.toHaveBeenCalled();
  });
});

describe('VideoIFrameTracker — cleanup', () => {
  it('appelle detach() à l\'unmount', async () => {
    const { unmount } = render(<Harness />);
    await waitFor(() => expect(attachVideoTrackerMock).toHaveBeenCalledTimes(1));

    unmount();
    await waitFor(() => expect(detachMock).toHaveBeenCalledTimes(1));
  });
});

describe('VideoIFrameTracker — graceful degradation', () => {
  it('ne throw pas si attachVideoTracker rejette (ad-blocker)', async () => {
    attachVideoTrackerMock.mockImplementationOnce(async () => {
      throw new Error('IFrame API load timeout');
    });

    expect(() => render(<Harness />)).not.toThrow();
    // L'erreur est silencieuse — pas d'emit, pas de crash.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(emitMock).not.toHaveBeenCalled();
  });
});
