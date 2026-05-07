/**
 * Vitest — preview-protocol parsing.
 */
import { describe, it, expect } from 'vitest';
import {
  parsePreviewMessage,
  PREVIEW_WIDTHS,
  PREVIEW_WIDTH_PX,
} from './preview-protocol';

describe('parsePreviewMessage', () => {
  it('accepte PREVIEW_READY valide', () => {
    expect(
      parsePreviewMessage({ type: 'PREVIEW_READY', componentKey: 'home-hero' }),
    ).toEqual({ type: 'PREVIEW_READY', componentKey: 'home-hero' });
  });

  it('accepte FIELDS_CHANGED valide', () => {
    expect(
      parsePreviewMessage({ type: 'FIELDS_CHANGED', componentKey: 'home-hero' }),
    ).toEqual({ type: 'FIELDS_CHANGED', componentKey: 'home-hero' });
  });

  it('accepte SCROLL_TO_FIELD avec fieldKey', () => {
    expect(
      parsePreviewMessage({
        type: 'SCROLL_TO_FIELD',
        componentKey: 'home-hero',
        fieldKey: 'title',
      }),
    ).toEqual({
      type: 'SCROLL_TO_FIELD',
      componentKey: 'home-hero',
      fieldKey: 'title',
    });
  });

  it('accepte FIELD_CLICKED avec fieldKey', () => {
    expect(
      parsePreviewMessage({
        type: 'FIELD_CLICKED',
        componentKey: 'home-hero',
        fieldKey: 'title',
      }),
    ).toEqual({
      type: 'FIELD_CLICKED',
      componentKey: 'home-hero',
      fieldKey: 'title',
    });
  });

  it('rejette les types inconnus', () => {
    expect(parsePreviewMessage({ type: 'EVIL', componentKey: 'x' })).toBeNull();
  });

  it('rejette null / chaîne / nombre', () => {
    expect(parsePreviewMessage(null)).toBeNull();
    expect(parsePreviewMessage('string')).toBeNull();
    expect(parsePreviewMessage(42)).toBeNull();
  });

  it('rejette un componentKey vide', () => {
    expect(parsePreviewMessage({ type: 'PREVIEW_READY', componentKey: '' })).toBeNull();
  });

  it('rejette SCROLL_TO_FIELD sans fieldKey', () => {
    expect(
      parsePreviewMessage({ type: 'SCROLL_TO_FIELD', componentKey: 'x' }),
    ).toBeNull();
  });
});

describe('PREVIEW constants', () => {
  it('expose mobile/tablet/desktop avec widths px attendues', () => {
    expect(PREVIEW_WIDTHS).toEqual(['mobile', 'tablet', 'desktop']);
    expect(PREVIEW_WIDTH_PX.mobile).toBe(375);
    expect(PREVIEW_WIDTH_PX.tablet).toBe(768);
    expect(PREVIEW_WIDTH_PX.desktop).toBeNull();
  });
});
