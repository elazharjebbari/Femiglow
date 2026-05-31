'use client';

import { AutomationWizard } from '@/components/admin/emails/automation/AutomationWizard';
import { updateAutomation } from '@/lib/admin/emails/automation-mutations';

export function EditAutomationPageClient({
  initial,
  eventsCatalog,
}: {
  initial: Parameters<typeof AutomationWizard>[0]['initial'];
  eventsCatalog: Array<{ name: string; category: string; description: string }>;
}) {
  return (
    <AutomationWizard
      initial={initial}
      eventsCatalog={eventsCatalog}
      submitLabel="Enregistrer"
      onSubmit={async (state) => {
        if (!state.id) throw new Error('Missing id');
        await updateAutomation({
          id: state.id,
          slug: state.slug,
          name: state.name,
          triggerType: state.triggerType,
          triggerConfig: state.triggerConfig,
          triggerConditions: state.triggerConditions ?? undefined,
          steps: state.steps,
          cooldownSeconds: state.frequency.cooldownSeconds,
          quietHoursEnabled: state.frequency.quietHoursEnabled,
          quietHoursStart: state.frequency.quietHoursStart,
          quietHoursEnd: state.frequency.quietHoursEnd,
          quietHoursTz: state.frequency.quietHoursTz,
          dailyCap: state.frequency.dailyCap,
          active: state.active,
        });
      }}
    />
  );
}
