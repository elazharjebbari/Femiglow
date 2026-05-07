import 'server-only';
import type { RituelInterview } from '@/lib/schemas';
import { InterviewQR } from './InterviewQR';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface InterviewQRBoundProps {
  data: RituelInterview;
  /**
   * Composant du registre dont le slot 'avatar' alimente le portrait.
   * Si un binding actif existe, il prime sur `data.portrait` (CMS).
   */
  componentKey: string;
  slot?: string;
}

/**
 * RSC wrapper qui résout `componentKey/avatar` (par défaut) pour `InterviewQR`.
 */
export async function InterviewQRBound({
  data,
  componentKey,
  slot = 'avatar',
}: InterviewQRBoundProps) {
  const resolved = await resolveComponentSlot(componentKey, slot);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <InterviewQR data={data} />;
  }

  return (
    <InterviewQR
      data={data}
      portraitSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot={slot}
          context="inline"
          sizes="(min-width: 1024px) 30vw, 100vw"
        />
      }
    />
  );
}
