/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => {
  const R = require('react');
  const icon = (name: string) => (props: Record<string, any>) =>
    R.createElement('span', { 'data-testid': `icon-${name}`, ...props }, name);
  return {
    ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'),
    Zap: icon('Zap'),
    Timer: icon('Timer'),
    Crown: icon('Crown'),
    Settings: icon('Settings'),
  };
});

import { AdvancedParams } from '../AdvancedParams';
import type { AdvancedParamsProps } from '../AdvancedParams';

function defaultProps(overrides?: Partial<AdvancedParamsProps>): AdvancedParamsProps {
  return {
    modelPreset: 'auto',
    customModel: '',
    onPresetChange: vi.fn(),
    onCustomModelChange: vi.fn(),
    temperature: 0.7,
    onTemperatureChange: vi.fn(),
    maxTokens: 4096,
    onMaxTokensChange: vi.fn(),
    imageEnabled: false,
    onImageEnabledChange: vi.fn(),
    imageModel: 'flux_2',
    onImageModelChange: vi.fn(),
    videoEnabled: false,
    onVideoEnabledChange: vi.fn(),
    videoModel: 'cinematic_studio_3_0',
    onVideoModelChange: vi.fn(),
    reviewEnabled: false,
    onReviewEnabledChange: vi.fn(),
    ...overrides,
  };
}

function collapsePanel() {
  fireEvent.click(screen.getByText('Paramètres avancés'));
}

