import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  IconDownload,
  IconCopy,
  IconCheck,
  IconAlert,
  IconExpand,
  IconClose,
} from './GtmIcons';

describe('GtmIcons', () => {
  it.each([
    ['IconDownload', <IconDownload key="d" />],
    ['IconCopy', <IconCopy key="c" />],
    ['IconCheck', <IconCheck key="ok" />],
    ['IconAlert', <IconAlert key="a" />],
    ['IconExpand', <IconExpand key="e" />],
    ['IconClose', <IconClose key="x" />],
  ])('rend %s avec aria-hidden par défaut', (_label, element) => {
    const { container } = render(<>{element}</>);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('height')).toBe('16');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
  });

  it('accepte une className personnalisée', () => {
    const { container } = render(<IconDownload className="h-4 w-4" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('h-4 w-4');
  });
});
