/**
 * Tests de la persistance de l'angle publicitaire (cookie `fg_angle`).
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { KitAngleCookie, buildKitAngleCookie } from './KitAngleCookie';

function clearCookie(): void {
  document.cookie = 'fg_angle=; Max-Age=0; Path=/';
}

describe('KitAngleCookie', () => {
  afterEach(clearCookie);

  it('chaîne : 7 jours, tout le site, SameSite=Lax', () => {
    expect(buildKitAngleCookie('e')).toBe('fg_angle=e; Max-Age=604800; Path=/; SameSite=Lax');
  });

  it('pose le cookie quand l’angle vient de l’URL', () => {
    render(<KitAngleCookie angle="e" fromUrl />);
    expect(document.cookie).toContain('fg_angle=e');
  });

  it('ne réécrit pas un angle venu du cookie', () => {
    render(<KitAngleCookie angle="a" fromUrl={false} />);
    expect(document.cookie).not.toContain('fg_angle=');
  });

  it('sans angle : rien', () => {
    render(<KitAngleCookie angle={null} fromUrl />);
    expect(document.cookie).not.toContain('fg_angle=');
  });

  it('ne rend rien', () => {
    const { container } = render(<KitAngleCookie angle="b" fromUrl />);
    expect(container.innerHTML).toBe('');
  });
});
