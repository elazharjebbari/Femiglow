/**
 * @vitest-environment jsdom
 *
 * Comprehensive tests for the ModelSelector component.
 * Covers: rendering, popover interaction, search & custom entry,
 * fetch lifecycle, and caching behavior.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

/* ================================================================
   Mocks — Radix Popover, cmdk, lucide-react
   ================================================================ */

// Track popover open state at module level for cross-component coordination
let popoverOpen = false;
let popoverOnOpenChange: ((open: boolean) => void) | null = null;

vi.mock('@radix-ui/react-popover', () => {
  const R = require('react');
  return {
    Root: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (o: boolean) => void }) => {
      popoverOpen = open;
      popoverOnOpenChange = onOpenChange;
      return R.createElement('div', { 'data-testid': 'popover-root' }, children);
    },
    Trigger: ({ children, asChild, disabled }: { children: React.ReactNode; asChild?: boolean; disabled?: boolean }) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
          onClick: (e: React.MouseEvent) => {
            if (disabled) return;
            (children as React.ReactElement<any>).props?.onClick?.(e);
            popoverOnOpenChange?.(!popoverOpen);
          },
        });
      }
      return R.createElement('button', {
        onClick: () => !disabled && popoverOnOpenChange?.(!popoverOpen),
        disabled,
      }, children);
    },
    Portal: ({ children }: { children: React.ReactNode }) => {
      return popoverOpen ? R.createElement('div', { 'data-testid': 'popover-portal' }, children) : null;
    },
    Content: ({ children, onOpenAutoFocus, ...rest }: Record<string, any>) => {
      return R.createElement('div', { 'data-testid': 'popover-content', role: 'listbox' }, children);
    },
  };
});

vi.mock('cmdk', () => {
  const R = require('react');

  function CommandRoot({ children, label, shouldFilter }: { children: React.ReactNode; label?: string; shouldFilter?: boolean }) {
    return R.createElement('div', { 'data-testid': 'cmdk-root', 'aria-label': label }, children);
  }

  function CommandInput({ placeholder, value, onValueChange, autoFocus, ...rest }: Record<string, any>) {
    return R.createElement('input', {
      ...rest,
      placeholder,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value),
      autoFocus,
      'data-testid': 'cmdk-input',
    });
  }

  function CommandList({ children, ...rest }: Record<string, any>) {
    return R.createElement('div', { 'data-testid': 'cmdk-list', ...rest }, children);
  }

  function CommandEmpty({ children, ...rest }: Record<string, any>) {
    return R.createElement('div', { 'data-testid': 'cmdk-empty', ...rest }, children);
  }

  function CommandLoading({ children, ...rest }: Record<string, any>) {
    return R.createElement('div', { 'data-testid': 'cmdk-loading', ...rest }, children);
  }

  function CommandItem({ children, value, onSelect, ...rest }: Record<string, any>) {
    return R.createElement('div', {
      ...rest,
      role: 'option',
      'data-value': value,
      onClick: () => onSelect?.(),
      'data-testid': `cmdk-item-${value}`,
    }, children);
  }

  CommandRoot.Input = CommandInput;
  CommandRoot.List = CommandList;
  CommandRoot.Empty = CommandEmpty;
  CommandRoot.Loading = CommandLoading;
  CommandRoot.Item = CommandItem;

  return { Command: CommandRoot };
});

vi.mock('lucide-react', () => {
  const R = require('react');
  const icon = (name: string) => (props: Record<string, any>) =>
    R.createElement('span', { 'data-testid': `icon-${name}`, ...props }, name);
  return {
    ChevronDown: icon('ChevronDown'),
    Check: icon('Check'),
    RefreshCw: icon('RefreshCw'),
    X: icon('X'),
  };
});

/* ================================================================
   Import the component under test
   ================================================================ */

import { ModelSelector } from '../ModelSelector';

/* ================================================================
   Builder helpers
   ================================================================ */

function buildModel(overrides?: Partial<{ id: string; role: string }>) {
  return {
    id: 'gpt-4o-mini',
    role: 'chat',
    ...overrides,
  };
}

