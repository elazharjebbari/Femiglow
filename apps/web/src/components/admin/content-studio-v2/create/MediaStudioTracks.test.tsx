import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { MediaStudioTracks } from './MediaStudioTracks';

/**
 * MP-VO/SU/CO UI (BUG-004) — the tracks panel calls the three per-draft routes.
 * Routes are intercepted by MSW (the panel's own fetches).
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const DRAFT = 'cd_ui_1';

describe('MediaStudioTracks', () => {
  it('renders the three track actions', () => {
    render(<MediaStudioTracks draftId={DRAFT} />);
    expect(screen.getByText('Studio média')).toBeTruthy();
    expect(document.querySelector('[data-cs-generate-voiceover]')).toBeTruthy();
    expect(document.querySelector('[data-cs-generate-subtitles]')).toBeTruthy();
    expect(document.querySelector('[data-cs-compose]')).toBeTruthy();
  });

  it('generates a voice-over and shows the audio player', async () => {
    server.use(
      http.post(`/api/admin/content-studio/drafts/${DRAFT}/generate-voiceover`, () =>
        HttpResponse.json({
          media: { id: 'me_vo', previewUrl: '/_media/ai-engine/voiceover-x.wav', provider: 'mock', voice: 'mock', durationSec: 4 },
        }),
      ),
    );
    render(<MediaStudioTracks draftId={DRAFT} />);
    fireEvent.click(document.querySelector('[data-cs-generate-voiceover]')!);
    await waitFor(() => expect(document.querySelector('[data-cs-voiceover-player]')).toBeTruthy());
  });

  it('surfaces an API error inline', async () => {
    server.use(
      http.post(`/api/admin/content-studio/drafts/${DRAFT}/compose`, () =>
        HttpResponse.json({ error: { code: 'invalid_state', message: 'Aucune vidéo principale à monter.' } }, { status: 409 }),
      ),
    );
    render(<MediaStudioTracks draftId={DRAFT} />);
    fireEvent.click(document.querySelector('[data-cs-compose]')!);
    await waitFor(() => expect(screen.getByText('Aucune vidéo principale à monter.')).toBeTruthy());
  });

  it('composes and shows the track manifest', async () => {
    server.use(
      http.post(`/api/admin/content-studio/drafts/${DRAFT}/compose`, () =>
        HttpResponse.json({
          media: { id: 'me_co', previewUrl: '/x.mp4', hasVoiceover: true, hasMusic: false, hasSubtitles: true, durationSec: 5 },
        }),
      ),
    );
    render(<MediaStudioTracks draftId={DRAFT} />);
    fireEvent.click(document.querySelector('[data-cs-compose]')!);
    await waitFor(() => expect(document.querySelector('[data-cs-compose-manifest]')?.textContent).toContain('voix-off'));
    expect(document.querySelector('[data-cs-compose-manifest]')?.textContent).toContain('sous-titres');
  });
});
