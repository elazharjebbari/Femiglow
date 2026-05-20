import type { SocialPublishRequest, SocialPublishResult, SocialPublishingAdapter } from './contracts';
import { SocialPublishingError } from './errors';
import { withRetry } from './retry';

export async function publishWithAdapter(
  adapter: SocialPublishingAdapter,
  request: SocialPublishRequest,
): Promise<SocialPublishResult> {
  if (adapter.provider !== request.account.provider) {
    return {
      ok: false,
      status: 'failed',
      error: {
        code: 'invalid_request',
        message: `Adapter ${adapter.provider} cannot publish for account provider ${request.account.provider}`,
        retryable: false,
      },
    };
  }

  return withRetry(
    async () => {
      const result = await adapter.publish(request);
      if (!result.ok && result.error.retryable) {
        throw new SocialPublishingError({
          code: result.error.code,
          message: result.error.message,
          retryable: true,
          status: result.error.status,
          details: result.error.details,
        });
      }
      return result;
    },
    {
      attempts: 3,
      shouldRetry: (err) => err instanceof SocialPublishingError && err.retryable,
    },
  ).catch((err) => ({
    ok: false as const,
    status: 'failed' as const,
    error: err instanceof SocialPublishingError
      ? {
          code: err.code,
          message: err.message,
          retryable: err.retryable,
          status: err.status,
          details: err.details,
        }
      : {
          code: 'unknown_provider_error' as const,
          message: err instanceof Error ? err.message : 'Unknown social publishing error',
          retryable: false,
        },
  }));
}
