/**
 * Interface pour la détection de visages sur photos importées.
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 6.1
 *
 * Implémentation par défaut : `noopProvider` (rejette tout en MANUAL_REVIEW
 * par sécurité, force la modération humaine). En production, brancher
 * `mediaPipeProvider` après installation de @mediapipe/tasks-vision et
 * mise en cache du modèle.
 */
import type { RitualPhotoFacesStatus } from '@/lib/db/types';

export interface FacesCheckResult {
  status: RitualPhotoFacesStatus;
  facesCount: number;
}

export interface VisionMLProvider {
  name: string;
  check(input: { buffer?: Buffer; url?: string }): Promise<FacesCheckResult>;
}

/**
 * Provider sûr par défaut : marque chaque photo en MANUAL_REVIEW
 * pour garantir la modération humaine tant qu'aucun provider concret
 * n'est branché. Préserve la promesse « visages jamais publiés sans
 * lecture humaine ».
 */
export const safeManualProvider: VisionMLProvider = {
  name: 'safe-manual',
  async check() {
    return { status: 'MANUAL_REVIEW', facesCount: 0 };
  },
};

/**
 * Provider pour les tests : suit une heuristique fixture-based via le nom
 * de blob (`/face/`, `/hands/`, `/hijab/`). Utile pour Vitest + MSW.
 */
export const fixtureProvider: VisionMLProvider = {
  name: 'fixture',
  async check({ url, buffer }) {
    const hint = (url ?? '').toLowerCase();
    if (hint.includes('/face/') || hint.includes('frontal')) {
      return { status: 'REJECTED_FACE', facesCount: 1 };
    }
    if (hint.includes('hijab') || hint.includes('partial')) {
      return { status: 'MANUAL_REVIEW', facesCount: 1 };
    }
    if (hint.includes('hands') || hint.includes('mains')) {
      return { status: 'OK', facesCount: 0 };
    }
    // buffer vide ou inconnu → manual review par sécurité
    if (!buffer || buffer.length < 100) {
      return { status: 'MANUAL_REVIEW', facesCount: 0 };
    }
    return { status: 'OK', facesCount: 0 };
  },
};

let activeProvider: VisionMLProvider = safeManualProvider;

export function setVisionMLProvider(provider: VisionMLProvider): void {
  activeProvider = provider;
}

export function getVisionMLProvider(): VisionMLProvider {
  return activeProvider;
}

/** Helper de timeout — retourne MANUAL_REVIEW si dépassé. */
export async function checkFacesWithTimeout(
  input: { buffer?: Buffer; url?: string },
  timeoutMs = 5000,
): Promise<FacesCheckResult> {
  return Promise.race<FacesCheckResult>([
    activeProvider.check(input),
    new Promise<FacesCheckResult>((resolve) =>
      setTimeout(
        () => resolve({ status: 'MANUAL_REVIEW', facesCount: 0 }),
        timeoutMs,
      ),
    ),
  ]);
}
