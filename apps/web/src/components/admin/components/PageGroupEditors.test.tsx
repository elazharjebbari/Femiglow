/**
 * Tests `PageGroupEditors` — éditeurs contextuels par groupe de page.
 */
import { describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { PageGroupEditors } from './PageGroupEditors';

afterEach(cleanup);

describe('PageGroupEditors', () => {
  it('rend les 3 éditeurs pour le groupe kit (Vidéo / Composition / Pack)', () => {
    const { getByText, getByRole } = render(<PageGroupEditors group="kit" />);
    expect(getByText('Vidéo')).toBeDefined();
    expect(getByText('Composition')).toBeDefined();
    expect(getByText('Pack')).toBeDefined();
    expect(getByRole('link', { name: /Vidéo/ }).getAttribute('href')).toBe('/admin/kit/video');
    expect(getByRole('link', { name: /Composition/ }).getAttribute('href')).toBe(
      '/admin/kit/composition',
    );
    expect(getByRole('link', { name: /Pack/ }).getAttribute('href')).toBe('/admin/kit/pack');
  });

  it('ne rend rien pour un groupe sans éditeurs dédiés', () => {
    const { container } = render(<PageGroupEditors group="home" />);
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien quand group est undefined (vue « Tous »)', () => {
    const { container } = render(<PageGroupEditors group={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
