/**
 * Tests StepEditor — switch by kind, basic input handling.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepEditor } from '../StepEditor';
import type { AutomationStep } from '@/lib/mail/automation/step-types-v2';

describe('StepEditor', () => {
  it('wait kind — updates durationMs from minutes input', () => {
    const onChange = vi.fn();
    const value: AutomationStep = { kind: 'wait', durationMs: 60_000 };
    render(<StepEditor value={value} onChange={onChange} />);
    const input = screen.getByDisplayValue('1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'wait', durationMs: 30 * 60_000 });
  });

  it('tag kind — toggles action add/remove', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const value: AutomationStep = { kind: 'tag', action: 'add', tag: 'vip' };
    render(<StepEditor value={value} onChange={onChange} />);
    // Find the action select via its visible options
    const selects = screen.getAllByRole('combobox');
    const actionSelect = selects.find((s) => (s as HTMLSelectElement).value === 'add');
    expect(actionSelect).toBeTruthy();
    await user.selectOptions(actionSelect!, 'remove');
    expect(onChange).toHaveBeenCalledWith({ kind: 'tag', action: 'remove', tag: 'vip' });
  });

  it('webhook kind — rejects non-object JSON body', () => {
    const onChange = vi.fn();
    const value: AutomationStep = {
      kind: 'webhook',
      url: 'https://x.com/h',
      method: 'POST',
    };
    render(<StepEditor value={value} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/userId/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '[1,2,3]' } });
    expect(screen.getByText(/Doit être un objet JSON/i)).toBeInTheDocument();
  });

  it('wait_for_event kind — renders catalog options', () => {
    const value: AutomationStep = {
      kind: 'wait_for_event',
      eventName: 'email.opened',
      timeoutMs: 3600_000,
    };
    render(
      <StepEditor
        value={value}
        onChange={() => {}}
        eventsCatalog={[
          { name: 'email.opened', category: 'email', description: 'Email ouvert' },
          { name: 'cart.abandoned', category: 'commerce', description: 'Panier abandonné' },
        ]}
      />,
    );
    expect(screen.getByText(/email.opened — Email ouvert/i)).toBeInTheDocument();
    expect(screen.getByText(/cart.abandoned — Panier abandonné/i)).toBeInTheDocument();
  });
});
