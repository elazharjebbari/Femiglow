/**
 * Tests StepList — add/move/delete + open editor.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepList } from '../StepList';
import type { AutomationStep } from '@/lib/mail/automation/step-types-v2';

describe('StepList', () => {
  it('shows empty state when no steps', () => {
    render(<StepList steps={[]} onChange={() => {}} />);
    expect(screen.getByText(/Aucune étape/i)).toBeInTheDocument();
  });

  it('lists steps with their label', () => {
    const steps: AutomationStep[] = [
      { kind: 'wait', durationMs: 3_600_000 },
      { kind: 'send', template: 'welcome-1' },
    ];
    render(<StepList steps={steps} onChange={() => {}} />);
    expect(screen.getByText(/Attendre 1 h/i)).toBeInTheDocument();
    expect(screen.getByText(/Envoyer « welcome-1 »/i)).toBeInTheDocument();
  });

  it('removes a step on ✕ click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const steps: AutomationStep[] = [
      { kind: 'wait', durationMs: 1000 },
      { kind: 'send', template: 't' },
    ];
    render(<StepList steps={steps} onChange={onChange} />);
    const removeBtns = screen.getAllByLabelText('Supprimer');
    await user.click(removeBtns[0]!);
    expect(onChange).toHaveBeenCalledWith([{ kind: 'send', template: 't' }]);
  });

  it('opens add-step menu and inserts wait step', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StepList steps={[]} onChange={onChange} />);
    await user.click(screen.getByTestId('add-step-btn'));
    await user.click(screen.getByText('Attendre'));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'wait' }),
    ]);
  });

  it('hides branch kind when allowBranch=false', async () => {
    const user = userEvent.setup();
    render(<StepList steps={[]} onChange={() => {}} allowBranch={false} />);
    await user.click(screen.getByTestId('add-step-btn'));
    expect(screen.queryByText(/Condition \(si \/ sinon\)/i)).not.toBeInTheDocument();
  });

  it('moves step down on ↓ click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const steps: AutomationStep[] = [
      { kind: 'wait', durationMs: 1000 },
      { kind: 'send', template: 't' },
    ];
    render(<StepList steps={steps} onChange={onChange} />);
    const downBtns = screen.getAllByLabelText('Descendre');
    await user.click(downBtns[0]!);
    expect(onChange).toHaveBeenCalledWith([
      { kind: 'send', template: 't' },
      { kind: 'wait', durationMs: 1000 },
    ]);
  });
});
