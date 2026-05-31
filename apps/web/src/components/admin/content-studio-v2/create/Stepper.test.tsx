/**
 * Tests for the create/Stepper helpers.
 *
 * We focus on `deriveActiveStep` because that's the only piece of
 * non-trivial logic — the rendering itself is just CSS-driven decoration.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stepper, deriveActiveStep } from './Stepper';
import type { ContentDraft } from '@/lib/content-studio/types';

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: 'd-1',
    briefId: 'b-1',
    platform: 'instagram',
    format: 'post',
    variantLabel: 'A',
    caption: '',
    hook: null,
    cta: null,
    altText: null,
    hashtags: [],
    rejectionReason: null,
    parentDraftId: null,
    status: 'idea',
    scoreTotal: null,
    editedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('deriveActiveStep', () => {
  it('returns "frame" when no draft is present', () => {
    expect(deriveActiveStep(null, false)).toBe('frame');
  });

  it('maps draft.status to the right step', () => {
    expect(deriveActiveStep(makeDraft({ status: 'idea' }), false)).toBe('frame');
    expect(deriveActiveStep(makeDraft({ status: 'generated' }), false)).toBe('generate');
    expect(deriveActiveStep(makeDraft({ status: 'needs_review' }), false)).toBe('visual');
    expect(deriveActiveStep(makeDraft({ status: 'approved' }), false)).toBe('validate');
  });

  it('advances visual → validate once media + caption are present', () => {
    const draft = makeDraft({ status: 'needs_review', caption: 'some text' });
    expect(deriveActiveStep(draft, true)).toBe('validate');
    // Without media: still on visual.
    expect(deriveActiveStep(draft, false)).toBe('visual');
    // Media but no caption: still on visual.
    expect(deriveActiveStep(makeDraft({ status: 'needs_review', caption: '' }), true)).toBe('visual');
  });
});

describe('<Stepper />', () => {
  it('renders 4 step buttons in order', () => {
    const { container } = render(<Stepper draft={null} />);
    const buttons = container.querySelectorAll('button[data-step]');
    expect(buttons.length).toBe(4);
    const steps = Array.from(buttons).map((b) => b.getAttribute('data-step'));
    expect(steps).toEqual(['frame', 'generate', 'visual', 'validate']);
  });

  it('marks the matching step as active via aria-current', () => {
    const { container } = render(<Stepper activeStep="visual" />);
    const active = container.querySelector('button[aria-current="step"]');
    expect(active?.getAttribute('data-step')).toBe('visual');
  });

  it('disables future steps', () => {
    const { container } = render(<Stepper activeStep="generate" />);
    const visualBtn = container.querySelector(
      'button[data-step="visual"]',
    ) as HTMLButtonElement | null;
    expect(visualBtn?.disabled).toBe(true);
  });
});
