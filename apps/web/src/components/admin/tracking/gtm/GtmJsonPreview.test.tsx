import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmJsonPreview } from './GtmJsonPreview';

const SHORT_JSON = JSON.stringify({ hello: 'world', n: 42 }, null, 2);
const LONG_JSON = Array.from({ length: 800 }, (_, i) => `  "line-${i}": ${i}`).join(',\n');

describe('GtmJsonPreview — court contenu', () => {
  it('affiche le JSON sans tronquer si < maxLines', () => {
    render(<GtmJsonPreview json={SHORT_JSON} maxLines={400} />);
    expect(screen.getByText(/"hello": "world"/)).toBeInTheDocument();
  });

  it('affiche le compteur de lignes dans le header', () => {
    render(<GtmJsonPreview json={SHORT_JSON} />);
    const lines = SHORT_JSON.split('\n').length;
    expect(screen.getByText(new RegExp(`${lines} lignes`))).toBeInTheDocument();
  });

  it('ne montre pas le bouton "voir tout" si le JSON tient', () => {
    render(<GtmJsonPreview json={SHORT_JSON} />);
    expect(screen.queryByRole('button', { name: /voir tout/i })).not.toBeInTheDocument();
  });
});

describe('GtmJsonPreview — long contenu', () => {
  it('affiche un bouton "voir tout" qui déplie', async () => {
    const user = userEvent.setup();
    render(<GtmJsonPreview json={LONG_JSON} maxLines={400} />);
    const expandBtn = screen.getByRole('button', { name: /voir tout/i });
    expect(expandBtn).toBeInTheDocument();
    expect(screen.getByText(/lignes masquées/i)).toBeInTheDocument();

    await user.click(expandBtn);
    expect(screen.queryByText(/lignes masquées/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replier/i })).toBeInTheDocument();
  });
});

describe('GtmJsonPreview — bouton plein écran', () => {
  it('appelle onRequestFullscreen au clic', async () => {
    const user = userEvent.setup();
    const onFs = vi.fn();
    render(<GtmJsonPreview json={SHORT_JSON} onRequestFullscreen={onFs} />);
    await user.click(screen.getByRole('button', { name: /plein écran/i }));
    expect(onFs).toHaveBeenCalledTimes(1);
  });

  it('cache le bouton plein écran si onRequestFullscreen absent', () => {
    render(<GtmJsonPreview json={SHORT_JSON} />);
    expect(screen.queryByRole('button', { name: /plein écran/i })).not.toBeInTheDocument();
  });

  it('cache le bouton plein écran si fullHeight=true (déjà en plein écran)', () => {
    render(<GtmJsonPreview json={SHORT_JSON} fullHeight onRequestFullscreen={() => {}} />);
    expect(screen.queryByRole('button', { name: /plein écran/i })).not.toBeInTheDocument();
  });
});
