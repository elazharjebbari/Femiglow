import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GtmStatsGrid } from './GtmStatsGrid';
import type { GtmStats } from '@/lib/tracking/gtm/exporter';

const STATS: GtmStats = {
  tags: 75,
  triggers: 67,
  variables: 39,
  folders: 9,
  conversions: 4,
  chatTriggers: 18,
  chatDims: 9,
  byCategory: {},
};

beforeEach(() => {
  // Force prefers-reduced-motion → off pour éviter le count-up async dans les tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('GtmStatsGrid', () => {
  it('affiche les 4 cartes avec leurs labels', () => {
    render(<GtmStatsGrid stats={STATS} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Triggers')).toBeInTheDocument();
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('Folders')).toBeInTheDocument();
  });

  it('affiche les valeurs (count-up désactivé via reduced-motion)', () => {
    render(<GtmStatsGrid stats={STATS} />);
    // Avec reduced-motion, les valeurs s'affichent immédiatement
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('67')).toBeInTheDocument();
    expect(screen.getByText('39')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('met en évidence les sub-labels chat avec des pastilles sauge', () => {
    render(<GtmStatsGrid stats={STATS} />);
    const triggersChatHint = screen.getByText('18 chat');
    const dimsChatHint = screen.getByText('9 chat dims');
    // Les pastilles ont une bordure spécifique sauge (#A8C4A6)
    expect(triggersChatHint.className).toContain('A8C4A6');
    expect(dimsChatHint.className).toContain('A8C4A6');
  });

  it('cache les pastilles chat si chatTriggers / chatDims sont à 0', () => {
    render(
      <GtmStatsGrid
        stats={{ ...STATS, chatTriggers: 0, chatDims: 0 }}
      />,
    );
    expect(screen.queryByText(/chat$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/chat dims/)).not.toBeInTheDocument();
  });

  it('affiche un skeleton (pas les chiffres) en mode loading', () => {
    render(<GtmStatsGrid stats={STATS} loading />);
    // Aucun chiffre principal ne doit être visible
    expect(screen.queryByText('75')).not.toBeInTheDocument();
    expect(screen.queryByText('67')).not.toBeInTheDocument();
    // Les labels restent visibles
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });
});
