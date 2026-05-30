import { describe, it, expect } from 'vitest';
import { imageCostCents } from './pricing';

/**
 * ACT-BE-035 (BUG-057) — source unique du coût image (cents). Le pré-check
 * budget (service) et le coût enregistré (image-generation) passent désormais
 * tous deux par cette fonction → plus de divergence.
 */
describe('imageCostCents', () => {
  it('mock = gratuit', () => {
    expect(imageCostCents('mock-low-cost-image', 'high')).toBe(0);
    expect(imageCostCents(undefined, 'high')).toBe(0);
  });
  it('gpt-image-1-mini varie par quality', () => {
    expect(imageCostCents('gpt-image-1-mini', 'low')).toBe(1);
    expect(imageCostCents('gpt-image-1-mini', 'medium')).toBe(2);
    expect(imageCostCents('gpt-image-1-mini', 'high')).toBe(4);
  });
  it('OpenAI premium varie par quality', () => {
    expect(imageCostCents('gpt-image-1', 'high')).toBe(22);
    expect(imageCostCents('dall-e-3', 'medium')).toBe(6);
    expect(imageCostCents('gpt-image-1', 'low')).toBe(1);
  });
  it('Higgsfield par modèle', () => {
    expect(imageCostCents('hf-flux-pro', 'low')).toBe(550);
    expect(imageCostCents('hf-flux-1', 'high')).toBe(250);
    expect(imageCostCents('hf-flux-schnell', 'medium')).toBe(30);
  });
  it('déterministe : même modèle+quality → même coût (pré-check == enregistré)', () => {
    expect(imageCostCents('gpt-image-1-mini', 'high')).toBe(imageCostCents('gpt-image-1-mini', 'high'));
  });
});
