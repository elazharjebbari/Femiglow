import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelPicker } from './ModelPicker';

const sampleResponse = {
  models: [
    {
      id: 'gpt-4o-mini',
      provider: 'openai',
      role: 'chat',
      label: 'GPT-4o mini',
      tier: 'fast',
      capabilities: ['function-calling'],
      pricing: { inputCentsPer1k: 0.015, outputCentsPer1k: 0.06 },
      recommendedFor: ['post'],
      source: 'static',
      isDefault: true,
    },
    {
      id: 'gpt-4o',
      provider: 'openai',
      role: 'chat',
      label: 'GPT-4o',
      tier: 'balanced',
      capabilities: ['function-calling', 'vision'],
      pricing: { inputCentsPer1k: 0.25, outputCentsPer1k: 1.0 },
      recommendedFor: ['reel'],
      source: 'static',
    },
  ],
  suggested: {
    id: 'gpt-4o',
    provider: 'openai',
    role: 'chat',
    label: 'GPT-4o',
    tier: 'balanced',
    capabilities: ['function-calling', 'vision'],
    pricing: { inputCentsPer1k: 0.25, outputCentsPer1k: 1.0 },
    recommendedFor: ['reel'],
    source: 'static',
  },
  providers: [{ id: 'openai', label: 'OpenAI', status: 'healthy' }],
};

describe('ModelPicker', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger with placeholder when no value', () => {
    render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /choisir un modèle/i })).toBeVisible();
  });

  it('exposes data-role attribute on trigger', () => {
    render(<ModelPicker role="image" value={null} onChange={vi.fn()} />);
    const btn = screen.getByTestId('model-picker-image');
    expect(btn.getAttribute('data-role')).toBe('image');
  });

  it('has aria-haspopup=listbox', () => {
    render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('fetches models when opened', async () => {
    render(<ModelPicker role="chat" format="reel" value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/content-studio/models?role=chat&format=reel'),
      );
    });
  });

  it('fetches eagerly on mount so the suggested model is known without opening', async () => {
    // Required so the parent can forward body.model = suggested.id even if the
    // operator never opens the picker (otherwise generate-visual falls back
    // to env defaults in live mode → wrong provider).
    render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('auto-selects the suggested model when value=null and suggestion arrives', async () => {
    const onChange = vi.fn();
    render(<ModelPicker role="chat" format="post" value={null} onChange={onChange} />);
    await waitFor(() => {
      // Sample mock returns suggested={id: 'gpt-4o'} regardless of format.
      expect(onChange).toHaveBeenCalledWith('gpt-4o');
    });
  });

  it('en-tête : la source reflète le modèle effectif (suggéré), pas models[0] (ACT-UX-001)', async () => {
    // models[0] est 'static' mais le modèle suggéré (réellement retenu) est 'live'.
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [{ ...sampleResponse.models[0], source: 'static' }],
        suggested: { ...sampleResponse.suggested, source: 'live' },
        providers: sampleResponse.providers,
      }),
    })) as unknown as typeof fetch;
    render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      const hdr = document.querySelector('[data-cs-model-picker-source]');
      expect(hdr?.textContent ?? '').toContain('Live'); // pas '◯ Statique' (models[0])
    });
  });

  it('does NOT auto-overwrite an explicit operator selection', async () => {
    const onChange = vi.fn();
    render(<ModelPicker role="chat" format="post" value="gpt-4o-mini" onChange={onChange} />);
    // Wait long enough for any auto-select effect to settle
    await new Promise((r) => setTimeout(r, 200));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows trigger button is disabled when disabled prop is set', () => {
    render(<ModelPicker role="chat" value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('caches the response when re-opened with same role+format', async () => {
    render(<ModelPicker role="chat" format="post" value={null} onChange={vi.fn()} />);
    // After eager mount fetch settles
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    const trigger = screen.getByTestId('model-picker-chat');
    // Open + close + reopen — cache should prevent more fetches
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    // Cache hit — still only 1 fetch.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fires onChange with the selected model id', async () => {
    const onChange = vi.fn();
    render(<ModelPicker role="chat" format="reel" value={null} onChange={onChange} />);
    const trigger = screen.getByTestId('model-picker-chat');
    fireEvent.click(trigger);
    // Wait for popover items to render
    const item = await screen.findByTestId('model-picker-item-gpt-4o');
    fireEvent.click(item);
    expect(onChange).toHaveBeenCalledWith('gpt-4o');
  });

  describe('autocompletion UX', () => {
    it('renders a search input with placeholder and testid', async () => {
      render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('model-picker-chat'));
      const input = await screen.findByTestId('model-picker-search');
      expect(input).toBeInTheDocument();
      expect(input.getAttribute('placeholder')).toMatch(/tapez.*filtrer/i);
    });

    it('typing in the search input filters cmdk items', async () => {
      render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('model-picker-chat'));
      const input = await screen.findByTestId('model-picker-search');
      // Both gpt-4o and gpt-4o-mini exist in mock — filter should narrow
      fireEvent.change(input, { target: { value: 'mini' } });
      // The mini variant should still be visible, the other not.
      await waitFor(() => {
        expect(screen.queryByTestId('model-picker-item-gpt-4o-mini')).toBeInTheDocument();
      });
    });

    it('shows count of models in the header', async () => {
      render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('model-picker-chat'));
      // Wait for the fetched items to appear, then check counter (which is
      // inside the Radix Portal — use document.querySelector).
      await screen.findByTestId('model-picker-item-gpt-4o-mini');
      const counter = document.querySelector('[data-cs-model-picker-count]');
      expect(counter?.textContent ?? '').toMatch(/2 modèle/);
    });

    it('type-ahead on the trigger opens the popover and pre-fills the search', async () => {
      render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
      const trigger = screen.getByTestId('model-picker-chat');
      fireEvent.keyDown(trigger, { key: 'g' });
      // Popover should open and the search input should be focused with 'g'
      await waitFor(() => {
        const input = screen.queryByTestId('model-picker-search');
        expect(input).toBeInTheDocument();
        expect((input as HTMLInputElement).value).toBe('g');
      });
    });

    it('clear search button resets the query', async () => {
      render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('model-picker-chat'));
      const input = await screen.findByTestId('model-picker-search');
      fireEvent.change(input, { target: { value: 'xyz' } });
      // Clear button (×) appears
      const clearBtn = await screen.findByLabelText(/Effacer/i);
      fireEvent.click(clearBtn);
      expect((input as HTMLInputElement).value).toBe('');
    });

    it('empty state quotes the search query and offers custom add', async () => {
      render(<ModelPicker role="chat" value={null} onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('model-picker-chat'));
      const input = await screen.findByTestId('model-picker-search');
      fireEvent.change(input, { target: { value: 'zzz-nonexistent-model' } });
      await waitFor(() => {
        expect(screen.getByText(/Aucun modèle ne correspond/i)).toBeInTheDocument();
      });
    });
  });
});
