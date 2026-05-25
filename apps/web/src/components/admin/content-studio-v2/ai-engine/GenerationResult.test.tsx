/**
 * Tests for GenerationResult — displays the generated content (script, caption,
 * hashtags, images, quality scores, cost breakdown) and action buttons.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  GenerationResult,
  type GenerationResultData,
  type BridgeResultData,
} from './GenerationResult';

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function buildResult(overrides?: Partial<GenerationResultData>): GenerationResultData {
  return {
    script: {
      hook: 'Saviez-vous que votre peau change en hiver ?',
      scenes: [
        { type: 'intro', text: 'Scene intro text', duration: '3s' },
        { type: 'body', text: 'Scene body text', duration: '5s' },
      ],
      cta: 'Decouvrez notre serum',
    },
    caption: 'Votre routine hivernale commence ici. Hydratation profonde garantie.',
    hashtags: ['skincare', 'hiver', 'routine'],
    images: ['/img/1.webp', '/img/2.webp'],
    qualityScores: {
      brand_alignment: 0.85,
      engagement_potential: 0.72,
      clarity: 0.91,
    },
    costBreakdown: [
      { label: 'LLM (script)', amountCents: 120 },
      { label: 'Image gen', amountCents: 230 },
    ],
    totalCostCents: 350,
    ...overrides,
  };
}

describe('GenerationResult', () => {
  it('renders script section with hook text', () => {
    render(<GenerationResult result={buildResult()} />);
    // The script section is collapsible and defaultOpen
    expect(
      screen.getByText('Saviez-vous que votre peau change en hiver ?'),
    ).toBeInTheDocument();
  });

  it('renders caption text', () => {
    render(<GenerationResult result={buildResult()} />);
    expect(
      screen.getByText(
        'Votre routine hivernale commence ici. Hydratation profonde garantie.',
      ),
    ).toBeInTheDocument();
  });

  it('renders hashtags as tag badges', () => {
    render(<GenerationResult result={buildResult()} />);
    expect(screen.getByText('#skincare')).toBeInTheDocument();
    expect(screen.getByText('#hiver')).toBeInTheDocument();
    expect(screen.getByText('#routine')).toBeInTheDocument();
  });

  it('renders image previews when images present', () => {
    render(<GenerationResult result={buildResult()} />);
    const imagesSection = screen.queryByText(/Visuels/i);
    expect(imagesSection).toBeInTheDocument();
  });

  it('shows quality scores with progress bars', () => {
    render(<GenerationResult result={buildResult()} />);
    expect(screen.getByText('Scores qualité')).toBeInTheDocument();
    expect(screen.getByText('Alignement marque')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Potentiel engagement')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('Clarté du message')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
  });

  it('shows cost breakdown', () => {
    render(<GenerationResult result={buildResult()} />);
    expect(screen.getByText('Détail des coûts')).toBeInTheDocument();
    expect(screen.getByText('LLM (script)')).toBeInTheDocument();
    expect(screen.getByText('1.20 MAD')).toBeInTheDocument();
    expect(screen.getByText('Image gen')).toBeInTheDocument();
    expect(screen.getByText('2.30 MAD')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('3.50 MAD')).toBeInTheDocument();
  });

  it('"Copier" button copies caption to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<GenerationResult result={buildResult()} />);
    const copyBtn = screen.getByTitle('Copier');
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith(
      'Votre routine hivernale commence ici. Hydratation profonde garantie.',
    );
  });

  it('"Régénérer" button calls onRegenerate', () => {
    const onRegenerate = vi.fn();
    render(
      <GenerationResult result={buildResult()} onRegenerate={onRegenerate} />,
    );
    const btn = screen.getByRole('button', { name: /Régénérer/i });
    fireEvent.click(btn);
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it('"Utiliser ce contenu" button calls onUse', () => {
    const onUse = vi.fn();
    render(<GenerationResult result={buildResult()} onUse={onUse} />);
    const btn = screen.getByRole('button', { name: /Utiliser ce contenu/i });
    fireEvent.click(btn);
    expect(onUse).toHaveBeenCalledOnce();
  });

  it('shows "Voir dans la Bibliothèque" when contentStudioUrl provided', () => {
    render(
      <GenerationResult
        result={buildResult()}
        contentStudioUrl="/admin/content-studio-v2/drafts/draft_123"
      />,
    );
    const link = screen.getByRole('button', {
      name: /Voir dans la Bibliothèque/i,
    });
    expect(link).toBeInTheDocument();
    // The button is wrapped in an anchor
    const anchor = link.closest('a');
    expect(anchor).toHaveAttribute(
      'href',
      '/admin/content-studio-v2/drafts/draft_123',
    );
  });

  it('hides library link when no contentStudioUrl', () => {
    render(<GenerationResult result={buildResult()} />);
    expect(
      screen.queryByRole('button', { name: /Voir dans la Bibliothèque/i }),
    ).not.toBeInTheDocument();
  });

  it('shows publish section when bridgeResult provided', () => {
    const bridge: BridgeResultData = {
      ideaId: 'idea_1',
      briefId: 'brief_1',
      draftId: 'draft_1',
    };
    render(
      <GenerationResult result={buildResult()} bridgeResult={bridge} />,
    );
    expect(screen.getAllByText(/Publier/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('button', { name: /Publier maintenant/i }),
    ).toBeInTheDocument();
  });

  it('handles empty result gracefully', () => {
    const emptyResult: GenerationResultData = {};
    const { container } = render(
      <GenerationResult result={emptyResult} />,
    );
    // Should still render the wrapper and heading
    expect(screen.getByText('Contenu généré')).toBeInTheDocument();
    // No script, caption, hashtags, images, quality scores, or cost breakdown
    expect(screen.queryByText('Script')).not.toBeInTheDocument();
    expect(screen.queryByText('Caption')).not.toBeInTheDocument();
    expect(screen.queryByText('Scores qualité')).not.toBeInTheDocument();
    expect(screen.queryByText('Détail des coûts')).not.toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('shows script scenes count', () => {
    render(<GenerationResult result={buildResult()} />);
    // The "Scènes" eyebrow label is shown inside the collapsible Script section
    expect(screen.getByText('Scènes')).toBeInTheDocument();
    // Two scenes should be rendered
    expect(screen.getByText('Scene intro text')).toBeInTheDocument();
    expect(screen.getByText('Scene body text')).toBeInTheDocument();
  });

  it('shows CTA text', () => {
    render(<GenerationResult result={buildResult()} />);
    expect(screen.getByText('Call to Action')).toBeInTheDocument();
    expect(screen.getByText('Decouvrez notre serum')).toBeInTheDocument();
  });
});
