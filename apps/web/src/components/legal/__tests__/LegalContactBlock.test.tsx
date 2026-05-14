import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/legal/repository', () => ({
  listAllTemplateVars: vi.fn(),
}));

import { listAllTemplateVars } from '@/lib/legal/repository';
import { LegalContactBlock } from '../LegalContactBlock';

beforeEach(() => {
  vi.mocked(listAllTemplateVars).mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('LegalContactBlock', () => {
  it('rend email + téléphone depuis vars DB', async () => {
    vi.mocked(listAllTemplateVars).mockResolvedValue([
      { key: 'COMPANY_EMAIL', value: 'support@femiglow.ma' } as never,
      { key: 'COMPANY_PHONE', value: '+212 6 12 34 56 78' } as never,
    ]);
    const ui = await LegalContactBlock({ lastUpdated: new Date('2026-05-13'), version: 3 });
    const { container } = render(ui as React.ReactElement);

    expect(container.innerHTML).toContain('mailto:support@femiglow.ma');
    expect(container.innerHTML).toContain('tel:+21261234567');
    expect(container.textContent).toContain('Mise à jour le 13 mai 2026');
    expect(container.textContent).toContain('v3');
  });

  it('fallback sur defaults si vars manquantes', async () => {
    vi.mocked(listAllTemplateVars).mockResolvedValue([]);
    const ui = await LegalContactBlock({ lastUpdated: new Date(), version: 1 });
    const { container } = render(ui as React.ReactElement);
    expect(container.innerHTML).toContain('mailto:info@femiglow.ma');
  });

  it('fallback gracieux si DB throw', async () => {
    vi.mocked(listAllTemplateVars).mockRejectedValue(new Error('db'));
    const ui = await LegalContactBlock({ lastUpdated: new Date(), version: 1 });
    const { container } = render(ui as React.ReactElement);
    // fallback "info@femiglow.ma" sortie
    expect(container.innerHTML).toContain('mailto:');
  });

  it('aria-labelledby + structure sémantique', async () => {
    vi.mocked(listAllTemplateVars).mockResolvedValue([]);
    const ui = await LegalContactBlock({ lastUpdated: new Date(), version: 1 });
    const { container } = render(ui as React.ReactElement);
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-labelledby')).toBe('legal-contact-title');
    expect(container.querySelector('#legal-contact-title')).toBeTruthy();
  });
});
