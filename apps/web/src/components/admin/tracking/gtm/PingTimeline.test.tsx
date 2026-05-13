import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PingTimeline } from './PingTimeline';

describe('PingTimeline', () => {
  it('affiche un empty state si aucun jour', () => {
    render(<PingTimeline days={[]} />);
    expect(screen.getByText(/Aucun ping reçu pour le moment/i)).toBeInTheDocument();
  });

  it('rend une barre par jour', () => {
    const days = [
      { day: '2026-05-10', pingsCount: 100, driftDetected: false },
      { day: '2026-05-11', pingsCount: 200, driftDetected: false },
      { day: '2026-05-12', pingsCount: 50, driftDetected: true },
    ];
    const { container } = render(<PingTimeline days={days} />);
    const bars = container.querySelectorAll('[title]');
    expect(bars.length).toBe(3);
  });

  it('colore en orange les jours avec drift', () => {
    const days = [
      { day: '2026-05-10', pingsCount: 100, driftDetected: false },
      { day: '2026-05-11', pingsCount: 100, driftDetected: true },
    ];
    const { container } = render(<PingTimeline days={days} />);
    expect(container.querySelector('.bg-amber-400')).toBeTruthy();
    expect(container.querySelector('.bg-emerald-500')).toBeTruthy();
  });

  it('trie les jours chronologiquement', () => {
    const days = [
      { day: '2026-05-12', pingsCount: 50, driftDetected: false },
      { day: '2026-05-10', pingsCount: 100, driftDetected: false },
      { day: '2026-05-11', pingsCount: 200, driftDetected: false },
    ];
    const { container } = render(<PingTimeline days={days} />);
    const titles = Array.from(container.querySelectorAll('[title]')).map((b) => b.getAttribute('title'));
    expect(titles[0]).toContain('2026-05-10');
    expect(titles[1]).toContain('2026-05-11');
    expect(titles[2]).toContain('2026-05-12');
  });

  it('affiche le total formaté (espace insécable toléré)', () => {
    const days = [
      { day: '2026-05-10', pingsCount: 1200, driftDetected: false },
      { day: '2026-05-11', pingsCount: 800, driftDetected: false },
    ];
    render(<PingTimeline days={days} />);
    expect(
      screen.getByText((c) => /Total\s*2\D{1,3}000/.test(c) && c.includes('pings')),
    ).toBeInTheDocument();
  });

  it('produit des barres avec hauteur proportionnelle', () => {
    const days = [
      { day: '2026-05-10', pingsCount: 100, driftDetected: false },
      { day: '2026-05-11', pingsCount: 50, driftDetected: false },
    ];
    const { container } = render(<PingTimeline days={days} />);
    const bars = container.querySelectorAll('[title]') as NodeListOf<HTMLElement>;
    const h0 = parseInt(bars[0]!.style.height);
    const h1 = parseInt(bars[1]!.style.height);
    expect(h0).toBeGreaterThan(h1);
  });
});
