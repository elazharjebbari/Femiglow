import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('applies pulse animation classes', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('animate-pulse');
    expect(div.className).toContain('motion-reduce:animate-none');
    expect(div.className).toContain('h-4');
    expect(div.className).toContain('w-24');
  });

  it('is hidden from assistive tech', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('aria-hidden')).toBe('true');
  });
});
