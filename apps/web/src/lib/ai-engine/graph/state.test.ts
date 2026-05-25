import { describe, expect, it } from 'vitest';
import {
  ContentGenerationState,
  type ContentGenerationStateType,
  type ContentGenerationUpdateType,
  type ContentVariant,
} from './state';

describe('graph/state re-exports', () => {
  it('ContentGenerationState is exported and is an Annotation root', () => {
    expect(ContentGenerationState).toBeDefined();
    // LangGraph Annotation.Root produces an AnnotationRoot object with spec
    expect(typeof ContentGenerationState).toBe('object');
    expect(ContentGenerationState).toHaveProperty('spec');
  });

  it('ContentGenerationStateType is a valid type (compile-time check)', () => {
    // This is primarily a compile-time check. If the type is not exported,
    // TypeScript would error during compilation. At runtime we verify the
    // type alias resolves to something usable.
    const _typeCheck: ContentGenerationStateType | undefined = undefined;
    expect(_typeCheck).toBeUndefined();

    // Also verify ContentVariant is exported
    const _variantCheck: ContentVariant | undefined = undefined;
    expect(_variantCheck).toBeUndefined();

    // Also verify ContentGenerationUpdateType is exported
    const _updateCheck: ContentGenerationUpdateType | undefined = undefined;
    expect(_updateCheck).toBeUndefined();
  });
});
