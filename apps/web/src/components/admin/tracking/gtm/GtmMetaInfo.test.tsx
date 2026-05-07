import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GtmMetaInfo } from './GtmMetaInfo';
import type { GtmMeta } from '@/lib/tracking/gtm/exporter';

function makeMeta(overrides: Partial<GtmMeta> = {}): GtmMeta {
  return {
    generatedAt: new Date(Date.now() - 30 * 1000).toISOString(),
    version: '1.4.0',
    sizeBytes: 97516,
    lineCount: 4034,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('GtmMetaInfo — affichage', () => {
  it('formate la taille en kB', () => {
    render(<GtmMetaInfo meta={makeMeta({ sizeBytes: 97516 })} />);
    expect(screen.getByText('95.2 kB')).toBeInTheDocument();
  });

  it('formate les lignes avec séparateur français', () => {
    render(<GtmMetaInfo meta={makeMeta({ lineCount: 4034 })} />);
    // Le séparateur peut être un espace fine insécable selon la locale Node
    const line = screen.getByText(/4[\s  ]?034/);
    expect(line).toBeInTheDocument();
  });

  it('affiche un timestamp relatif', () => {
    render(<GtmMetaInfo meta={makeMeta({ generatedAt: new Date(Date.now() - 30 * 1000).toISOString() })} />);
    expect(screen.getByText(/il y a/i)).toBeInTheDocument();
  });

  it('affiche la version', () => {
    render(<GtmMetaInfo meta={makeMeta({ version: '2.1.0' })} />);
    expect(screen.getByText('2.1.0')).toBeInTheDocument();
  });

  it('tronque le sha256 mais expose le hash complet en title', () => {
    render(<GtmMetaInfo meta={makeMeta({ sha256: 'b'.repeat(64) })} />);
    const btn = screen.getByRole('button', { name: /copier le sha-256/i });
    expect(btn.getAttribute('title')).toContain('b'.repeat(64));
  });
});

describe('GtmMetaInfo — copie sha256', () => {
  it('appelle navigator.clipboard.writeText avec le hash complet', async () => {
    const user = userEvent.setup();
    // userEvent.setup() v14 monte sa propre fake clipboard ; on espionne
    // après coup pour pouvoir l'observer.
    const writeTextSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    const onCopySha = vi.fn();
    const sha = 'c'.repeat(64);
    render(<GtmMetaInfo meta={makeMeta({ sha256: sha })} onCopySha={onCopySha} />);

    const btn = screen.getByRole('button', { name: /copier le sha-256/i });
    await user.click(btn);

    expect(writeTextSpy).toHaveBeenCalledWith(sha);
    expect(onCopySha).toHaveBeenCalledWith(sha);
    writeTextSpy.mockRestore();
  });

  it('annonce la copie en aria-live', async () => {
    const user = userEvent.setup();
    render(<GtmMetaInfo meta={makeMeta()} />);
    await user.click(screen.getByRole('button', { name: /copier le sha-256/i }));
    expect(screen.getByText(/sha-256 copié/i)).toBeInTheDocument();
  });
});
