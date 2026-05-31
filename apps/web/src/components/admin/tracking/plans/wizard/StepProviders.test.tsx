import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StepProviders } from './StepProviders';
import type { Provider } from '@/lib/tracking/plan/types';

describe('StepProviders', () => {
  it('renders Snapchat Pixel as a selectable provider', async () => {
    const providers: Provider[] = [
      { id: 'ga4', active: true },
      { id: 'snap', active: false },
    ];
    const onChange = vi.fn();
    render(<StepProviders providers={providers} onChange={onChange} />);

    const snap = screen.getByRole('switch', { name: /Snapchat Pixel/i });
    expect(snap).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(snap);
    expect(onChange).toHaveBeenCalledWith([
      { id: 'ga4', active: true },
      { id: 'snap', active: true },
    ]);
  });
});
