/**
 * Lots L5/L10 — `LocaleSuggestionPrompt` : non-intrusion + 2 choix (INV-20).
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleSuggestionPrompt } from './LocaleSuggestionPrompt';

function setup(over: Partial<React.ComponentProps<typeof LocaleSuggestionPrompt>> = {}) {
  const onAccept = vi.fn();
  const onDismiss = vi.fn();
  const utils = render(
    <LocaleSuggestionPrompt
      suggested="ar"
      surface="pearl"
      switchLabel="المتابعة بالعربية ؟"
      stayLabel="Rester en français"
      ariaLabel="Suggestion de langue"
      onAccept={onAccept}
      onDismiss={onDismiss}
      {...over}
    />,
  );
  return { ...utils, onAccept, onDismiss };
}

describe('LocaleSuggestionPrompt', () => {
  it('rend deux choix symétriques (passer / rester), non-modal', () => {
    const { getByTestId } = setup();
    const root = getByTestId('locale-suggestion-prompt');
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('false'); // n'emprisonne pas le focus
    expect(getByTestId('locale-suggestion-accept').textContent).toContain(
      'بالعربية',
    );
    expect(getByTestId('locale-suggestion-dismiss').textContent).toContain(
      'Rester',
    );
  });

  it('clic « passer » → onAccept', () => {
    const { getByTestId, onAccept } = setup();
    fireEvent.click(getByTestId('locale-suggestion-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('clic « rester » → onDismiss', () => {
    const { getByTestId, onDismiss } = setup();
    fireEvent.click(getByTestId('locale-suggestion-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Échap → onDismiss (rester)', () => {
    const { onDismiss } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('variante toast : data-surface=toast', () => {
    const { getByTestId } = setup({ surface: 'toast' });
    expect(getByTestId('locale-suggestion-prompt').getAttribute('data-surface')).toBe(
      'toast',
    );
  });
});
