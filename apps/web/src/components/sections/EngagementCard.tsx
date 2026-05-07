import type { Engagement } from '@/lib/schemas';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';

interface EngagementCardProps {
  engagement: Engagement;
}

export function EngagementCard({ engagement }: EngagementCardProps) {
  const ordreLabel = String(engagement.ordre).padStart(2, '0');
  return (
    <article className="flex flex-col gap-4">
      <span
        aria-hidden="true"
        className="font-display text-[3.5rem] italic leading-none text-champagne-dark"
      >
        {ordreLabel}
      </span>
      <Heading as="h3" size="sm" italic="auto">
        {engagement.titre}
      </Heading>
      <Text size="small" tone="secondary">
        {engagement.description}
      </Text>
    </article>
  );
}
