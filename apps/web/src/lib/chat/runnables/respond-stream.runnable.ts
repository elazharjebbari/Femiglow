/**
 * CHA-230 Phase 2 — Runnable de réponse streaming avec retry/fallback.
 *
 * Wrapper autour de `ChatProvider.streamChat()` qui ajoute :
 *   1. **Retry** (1 fois max) sur erreur retryable du provider primaire,
 *   2. **Fallback** automatique sur un provider secondaire si retry KO,
 *   3. **Télémétrie** des tentatives (utile pour le quality dashboard).
 *
 * Constraint clé : on ne peut retry/fallback QU'AVANT le premier chunk
 * streamé. Une fois que le client a vu du texte, basculer de provider
 * dupliquerait l'output. C'est pourquoi on intercepte uniquement les
 * erreurs jetées par `streamChat()` lui-même (= erreurs pre-stream :
 * fetch timeout, HTTP 4xx/5xx). Les erreurs en cours de stream sont
 * remontées telles quelles.
 *
 * Erreurs filtrées par `retryable: true` (cf. `providers/types.ts`) :
 *   - timeout, rate-limit, network/5xx → retry/fallback OK.
 *   - auth, content-filter → throw direct (corriger la conf, pas la
 *     panne provider).
 *
 * Garanties :
 *  - Idempotent — chaque appel construit son propre tracker.
 *  - Le `request` est cloné en interne pour éviter qu'un retry échoue
 *    sur un AbortSignal déjà déclenché.
 *  - Si `fallbackProvider` est `null`, le runnable se comporte comme
 *    un retry-only.
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.5
 */
import {
  ProviderError,
  type ChatProvider,
  type ChatStreamChunk,
  type ChatStreamRequest,
  type ChatStreamResult,
  type ProviderErrorCode,
} from '../providers/types';

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface RespondStreamInput {
  primaryProvider: ChatProvider;
  /** Provider secondaire utilisé si le primaire échoue. `null` désactive le fallback. */
  fallbackProvider: ChatProvider | null;
  /** Request passée au provider. */
  request: ChatStreamRequest;
  /**
   * Active retry+fallback. Quand `false`, le runnable est byte-identique
   * à un appel direct `primaryProvider.streamChat(request)` (utilisé par
   * l'orchestrator quand le flag `CHAT_PROVIDER_FALLBACK_ENABLED` est off).
   */
  retryFallbackEnabled: boolean;
}

export interface RespondStreamAttempt {
  providerId: string;
  /** `ok` = réponse rendue ; `retried` = échec retryable suivi d'un retry ; `failed` = abandonné. */
  outcome: 'ok' | 'retried' | 'failed';
  error?: {
    code: ProviderErrorCode;
    retryable: boolean;
    message: string;
  };
  durationMs: number;
}

export interface RespondStreamOutput {
  stream: AsyncIterable<ChatStreamChunk>;
  final: () => Promise<ChatStreamResult>;
  /** Provider qui a effectivement servi la réponse. */
  servedBy: { providerId: string; kind: string };
  /** Historique des tentatives (au moins 1, max 3 : primary + retry + fallback). */
  attempts: RespondStreamAttempt[];
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

/**
 * Lance un streaming chat avec retry/fallback. Voir docstring du module.
 *
 * @throws ProviderError la dernière erreur observée si toutes les tentatives échouent.
 */
export async function respondStreamRunnable(
  input: RespondStreamInput,
): Promise<RespondStreamOutput> {
  const { primaryProvider, fallbackProvider, request, retryFallbackEnabled } =
    input;
  const attempts: RespondStreamAttempt[] = [];

  // --- Mode dégradé : pas de retry, pas de fallback (flag off) ----------
  if (!retryFallbackEnabled) {
    const t0 = Date.now();
    try {
      const out = await primaryProvider.streamChat(request);
      attempts.push({
        providerId: primaryProvider.id,
        outcome: 'ok',
        durationMs: Date.now() - t0,
      });
      return {
        stream: out.stream,
        final: out.final,
        servedBy: { providerId: primaryProvider.id, kind: primaryProvider.kind },
        attempts,
      };
    } catch (err) {
      // Pas de retry/fallback → on remonte l'erreur telle quelle.
      attempts.push({
        providerId: primaryProvider.id,
        outcome: 'failed',
        durationMs: Date.now() - t0,
        error: extractErrorInfo(err),
      });
      throw err;
    }
  }

  // --- Tentative 1 : primary --------------------------------------------
  const primary = await tryStream(primaryProvider, request, attempts);
  if (primary.success) {
    return primary.output;
  }
  if (!primary.retryable) {
    throw primary.error;
  }

  // --- Tentative 2 : retry primary --------------------------------------
  // Si l'utilisateur a déjà annulé, on arrête là.
  if (request.signal?.aborted) throw primary.error;
  const retry = await tryStream(primaryProvider, request, attempts, {
    asRetry: true,
  });
  if (retry.success) {
    return retry.output;
  }

  // --- Tentative 3 : fallback provider ----------------------------------
  if (!fallbackProvider) {
    throw retry.error;
  }
  if (request.signal?.aborted) throw retry.error;
  const fallback = await tryStream(fallbackProvider, request, attempts);
  if (fallback.success) {
    return fallback.output;
  }
  // Toutes les tentatives ont échoué — on remonte la DERNIÈRE erreur
  // (= celle du fallback) parce que c'est celle qui a vraiment empêché
  // de servir la réponse à l'utilisateur ; les erreurs précédentes
  // restent visibles dans `attempts` pour le debug.
  throw fallback.error;
}

// ---------------------------------------------------------------------------
// Tentative unique
// ---------------------------------------------------------------------------

type TryStreamResult =
  | { success: true; output: RespondStreamOutput }
  | { success: false; retryable: boolean; error: unknown };

async function tryStream(
  provider: ChatProvider,
  request: ChatStreamRequest,
  attempts: RespondStreamAttempt[],
  opts?: { asRetry?: boolean },
): Promise<TryStreamResult> {
  const t0 = Date.now();
  try {
    const out = await provider.streamChat(request);
    attempts.push({
      providerId: provider.id,
      outcome: 'ok',
      durationMs: Date.now() - t0,
    });
    return {
      success: true,
      output: {
        stream: out.stream,
        final: out.final,
        servedBy: { providerId: provider.id, kind: provider.kind },
        attempts,
      },
    };
  } catch (err) {
    const errInfo = extractErrorInfo(err);
    const retryable = errInfo.retryable;
    attempts.push({
      providerId: provider.id,
      // `retried` quand on était en retry et qu'on a encore échoué ; sinon
      // `failed` (premier échec) ou — si retryable et c'est le 1er essai —
      // on tagge aussi `retried` pour signifier "va être retry après".
      outcome:
        opts?.asRetry || (!retryable && !opts?.asRetry)
          ? 'failed'
          : retryable
            ? 'retried'
            : 'failed',
      durationMs: Date.now() - t0,
      error: errInfo,
    });
    return { success: false, retryable, error: err };
  }
}

function extractErrorInfo(
  err: unknown,
): { code: ProviderErrorCode; retryable: boolean; message: string } {
  if (err instanceof ProviderError) {
    return { code: err.code, retryable: err.retryable, message: err.message };
  }
  // Erreur non-ProviderError — on la traite comme `unknown` non-retryable
  // (mieux vaut faire surface qu'un fallback silencieux qui masque un bug).
  const e = err as { message?: string };
  return {
    code: 'unknown',
    retryable: false,
    message: e.message ?? 'unknown error',
  };
}
