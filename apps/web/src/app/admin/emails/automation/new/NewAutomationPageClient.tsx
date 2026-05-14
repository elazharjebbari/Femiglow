'use client';

import { AutomationWizard } from '@/components/admin/emails/automation/AutomationWizard';
import { createAutomation } from '@/lib/admin/emails/automation-mutations';

export function NewAutomationPageClient({
  eventsCatalog,
}: {
  eventsCatalog: Array<{ name: string; category: string; description: string }>;
}) {
  return (
    <AutomationWizard
      eventsCatalog={eventsCatalog}
      onSubmit={async (state) => {
        return createAutomation({
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
