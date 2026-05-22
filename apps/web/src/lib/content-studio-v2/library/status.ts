/**
 * Status presentation helpers — label + tone for the v2 Badge primitive.
 *
 * Hors composant pour rester testable et facilement réutilisé par
 * d'autres modes (Plan calendar tiles, etc).
 */

import type { ContentStatus } from '@/lib/content-studio/types';
import type { BadgeProps } from '@/components/admin/content-studio-v2/primitives';

export interface StatusPresentation {
  label: string;
  tone: NonNullable<BadgeProps['tone']>;
}

const PRESENTATION: Record<ContentStatus, StatusPresentation> = {
  idea: { label: 'Idée', tone: 'neutral' },
  brief: { label: 'Brief', tone: 'neutral' },
  generated: { label: 'Généré', tone: 'violet' },
  needs_review: { label: 'À revoir', tone: 'warning' },
  approved: { label: 'Approuvé', tone: 'success' },
  scheduled: { label: 'Programmé', tone: 'accent' },
  published: { label: 'Publié', tone: 'sage' },
  failed: { label: 'Échec', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'clay' },
  rejected: { label: 'Rejeté', tone: 'danger' },
  archived: { label: 'Archivé', tone: 'neutral' },
  measured: { label: 'Mesuré', tone: 'sage' },
};

export function presentStatus(status: ContentStatus): StatusPresentation {
  return PRESENTATION[status] ?? { label: status, tone: 'neutral' };
}