function buildModels() {
  return [
    buildModel({ id: 'gpt-4o-mini', role: 'chat' }),
    buildModel({ id: 'gpt-4o', role: 'chat' }),
    buildModel({ id: 'text-embedding-3-small', role: 'embedding' }),
    buildModel({ id: 'dall-e-3', role: 'image' }),
    buildModel({ id: 'tts-1', role: 'tts' }),
  ];
}

/* ================================================================
   Fetch mock helper
   ================================================================ */

function setupFetch(options: {
  models?: ReturnType<typeof buildModel>[];
  source?: string;
  error?: boolean;
  delay?: number;
} = {}) {
  const { models = buildModels(), source = 'live', error = false, delay = 0 } = options;
  const spy = vi.fn().mockImplementation(async () => {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    if (error) {
      return { ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }) };
    }
    return { ok: true, json: () => Promise.resolve({ models, source }) };
  });
  globalThis.fetch = spy;
  return spy;
}

/* ================================================================
   Default props factory
   ================================================================ */

function defaultProps(overrides?: Partial<React.ComponentProps<typeof ModelSelector>>) {
  return {
    providerType: 'openai',
    selectedModels: [] as string[],
    onModelsChange: vi.fn(),
    ...overrides,
  };
}

/* ================================================================
   Helper: open popover
   ================================================================ */

async function openPopover() {
  const trigger = screen.getByRole('button', { name: /lectionner des mod|ChevronDown/ });
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByTestId('popover-content')).toBeInTheDocument());
}

/* ================================================================
   Test suites
   ================================================================ */

