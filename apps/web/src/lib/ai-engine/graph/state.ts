/**
 * Graph state definition for the AI content generation engine.
 *
 * Re-exports the canonical state defined in `types/state.ts` so that graph
 * modules can import from a single barrel (`graph/`) without reaching into
 * the types package directly.
 */

export {
  ContentGenerationState,
  type ContentGenerationStateType,
  type ContentGenerationUpdateType,
  type ContentVariant,
} from '../types/state';
