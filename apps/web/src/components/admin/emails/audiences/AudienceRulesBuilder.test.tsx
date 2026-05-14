/**
 * Tests RTL — AudienceRulesBuilder + RuleEditor.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AudienceRulesBuilder } from './AudienceRulesBuilder';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

function makeEmptyGroup(): RulesGroup {
  return { kind: 'all', conditions: [] };
}

describe('<AudienceRulesBuilder />', () => {
  it('renders empty state when no conditions', () => {
    const onChange = vi.fn();
    render(<AudienceRulesBuilder value={makeEmptyGroup()} onChange={onChange} />);
    expect(screen.getByText(/Aucun critère/i)).toBeInTheDocument();
    expect(screen.getByTestId('add-rule-btn')).toBeInTheDocument();
  });

  it('opens rule menu on + Ajouter button', async () => {
    render(<AudienceRulesBuilder value={makeEmptyGroup()} onChange={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-rule-btn'));
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByTestId('add-rule-order_count')).toBeInTheDocument();
    expect(screen.getByTestId('add-rule-consent_marketing')).toBeInTheDocument();
  });

  it('adds a rule to conditions when picked from menu', async () => {
    const onChange = vi.fn();
    render(<AudienceRulesBuilder value={makeEmptyGroup()} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-rule-btn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-rule-order_count'));
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as RulesGroup;
    expect(next.conditions).toHaveLength(1);
    expect((next.conditions[0] as { kind: string }).kind).toBe('order_count');
  });

  it('renders an existing rule as RuleEditor', () => {
    const value: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'order_count', operator: 'gte', value: 3 }],
    };
    render(<AudienceRulesBuilder value={value} onChange={vi.fn()} />);
    expect(screen.getByTestId('rule-editor-order_count')).toBeInTheDocument();
  });

  it('removes a rule when ✕ is clicked', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'has_tag', tag: 'vip' }],
    };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-rule'));
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0]![0] as RulesGroup;
    expect(next.conditions).toHaveLength(0);
  });

  it('toggles combinator AND ↔ OR', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'has_tag', tag: 'a' },
        { kind: 'has_tag', tag: 'b' },
      ],
    };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-combinator'));
    });
    const next = onChange.mock.calls[0]![0] as RulesGroup;
    expect(next.kind).toBe('any');
  });

  it('adds a sub-group when + Ajouter un groupe is clicked', async () => {
    const onChange = vi.fn();
    render(<AudienceRulesBuilder value={makeEmptyGroup()} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-group-btn'));
    });
    const next = onChange.mock.calls[0]![0] as RulesGroup;
    expect(next.conditions).toHaveLength(1);
    const sub = next.conditions[0] as RulesGroup;
    expect(sub.kind).toBe('any'); // opposite of parent 'all'
  });

  it('hides + Ajouter un groupe at max depth', () => {
    render(
      <AudienceRulesBuilder value={makeEmptyGroup()} onChange={vi.fn()} depth={3} maxDepth={3} />,
    );
    expect(screen.queryByTestId('add-group-btn')).not.toBeInTheDocument();
  });

  it('renders nested groups recursively', () => {
    const value: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'has_tag', tag: 'a' },
        {
          kind: 'any',
          conditions: [
            { kind: 'has_tag', tag: 'b' },
            { kind: 'has_tag', tag: 'c' },
          ],
        },
      ],
    };
    render(<AudienceRulesBuilder value={value} onChange={vi.fn()} />);
    expect(screen.getByTestId('rules-group-0')).toBeInTheDocument();
    expect(screen.getByTestId('rules-group-1')).toBeInTheDocument();
    // 3 rule-editors visible
    expect(screen.getAllByTestId('rule-editor-has_tag')).toHaveLength(3);
  });

  it('updates a rule when its editor changes', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'has_tag', tag: 'vip' }],
    };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);
    const input = screen.getByDisplayValue('vip') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'premium' } });
    });
    const next = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as RulesGroup;
    expect((next.conditions[0] as { tag: string }).tag).toBe('premium');
  });

  it('does not show combinator toggle with only 1 condition', () => {
    const value: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'has_tag', tag: 'vip' }],
    };
    render(<AudienceRulesBuilder value={value} onChange={vi.fn()} />);
    expect(screen.queryByTestId('toggle-combinator')).not.toBeInTheDocument();
  });
});
