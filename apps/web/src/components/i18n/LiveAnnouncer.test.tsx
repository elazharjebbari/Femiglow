/**
 * Lot L3 — `LiveAnnouncer` : région aria-live unique (INV-10).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveAnnouncer } from './LiveAnnouncer';
import { LIVE_REGION_ID } from '@/lib/i18n/transition-helpers';

describe('LiveAnnouncer', () => {
  it('rend une région aria-live polite atomique, visuellement masquée', () => {
    const { container } = render(<LiveAnnouncer />);
    const region = container.querySelector(`#${LIVE_REGION_ID}`);
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
    expect(region?.className).toContain('sr-only');
  });
});
