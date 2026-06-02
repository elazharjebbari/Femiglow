/**
 * OWBS F05 — WizardSyncIndicator (indicateur de sync dégradée, non bloquant).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { WizardSyncIndicator } from './WizardSyncIndicator';
import { expectNoAxeViolations } from '@/test/axe';

const flushMock = vi.fn(() => Promise.resolve());
vi.mock('@/lib/checkout/state/lead-sync-singleton', () => ({
  getLeadSyncQueue: () => ({ flush: flushMock }),
}));

beforeEach(() => {
  useWizardStore.getState().reset();
  flushMock.mockClear();
});

function setLanguage(language: 'fr' | 'ar' | 'en') {
  useWizardStore.getState().setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_cart',
    variantKey: 'control',
    source: 'wizard_kit',
    language,
  });
}

describe('WizardSyncIndicator (OWBS F05)', () => {
  it('F05-S01 — rien affiché si syncDegraded=false', () => {
    render(<WizardSyncIndicator />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByTestId('wizard-sync-indicator')).toBeNull();
  });

  it('F05-S02 — visible (role=status) quand dégradé', () => {
    useWizardStore.getState().markSyncDegraded();
    render(<WizardSyncIndicator />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-sync-indicator')).toHaveTextContent(/enregistr/i);
  });

  it('F05-S03 — non bloquant (aria-live=polite, pas de role=dialog)', () => {
    useWizardStore.getState().markSyncDegraded();
    render(<WizardSyncIndicator />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('F05-S10 — « réessayer » efface le signal puis re-flushe', async () => {
    useWizardStore.getState().markSyncDegraded();
    render(<WizardSyncIndicator />);
    await userEvent.click(screen.getByTestId('wizard-sync-retry'));
    expect(flushMock).toHaveBeenCalledOnce();
    expect(useWizardStore.getState().syncDegraded).toBe(false);
  });

  it('F05-S11 — message arabe en AR', () => {
    setLanguage('ar');
    useWizardStore.getState().markSyncDegraded();
    render(<WizardSyncIndicator />);
    expect(screen.getByTestId('wizard-sync-indicator').textContent).toMatch(/[؀-ۿ]/);
  });

  it('F05-S12 — axe 0 violation', async () => {
    useWizardStore.getState().markSyncDegraded();
    const { container } = render(<WizardSyncIndicator />);
    await expectNoAxeViolations(container);
  });
});
