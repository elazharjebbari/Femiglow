import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { generationOutputSchema } from './generation';

function validBrief() {
  return {
    angle: 'Relier rituel à un geste simple.',
    proof: 'Le rituel FemiGlow révèle l\'éclat naturel.',
    cta: 'Découvrir le rituel',
    mediaDirection: 'Mains, geste lent, lumière naturelle.',
  };
}

function validDraft() {
  return {
    variantLabel: 'sobre',
    hook: 'Un geste lent.',
    caption: 'Caption de test pour FemiGlow.',
    cta: 'Découvrir le rituel',
    altText: 'Main posée près du rituel.',
    hashtags: ['femiglow', 'rituel'],
  };
}

function validOutput() {
  return { brief: validBrief(), drafts: [validDraft()] };
}

describe('generationOutputSchema parse safety', () => {
  it('accepts a valid full object', () => {
    const result = generationOutputSchema.parse(validOutput());
    expect(result.brief.angle).toBe(validBrief().angle);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].caption).toBe(validDraft().caption);
  });

  it('throws ZodError when brief is missing', () => {
    expect(() => generationOutputSchema.parse({ drafts: [validDraft()] })).toThrow(ZodError);
  });

  it('throws ZodError when drafts is missing', () => {
    expect(() => generationOutputSchema.parse({ brief: validBrief() })).toThrow(ZodError);
  });

  it('throws ZodError when drafts is an empty array (min 1)', () => {
    expect(() =>
      generationOutputSchema.parse({ brief: validBrief(), drafts: [] }),
    ).toThrow(ZodError);
  });

  it('throws ZodError when drafts is a string', () => {
    expect(() =>
      generationOutputSchema.parse({ brief: validBrief(), drafts: 'not-an-array' }),
    ).toThrow(ZodError);
  });

  it('throws ZodError when brief.angle is a number', () => {
    expect(() =>
      generationOutputSchema.parse({
        brief: { ...validBrief(), angle: 42 },
        drafts: [validDraft()],
      }),
    ).toThrow(ZodError);
  });

  it('throws ZodError when brief is missing cta', () => {
    const { cta: _, ...briefNoCta } = validBrief();
    expect(() =>
      generationOutputSchema.parse({ brief: briefNoCta, drafts: [validDraft()] }),
    ).toThrow(ZodError);
  });

  it('throws ZodError when a draft is missing caption', () => {
    const { caption: _, ...draftNoCaption } = validDraft();
    expect(() =>
      generationOutputSchema.parse({ brief: validBrief(), drafts: [draftNoCaption] }),
    ).toThrow(ZodError);
  });

  it('passes when a draft has extra fields (strip)', () => {
    const draftWithExtra = { ...validDraft(), extraField: 'should be stripped' };
    const result = generationOutputSchema.parse({
      brief: validBrief(),
      drafts: [draftWithExtra],
    });
    expect(result.drafts[0]).not.toHaveProperty('extraField');
    expect(result.drafts[0].caption).toBe(validDraft().caption);
  });

  it('defaults hashtags to [] when missing', () => {
    const { hashtags: _, ...draftNoHashtags } = validDraft();
    const result = generationOutputSchema.parse({
      brief: validBrief(),
      drafts: [draftNoHashtags],
    });
    expect(result.drafts[0].hashtags).toEqual([]);
  });

  it('defaults altText to empty string when missing', () => {
    const { altText: _, ...draftNoAlt } = validDraft();
    const result = generationOutputSchema.parse({
      brief: validBrief(),
      drafts: [draftNoAlt],
    });
    expect(result.drafts[0].altText).toBe('');
  });

  it('throws ZodError for a valid JSON string that is not an object', () => {
    expect(() => generationOutputSchema.parse('hello')).toThrow(ZodError);
  });

  it('throws ZodError for null', () => {
    expect(() => generationOutputSchema.parse(null)).toThrow(ZodError);
  });

  it('throws ZodError for { brief: null, drafts: [] }', () => {
    expect(() =>
      generationOutputSchema.parse({ brief: null, drafts: [] }),
    ).toThrow(ZodError);
  });
});
