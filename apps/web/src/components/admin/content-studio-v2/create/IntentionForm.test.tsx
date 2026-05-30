/**
 * Tests for IntentionForm — the cadrage panel that lets the user pick
 * format / pillar / objective / platform and write a prompt, then POST
 * the resulting idea.
 */

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { IntentionForm } from './IntentionForm';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('IntentionForm', () => {
  it('renders a format radio group with 4 options', () => {
    render(<IntentionForm />);
    const radiogroup = screen.getByRole('radiogroup', { name: /Format de contenu/i });
    expect(radiogroup).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('clicking a format radio sets aria-checked', () => {
    render(<IntentionForm />);
    const reelRadio = screen.getByRole('radio', { name: /Reel/i });
    expect(reelRadio).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(reelRadio);
    expect(reelRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('renders pillar, objective, platform selects', () => {
    render(<IntentionForm />);
    // The <select> elements are inside <label> with text
    expect(screen.getByLabelText(/Pilier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Objectif/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Plateforme/i)).toBeInTheDocument();
  });

  it('renders prompt textarea and accepts input', () => {
    render(<IntentionForm />);
    const textarea = screen.getByLabelText(/Intention/i);
    expect(textarea).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'Mon nouveau prompt test' } });
    expect(textarea).toHaveValue('Mon nouveau prompt test');
  });

  it('submit with empty prompt shows validation error', async () => {
    render(<IntentionForm />);
    const textarea = screen.getByLabelText(/Intention/i);
    // Clear the prompt (default has text, need to make it short enough to fail min(8))
    fireEvent.change(textarea, { target: { value: '' } });
    const submitBtn = screen.getByRole('button', { name: /Enregistrer/i });
    fireEvent.click(submitBtn);
    // The zod schema requires min(8) chars for prompt — empty fails
    await waitFor(() => {
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('submit with valid data calls onCreated callback', async () => {
    const onCreated = vi.fn();
    server.use(
      http.post('/api/admin/content-studio/ideas', async () => {
        return HttpResponse.json({
          idea: {
            id: 'idea_new',
            campaignId: null,
            pillar: 'rituel',
            objective: 'consideration',
            platform: 'instagram',
            format: 'post',
            prompt: 'Prompt test long enough',
            sourceType: null,
            sourceRef: null,
            rejectionReason: null,
            status: 'idea',
            createdBy: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        });
      }),
    );
    render(<IntentionForm onCreated={onCreated} />);
    const textarea = screen.getByLabelText(/Intention/i);
    fireEvent.change(textarea, { target: { value: 'Prompt test long enough for validation' } });
    const submitBtn = screen.getByRole('button', { name: /Enregistrer/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledOnce();
    });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'idea_new' }),
      undefined, // CS v2 Phase 2 — second arg is the chosen model id (undefined = use suggestion)
    );
  });

  it('disabled prop disables the submit button', () => {
    render(<IntentionForm disabled />);
    const submitBtn = screen.getByRole('button', { name: /Enregistrer/i });
    expect(submitBtn).toBeDisabled();
  });

  it('onFormatChange is called when a format radio is clicked', () => {
    const onFormatChange = vi.fn();
    render(<IntentionForm onFormatChange={onFormatChange} />);
    const storyRadio = screen.getByRole('radio', { name: /Story/i });
    fireEvent.click(storyRadio);
    expect(onFormatChange).toHaveBeenCalledWith('story');
  });

  describe('format media support badges', () => {
    it('renders the correct media support badge for each format', () => {
      const { container } = render(<IntentionForm />);
      const post = container.querySelector('[data-format="post"] [data-cs-media-support]');
      const story = container.querySelector('[data-format="story"] [data-cs-media-support]');
      const reel = container.querySelector('[data-format="reel"] [data-cs-media-support]');
      const carousel = container.querySelector(
        '[data-format="carousel"] [data-cs-media-support]',
      );
      expect(post?.getAttribute('data-cs-media-support')).toBe('image');
      expect(story?.getAttribute('data-cs-media-support')).toBe('both');
      expect(reel?.getAttribute('data-cs-media-support')).toBe('video');
      expect(carousel?.getAttribute('data-cs-media-support')).toBe('image');
    });

    it('post badge says "Image"', () => {
      const { container } = render(<IntentionForm />);
      const badge = container.querySelector('[data-format="post"] [data-cs-media-support]');
      expect(badge?.textContent).toMatch(/Image/);
    });

    it('reel badge says "Vidéo"', () => {
      const { container } = render(<IntentionForm />);
      const badge = container.querySelector('[data-format="reel"] [data-cs-media-support]');
      expect(badge?.textContent).toMatch(/Vidéo/);
    });

    it('story badge says "Image + Vidéo"', () => {
      const { container } = render(<IntentionForm />);
      const badge = container.querySelector('[data-format="story"] [data-cs-media-support]');
      expect(badge?.textContent).toMatch(/Image \+ Vidéo/);
    });

    it('carousel badge says "Image"', () => {
      const { container } = render(<IntentionForm />);
      const badge = container.querySelector('[data-format="carousel"] [data-cs-media-support]');
      expect(badge?.textContent).toMatch(/Image/);
    });
  });
});
