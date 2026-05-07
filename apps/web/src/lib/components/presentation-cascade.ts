/**
 * Cascade de résolution de la *présentation* d'un media affecté à un slot.
 *
 * Trois niveaux d'override possibles, par ordre décroissant de précédence :
 *
 *   1. `binding.X`         — config posée à l'usage (ce slot, ce composant)
 *   2. `media.overrides.X` — config portée par le media (toutes utilisations)
 *   3. `slot.XDefault`     — défaut imposé par le slot (cohérence visuelle)
 *   4. valeur codée        — filet de sécurité ('cover', 'center', undefined)
 *
 * Subtilité fondamentale : un binding fraîchement seedé porte les valeurs
 * neutres (`objectFit='cover'`, `objectPosition='center'`) — on ne peut donc
 * pas naïvement faire `binding.X ?? overrides.X ?? slot.X`, sinon le binding
 * masquerait toujours les autres niveaux. On considère qu'une valeur
 * "neutre" du binding signifie « non explicitement configuré », et la
 * cascade redescend automatiquement vers les niveaux inférieurs.
 *
 * Exposé en pure function pour permettre des tests unitaires déterministes.
 */
import type {
  ComponentMediaBinding,
  MediaObjectFit,
  MediaObjectPosition,
  MediaOverrides,
  SlotDefinition,
} from '@/lib/db/types';

export interface CascadeInput {
  binding: Pick<
    ComponentMediaBinding,
    'objectFit' | 'objectPosition' | 'focalX' | 'focalY' | 'backgroundFill'
  > | null;
  overrides: MediaOverrides | null | undefined;
  slot:
    | Pick<
        SlotDefinition,
        | 'objectFitDefault'
        | 'objectPositionDefault'
        | 'backgroundFillDefault'
        | 'aspectRatioHint'
      >
    | null
    | undefined;
}

export interface ResolvedPresentation {
  objectFit: MediaObjectFit;
  objectPosition: MediaObjectPosition;
  focalX: number | null;
  focalY: number | null;
  backgroundFill: string | undefined;
  slotAspectRatio: string | undefined;
}

const DEFAULT_FIT: MediaObjectFit = 'cover';
const DEFAULT_POSITION: MediaObjectPosition = 'center';

export function resolvePresentation(input: CascadeInput): ResolvedPresentation {
  const { binding, overrides, slot } = input;
  const ov = overrides ?? {};

  const cascadeFit = ov.objectFit ?? slot?.objectFitDefault ?? DEFAULT_FIT;
  const objectFit =
    binding?.objectFit && binding.objectFit !== DEFAULT_FIT
      ? binding.objectFit
      : cascadeFit;

  const cascadePos =
    ov.objectPosition ?? slot?.objectPositionDefault ?? DEFAULT_POSITION;
  const objectPosition =
    binding?.objectPosition && binding.objectPosition !== DEFAULT_POSITION
      ? binding.objectPosition
      : cascadePos;

  const focalX = binding?.focalX ?? ov.focalX ?? null;
  const focalY = binding?.focalY ?? ov.focalY ?? null;

  const backgroundFill =
    binding?.backgroundFill ??
    ov.backgroundFill ??
    slot?.backgroundFillDefault ??
    undefined;

  return {
    objectFit,
    objectPosition,
    focalX,
    focalY,
    backgroundFill,
    slotAspectRatio: slot?.aspectRatioHint,
  };
}