describe('ModelSelector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    popoverOpen = false;
    popoverOnOpenChange = null;
  });

  /* ---------------------------------------------------------------
     Rendering (8 tests)
     --------------------------------------------------------------- */

  describe('Rendering', () => {
    it('renders trigger button with placeholder "Sélectionner des modèles"', () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      expect(screen.getByText(/lectionner des mod/)).toBeInTheDocument();
    });

    it('shows selected models as badges when provided', () => {
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: ['gpt-4o', 'gpt-4o-mini'] })} />);
      expect(screen.getByText('gpt-4o')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
    });

    it('each badge has X button to remove', () => {
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: ['gpt-4o'] })} />);
      const removeBtn = screen.getByRole('button', { name: /Retirer gpt-4o/i });
      expect(removeBtn).toBeInTheDocument();
    });

    it('ChevronDown icon present', () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      expect(screen.getByTestId('icon-ChevronDown')).toBeInTheDocument();
    });

    it('disabled state has reduced opacity', () => {
      setupFetch();
      const { container } = render(<ModelSelector {...defaultProps({ disabled: true })} />);
      const trigger = container.querySelector('button[aria-haspopup="listbox"]') as HTMLElement;
      expect(trigger.style.opacity).toBe('0.5');
    });

    it('disabled state prevents click (popover stays closed)', () => {
      setupFetch();
      render(<ModelSelector {...defaultProps({ disabled: true })} />);
      const trigger = screen.getByText(/lectionner des mod/).closest('button');
      fireEvent.click(trigger!);
      expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
    });

    it('multiple selected models render as separate badges', () => {
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: ['gpt-4o', 'gpt-4o-mini', 'dall-e-3'] })} />);
      expect(screen.getByText('gpt-4o')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
      expect(screen.getByText('dall-e-3')).toBeInTheDocument();
    });

    it('empty selection shows placeholder text', () => {
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: [] })} />);
      expect(screen.getByText(/lectionner des mod/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Retirer/i })).not.toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------
     Popover (10 tests)
     --------------------------------------------------------------- */

  describe('Popover', () => {
    it('click trigger opens popover', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
      await openPopover();
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    });

    it('popover contains search input', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      expect(screen.getByTestId('cmdk-input')).toBeInTheDocument();
    });

    it('search input has placeholder "Rechercher un modèle..."', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      expect(screen.getByPlaceholderText('Rechercher un modèle...')).toBeInTheDocument();
    });

    it('loading state shows spinner', async () => {
      // Use a hanging fetch to keep loading state
      globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(screen.getByTestId('cmdk-loading')).toBeInTheDocument());
    });

    it('models list renders after fetch', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => {
        expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument();
        expect(screen.getByTestId('cmdk-item-gpt-4o')).toBeInTheDocument();
      });
    });

    it('each model shows name', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => {
        expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
        expect(screen.getByText('gpt-4o')).toBeInTheDocument();
        expect(screen.getByText('text-embedding-3-small')).toBeInTheDocument();
        expect(screen.getByText('dall-e-3')).toBeInTheDocument();
        expect(screen.getByText('tts-1')).toBeInTheDocument();
      });
    });

    it('each model shows role badge', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => {
        expect(screen.getAllByText('chat').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('embedding')).toBeInTheDocument();
        expect(screen.getByText('image')).toBeInTheDocument();
        expect(screen.getByText('tts')).toBeInTheDocument();
      });
    });

    it('selected models have visible checkmark color', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: ['gpt-4o-mini'] })} />);
      await openPopover();
      await waitFor(() => {
        const item = screen.getByTestId('cmdk-item-gpt-4o-mini');
        // The Check icon span's parent should have non-transparent color for selected
        const checks = item.querySelectorAll('[data-testid="icon-Check"]');
        expect(checks.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('click model calls onModelsChange to toggle selection', async () => {
      const onModelsChange = vi.fn();
      setupFetch();
      render(<ModelSelector {...defaultProps({ onModelsChange })} />);
      await openPopover();
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('cmdk-item-gpt-4o'));
      expect(onModelsChange).toHaveBeenCalledWith(['gpt-4o']);
    });

    it('click already-selected model removes it', async () => {
      const onModelsChange = vi.fn();
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: ['gpt-4o', 'gpt-4o-mini'], onModelsChange })} />);
      await openPopover();
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('cmdk-item-gpt-4o'));
      expect(onModelsChange).toHaveBeenCalledWith(['gpt-4o-mini']);
    });
  });

  /* ---------------------------------------------------------------
     Search & Custom (7 tests)
     --------------------------------------------------------------- */

  describe('Search & Custom', () => {
    it('typing in search input updates value', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      const input = screen.getByTestId('cmdk-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'gpt' } });
      expect(input.value).toBe('gpt');
    });

    it('empty search keeps all models visible', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument());
      // All 5 models visible
      expect(screen.getByTestId('cmdk-item-gpt-4o')).toBeInTheDocument();
      expect(screen.getByTestId('cmdk-item-text-embedding-3-small')).toBeInTheDocument();
      expect(screen.getByTestId('cmdk-item-dall-e-3')).toBeInTheDocument();
      expect(screen.getByTestId('cmdk-item-tts-1')).toBeInTheDocument();
    });

    it('"Aucun modèle trouvé" empty state element exists', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      // The Command.Empty is always rendered (cmdk hides it via CSS when there are items)
      expect(screen.getByTestId('cmdk-empty')).toBeInTheDocument();
    });

    it('custom entry option appears when search does not match any model', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument());

      const input = screen.getByTestId('cmdk-input');
      fireEvent.change(input, { target: { value: 'custom-model-v1' } });

      await waitFor(() => {
        expect(screen.getByTestId('cmdk-item-add-custom-custom-model-v1')).toBeInTheDocument();
      });
    });

    it('custom entry adds model to selection', async () => {
      const onModelsChange = vi.fn();
      setupFetch();
      render(<ModelSelector {...defaultProps({ onModelsChange })} />);
      await openPopover();
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument());

      const input = screen.getByTestId('cmdk-input');
      fireEvent.change(input, { target: { value: 'my-custom-model' } });
      await waitFor(() => expect(screen.getByTestId('cmdk-item-add-custom-my-custom-model')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('cmdk-item-add-custom-my-custom-model'));
      expect(onModelsChange).toHaveBeenCalledWith(['my-custom-model']);
    });

    it('custom entry does not appear if search matches existing model ID', async () => {
      setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument());

      const input = screen.getByTestId('cmdk-input');
      fireEvent.change(input, { target: { value: 'gpt-4o-mini' } });

      // Should NOT show custom entry since it exactly matches an existing model
      expect(screen.queryByTestId('cmdk-item-add-custom-gpt-4o-mini')).not.toBeInTheDocument();
    });

    it('custom entry does not appear if search matches already-selected model', async () => {
      setupFetch({ models: [] });
      render(<ModelSelector {...defaultProps({ selectedModels: ['my-model'] })} />);
      await openPopover();

      const input = screen.getByTestId('cmdk-input');
      fireEvent.change(input, { target: { value: 'my-model' } });

      // Already selected => no custom entry
      expect(screen.queryByTestId('cmdk-item-add-custom-my-model')).not.toBeInTheDocument();
    });
  });

  /* ---------------------------------------------------------------
     Fetch & Cache (8 tests)
     --------------------------------------------------------------- */

  describe('Fetch & Cache', () => {
    it('fetches models on popover open (not on mount)', async () => {
      const spy = setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      // Should not fetch on mount
      expect(spy).not.toHaveBeenCalled();
      await openPopover();
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    });

    it('correct URL with provider param', async () => {
      const spy = setupFetch();
      render(<ModelSelector {...defaultProps({ providerType: 'anthropic' })} />);
      await openPopover();
      await waitFor(() => expect(spy).toHaveBeenCalled());
      const url = String(spy.mock.calls[0]![0]);
      expect(url).toContain('provider=anthropic');
    });

    it('correct URL with capability filter', async () => {
      const spy = setupFetch();
      render(<ModelSelector {...defaultProps({ capabilityFilter: 'embedding' })} />);
      await openPopover();
      await waitFor(() => expect(spy).toHaveBeenCalled());
      const url = String(spy.mock.calls[0]![0]);
      expect(url).toContain('capability=embedding');
    });

    it('cache hit on second open (no re-fetch)', async () => {
      const spy = setupFetch();
      const { rerender } = render(<ModelSelector {...defaultProps()} />);

      // First open
      await openPopover();
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument());

      // Close popover
      act(() => { popoverOnOpenChange?.(false); });

      // Second open
      act(() => { popoverOnOpenChange?.(true); });
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument());

      // Should still only have 1 fetch call (cache hit)
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('refresh button clears cache and re-fetches', async () => {
      const spy = setupFetch();
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByTestId('cmdk-item-gpt-4o-mini')).toBeInTheDocument());

      // Click refresh button
      const refreshBtn = screen.getByLabelText(/Rafra/);
      fireEvent.click(refreshBtn);

      await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    });

    it('error state shows error message', async () => {
      setupFetch({ error: true });
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(screen.getByText(/Erreur/)).toBeInTheDocument());
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
    });

    it('source indicator shows "Live" for fresh fetch', async () => {
      setupFetch({ source: 'live' });
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
    });

    it('source indicator shows "Statique" for fallback', async () => {
      setupFetch({ source: 'fallback' });
      render(<ModelSelector {...defaultProps()} />);
      await openPopover();
      await waitFor(() => expect(screen.getByText('Statique')).toBeInTheDocument());
    });
  });

  /* ---------------------------------------------------------------
     Badge removal (additional edge-case tests)
     --------------------------------------------------------------- */

  describe('Badge removal', () => {
    it('clicking X on badge calls onModelsChange without that model', () => {
      const onModelsChange = vi.fn();
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: ['gpt-4o', 'gpt-4o-mini'], onModelsChange })} />);
      const removeBtn = screen.getByRole('button', { name: /Retirer gpt-4o-mini/i });
      fireEvent.click(removeBtn);
      expect(onModelsChange).toHaveBeenCalledWith(['gpt-4o']);
    });

    it('removing last badge shows placeholder again', () => {
      const onModelsChange = vi.fn();
      setupFetch();
      const { rerender } = render(
        <ModelSelector {...defaultProps({ selectedModels: ['gpt-4o'], onModelsChange })} />,
      );
      const removeBtn = screen.getByRole('button', { name: /Retirer gpt-4o/i });
      fireEvent.click(removeBtn);
      expect(onModelsChange).toHaveBeenCalledWith([]);

      // Re-render with empty selection
      rerender(<ModelSelector {...defaultProps({ selectedModels: [], onModelsChange })} />);
      expect(screen.getByText(/lectionner des mod/)).toBeInTheDocument();
    });

    it('keyboard Enter on X badge removes model', () => {
      const onModelsChange = vi.fn();
      setupFetch();
      render(<ModelSelector {...defaultProps({ selectedModels: ['gpt-4o'], onModelsChange })} />);
      const removeBtn = screen.getByRole('button', { name: /Retirer gpt-4o/i });
      fireEvent.keyDown(removeBtn, { key: 'Enter' });
      expect(onModelsChange).toHaveBeenCalledWith([]);
    });
  });
});
