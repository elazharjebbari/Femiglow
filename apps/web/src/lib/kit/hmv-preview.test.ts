import { describe, expect, it } from 'vitest';
import { HMV_PREVIEW_HEADER, isHmvPreviewRequest, isKitDraftPreviewUrl } from './hmv-preview';

describe('hmv-preview', () => {
  it.each([
    ['/kit', 'hmv_preview=draft', true],
    ['/ar/kit', 'angle=e&hmv_preview=DRAFT', true],
    ['/fr/kit/', 'hmv_preview=draft', true],
    ['/fr/kit', 'hmv_preview=live', false],
    ['/fr/kit', '', false],
    ['/fr/rituel', 'hmv_preview=draft', false],
    ['/admin/kit', 'hmv_preview=draft', false],
  ])('%s?%s → %s', (path, qs, expected) => {
    expect(isKitDraftPreviewUrl(path, new URLSearchParams(qs))).toBe(expected);
  });

  it('marqueur : seulement la valeur « 1 »', () => {
    expect(isHmvPreviewRequest(new Headers({ [HMV_PREVIEW_HEADER]: '1' }))).toBe(true);
    expect(isHmvPreviewRequest(new Headers({ [HMV_PREVIEW_HEADER]: 'true' }))).toBe(false);
    expect(isHmvPreviewRequest(new Headers())).toBe(false);
  });
});
