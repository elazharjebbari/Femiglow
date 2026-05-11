/**
 * Régression de positionnement du `ChatLauncher`.
 *
 * Sur `/kit`, la `StickyCartCTA` occupe la bande basse (mobile) ou le
 * coin bas-droit (desktop). Le launcher doit se décaler pour ne pas
 * recouvrir le bouton « Commander » du sticky.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ChatLauncher } from './ChatLauncher';

let mockedPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockedPathname,
}));

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: () => {} }),
}));

beforeEach(() => {
  mockedPathname = '/';
});

afterEach(() => {
  cleanup();
});

describe('ChatLauncher (positionnement)', () => {
  it('hors `/kit` : reste à `bottom-5` (mobile) / `bottom-7` (sm+), sans décalage horizontal', () => {
    mockedPathname = '/journal';
    const { container } = render(<ChatLauncher />);
    const button = container.querySelector('[data-testid="chat-launcher"]');
    expect(button?.className).toContain('bottom-5');
    expect(button?.className).toContain('sm:bottom-7');
    expect(button?.className).toContain('sm:right-7');
    expect(button?.className).not.toContain('bottom-24');
    expect(button?.className).not.toMatch(/sm:right-\[\d+px\]/);
  });

  it('sur `/kit` : remonte à `bottom-24` (mobile, au-dessus du sticky bar) et se décale à gauche du sticky en desktop', () => {
    mockedPathname = '/kit';
    const { container } = render(<ChatLauncher />);
    const button = container.querySelector('[data-testid="chat-launcher"]');
    expect(button?.className).toContain('bottom-24');
    expect(button?.className).toContain('sm:right-[372px]');
    // Pas de conflit Tailwind (`sm:right-7` ne doit plus être émis sur /kit).
    expect(button?.className).not.toContain('sm:right-7');
  });
});
