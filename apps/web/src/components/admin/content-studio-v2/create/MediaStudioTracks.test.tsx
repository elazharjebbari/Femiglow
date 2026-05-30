import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { MediaStudioTracks } from './MediaStudioTracks';

/**
 * MP-VO/SU/CO UI (BUG-004) — the tracks panel calls the per-draft routes.
 * Routes are intercepted by MSW (the panel's own fetches). The voice-over
 * section auto-suggests an editable narration on mount (GET voiceover-script).
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const DRAFT = 'cd_ui_1';

// The panel fetches a suggested narration on mount — every test needs it mocked.
beforeEach(() => {
  server.use(
    http.get(`/api/admin/content-studio/drafts/${DRAFT}/voiceover-script`, () =>
      HttpResponse.json({ script: 'Le rituel FemiGlow, un geste lent et apaisant.' }),
    ),
  );
});

describe('MediaStudioTracks', () => {
  it('renders the editable narration + the three track actions', () => {
    render(<MediaStudioTracks draftId={DRAFT} />);
    expect(screen.getByText('Studio média')).toBeTruthy();
    expect(document.querySelector('[data-cs-voiceover-script]')).toBeTruthy();
    expect(document.querySelector('[data-cs-voiceover-suggest]')).toBeTruthy();
    expect(document.querySelector('[data-cs-generate-voiceover]')).toBeTruthy();
    expect(document.querySelector('[data-cs-generate-subtitles]')).toBeTruthy();
    expect(document.querySelector('[data-cs-compose]')).toBeTruthy();
  });

  it('prefills the narration from the suggestion on mount', async () => {
    render(<MediaStudioTracks draftId={DRAFT} />);
    const ta = document.querySelector('[data-cs-voiceover-script]') as HTMLTextAreaElement;
    await waitFor(() => expect(ta.value).toContain('Le rituel FemiGlow'));
  });

  it('generate is disabled until there is narration text', async () => {
    server.use(
      http.get(`/api/admin/content-studio/drafts/${DRAFT}/voiceover-script`, () =>
        HttpResponse.json({ script: '' }),
      ),
    );
    render(<MediaStudioTracks draftId={DRAFT} />);
    const btn = document.querySelector('[data-cs-generate-voiceover]') as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(true));
  });

  it('generates a voice-over from the edited text and shows the player + used script', async () => {
    let sentScript: unknown = null;
    server.use(
      http.post(`/api/admin/content-studio/drafts/${DRAFT}/generate-voiceover`, async ({ request }) => {
        sentScript = ((await request.json()) as { script?: string }).script;
        return HttpResponse.json({
          media: {
            id: 'me_vo',
            previewUrl: '/_media/ai-engine/voiceover-x.wav',
            provider: 'mock',
            voice: 'mock',
            durationSec: 4,
            script: 'Texte personnalisé de la voix-off.',
          },
        });
      }),
    );
    render(<MediaStudioTracks draftId={DRAFT} />);
    const ta = document.querySelector('[data-cs-voiceover-script]') as HTMLTextAreaElement;
    await waitFor(() => expect(ta.value.length).toBeGreaterThan(0));
    fireEvent.change(ta, { target: { value: 'Texte personnalisé de la voix-off.' } });
    fireEvent.click(document.querySelector('[data-cs-generate-voiceover]')!);
    await waitFor(() => expect(document.querySelector('[data-cs-voiceover-player]')).toBeTruthy());
    expect(sentScript).toBe('Texte personnalisé de la voix-off.');
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
