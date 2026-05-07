import 'server-only';
import { recordUsage as dbRecordUsage } from '@/lib/db/queries/media-usages';
import type { MediaContext, MediaUsageType } from '@/lib/db/types';

interface UsageInput {
  mediaId: string;
  route: string;
  component: string;
  context: MediaContext;
  usageType?: MediaUsageType;
}

const inferUsageType = (component: string): MediaUsageType => {
  if (component.toLowerCase().includes('og')) return 'og';
  return 'page';
};

export async function recordUsage(input: UsageInput): Promise<void> {
  try {
    await dbRecordUsage({
      mediaId: input.mediaId,
      usageType: input.usageType ?? inferUsageType(input.component),
      route: input.route || '/',
      component: input.component,
      context: input.context,
    });
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug(
        `[media] usage recorded: ${input.mediaId} @ ${input.route} (${input.component})`,
      );
    }
  } catch {
    // best-effort: silencieux en prod
  }
}
