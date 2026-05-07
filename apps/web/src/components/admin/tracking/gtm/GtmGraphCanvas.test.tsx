import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GtmGraphCanvas } from './GtmGraphCanvas';
import type { GraphDescriptor } from '@/lib/tracking/gtm/viz/descriptor';

const DESCRIPTOR: GraphDescriptor = {
  folders: [
    {
      id: 'F-08',
      name: '08 — Chat assistant',
      color: 'sauge-profond',
      items: [
        {
          kind: 'tag',
          name: 'GA4 Evt — chat_widget_open',
          type: 'gaawe',
          triggers: [{ name: 'CE — chat_widget_open', type: 'customEvent' }],
          setupTags: [],
        },
      ],
    },
  ],
  orphans: [],
  totalTags: 1,
  totalTriggers: 1,
  totalVariables: 5,
};

const EMPTY: GraphDescriptor = {
  folders: [],
  orphans: [],
  totalTags: 0,
  totalTriggers: 0,
  totalVariables: 5,
};

describe('GtmGraphCanvas', () => {
  it('rend un SVG avec aria-label', () => {
    const { container } = render(<GtmGraphCanvas descriptor={DESCRIPTOR} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toMatch(/conteneur GTM/i);
    expect(svg?.getAttribute('role')).toBe('img');
  });

  it('affiche le nom des dossiers', () => {
    render(<GtmGraphCanvas descriptor={DESCRIPTOR} />);
    expect(screen.getByText('08 — Chat assistant')).toBeInTheDocument();
  });

  it('affiche le compte de tags par dossier', () => {
    render(<GtmGraphCanvas descriptor={DESCRIPTOR} />);
    expect(screen.getByText('1 tag')).toBeInTheDocument();
  });

  it('affiche les noms de tags et de triggers', () => {
    render(<GtmGraphCanvas descriptor={DESCRIPTOR} />);
    expect(screen.getByText(/GA4 Evt — chat_widget_open/)).toBeInTheDocument();
    expect(screen.getByText(/CE — chat_widget_open/)).toBeInTheDocument();
  });

  it('affiche un état vide si pas de dossiers', () => {
    render(<GtmGraphCanvas descriptor={EMPTY} />);
    expect(screen.getByText(/aucun tag/i)).toBeInTheDocument();
  });
});