describe('AdvancedParams', () => {
  describe('Collapsible behavior', () => {
    it('renders "Paramètres avancés" header', () => {
      render(<AdvancedParams {...defaultProps()} />);
      expect(screen.getByText('Paramètres avancés')).toBeInTheDocument();
    });

    it('content is visible by default (open)', () => {
      render(<AdvancedParams {...defaultProps()} />);
      expect(screen.getByText('Modèle texte')).toBeInTheDocument();
    });

    it('clicking header collapses the content', () => {
      render(<AdvancedParams {...defaultProps()} />);
      collapsePanel();
      expect(screen.queryByText('Modèle texte')).not.toBeInTheDocument();
    });

    it('clicking header again re-opens the content', () => {
      render(<AdvancedParams {...defaultProps()} />);
      collapsePanel();
      expect(screen.queryByText('Modèle texte')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Paramètres avancés'));
      expect(screen.getByText('Modèle texte')).toBeInTheDocument();
    });

    it('aria-expanded is true when open, false when collapsed', () => {
      render(<AdvancedParams {...defaultProps()} />);
      const header = screen.getByText('Paramètres avancés').closest('button')!;
      expect(header.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(header);
      expect(header.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Model preset section', () => {
    it('shows 4 preset cards when open: Auto, Rapide, Premium, Custom', () => {
      render(<AdvancedParams {...defaultProps()} />);

      expect(screen.getByText('Auto')).toBeInTheDocument();
      expect(screen.getByText('Rapide')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('clicking a preset calls onPresetChange', () => {
      const onPresetChange = vi.fn();
      render(<AdvancedParams {...defaultProps({ onPresetChange })} />);

      fireEvent.click(screen.getByText('Premium'));
      expect(onPresetChange).toHaveBeenCalledWith('premium');
    });

    it('when Custom is selected, shows text input for model name', () => {
      render(<AdvancedParams {...defaultProps({ modelPreset: 'custom', customModel: '' })} />);

      expect(screen.getByLabelText('Nom du modèle personnalisé')).toBeInTheDocument();
    });

    it('custom input calls onCustomModelChange on change', () => {
      const onCustomModelChange = vi.fn();
      render(
        <AdvancedParams
          {...defaultProps({ modelPreset: 'custom', customModel: '', onCustomModelChange })}
        />,
      );

      const input = screen.getByLabelText('Nom du modèle personnalisé');
      fireEvent.change(input, { target: { value: 'gpt-4-turbo' } });
      expect(onCustomModelChange).toHaveBeenCalledWith('gpt-4-turbo');
    });
  });

  describe('Temperature slider', () => {
    it('range slider is present when open', () => {
      render(<AdvancedParams {...defaultProps()} />);

      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('shows current temperature value', () => {
      render(<AdvancedParams {...defaultProps({ temperature: 1.3 })} />);

      expect(screen.getByText('1.3')).toBeInTheDocument();
    });

    it('calls onTemperatureChange when slider changes', () => {
      const onTemperatureChange = vi.fn();
      render(<AdvancedParams {...defaultProps({ onTemperatureChange })} />);

      fireEvent.change(screen.getByRole('slider'), { target: { value: '1.5' } });
      expect(onTemperatureChange).toHaveBeenCalledWith(1.5);
    });

    it('shows "Précis" and "Créatif" labels', () => {
      render(<AdvancedParams {...defaultProps()} />);

      expect(screen.getByText('Précis')).toBeInTheDocument();
      expect(screen.getByText('Créatif')).toBeInTheDocument();
    });
  });

  describe('Max tokens input', () => {
    it('number input is present when open', () => {
      render(<AdvancedParams {...defaultProps()} />);

      const input = screen.getByLabelText('Tokens maximum') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('number');
    });

    it('calls onMaxTokensChange when value changes', () => {
      const onMaxTokensChange = vi.fn();
      render(<AdvancedParams {...defaultProps({ onMaxTokensChange })} />);

      fireEvent.change(screen.getByLabelText('Tokens maximum'), { target: { value: '8192' } });
      expect(onMaxTokensChange).toHaveBeenCalledWith(8192);
    });
  });

  describe('Image generation toggle', () => {
    it('toggle switch exists', () => {
      render(<AdvancedParams {...defaultProps()} />);

      expect(screen.getByLabelText("Activer la génération d'images")).toBeInTheDocument();
    });

    it('clicking toggle calls onImageEnabledChange', () => {
      const onImageEnabledChange = vi.fn();
      render(<AdvancedParams {...defaultProps({ onImageEnabledChange })} />);

      fireEvent.click(screen.getByLabelText("Activer la génération d'images"));
      expect(onImageEnabledChange).toHaveBeenCalledWith(true);
    });

    it('when enabled, shows image model input', () => {
      render(<AdvancedParams {...defaultProps({ imageEnabled: true })} />);

      expect(screen.getByLabelText("Modèle de génération d'images")).toBeInTheDocument();
    });

    it('when disabled, hides image model input', () => {
      render(<AdvancedParams {...defaultProps({ imageEnabled: false })} />);

      expect(screen.queryByLabelText("Modèle de génération d'images")).not.toBeInTheDocument();
    });

    it('image model input calls onImageModelChange', () => {
      const onImageModelChange = vi.fn();
      render(
        <AdvancedParams {...defaultProps({ imageEnabled: true, onImageModelChange })} />,
      );

      fireEvent.change(screen.getByLabelText("Modèle de génération d'images"), {
        target: { value: 'dall-e-3' },
      });
      expect(onImageModelChange).toHaveBeenCalledWith('dall-e-3');
    });
  });

  describe('Video generation toggle', () => {
    it('toggle switch exists', () => {
      render(<AdvancedParams {...defaultProps()} />);

      expect(screen.getByLabelText('Activer la génération vidéo')).toBeInTheDocument();
    });

    it('clicking toggle calls onVideoEnabledChange', () => {
      const onVideoEnabledChange = vi.fn();
      render(<AdvancedParams {...defaultProps({ onVideoEnabledChange })} />);

      fireEvent.click(screen.getByLabelText('Activer la génération vidéo'));
      expect(onVideoEnabledChange).toHaveBeenCalledWith(true);
    });

    it('when enabled, shows video model input', () => {
      render(<AdvancedParams {...defaultProps({ videoEnabled: true })} />);

      expect(screen.getByLabelText('Modèle de génération vidéo')).toBeInTheDocument();
    });

    it('when disabled, hides video model input', () => {
      render(<AdvancedParams {...defaultProps({ videoEnabled: false })} />);

      expect(screen.queryByLabelText('Modèle de génération vidéo')).not.toBeInTheDocument();
    });
  });

  describe('Review (HITL) toggle', () => {
    it('toggle switch exists with description text', () => {
      render(<AdvancedParams {...defaultProps()} />);

      expect(screen.getByLabelText('Activer la revue humaine')).toBeInTheDocument();
      expect(
        screen.getByText('Soumettre le contenu pour approbation avant publication'),
      ).toBeInTheDocument();
    });

    it('clicking toggle calls onReviewEnabledChange', () => {
      const onReviewEnabledChange = vi.fn();
      render(<AdvancedParams {...defaultProps({ onReviewEnabledChange })} />);

      fireEvent.click(screen.getByLabelText('Activer la revue humaine'));
      expect(onReviewEnabledChange).toHaveBeenCalledWith(true);
    });
  });
});
