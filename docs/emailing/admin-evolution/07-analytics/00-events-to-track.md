# Analytics admin — events à tracker

> Pour mesurer l'usage et l'efficacité du nouveau cockpit admin.

## Events à émettre depuis l'admin UI

Format : `admin.emails.<scope>.<action>`

### Transactional cockpit
- `admin.emails.transactional.viewed` (page load)
- `admin.emails.transactional.search_applied` { filtersCount, freetextLen }
- `admin.emails.transactional.cmdk_opened`
- `admin.emails.transactional.view_saved` { viewName }
- `admin.emails.transactional.bulk_action` { action, count }
- `admin.emails.transactional.row_clicked` (drill-down to detail)
- `admin.emails.transactional.retry_clicked` (single)
- `admin.emails.transactional.export_csv`

### Audiences
- `admin.emails.audience.list_viewed`
- `admin.emails.audience.create_started`
- `admin.emails.audience.create_step_completed` { stepIndex }
- `admin.emails.audience.create_finished` { rulesCount, hasOr }
- `admin.emails.audience.preview_refreshed` { durationMs, size }
- `admin.emails.audience.snapshot_started`
- `admin.emails.audience.snapshot_completed` { size, durationMs }
- `admin.emails.audience.deleted`

### Campagnes (V2 wizard)
- `admin.emails.campaign.wizard_started`
- `admin.emails.campaign.audience_selected` { type: 'saved'|'adhoc' }
- `admin.emails.campaign.finalized` { audienceSize }

### Automation
- `admin.emails.automation.list_viewed`
- `admin.emails.automation.create_started`
- `admin.emails.automation.step_added` { kind }
- `admin.emails.automation.created` { stepsCount, hasBranch }
- `admin.emails.automation.toggled` { active }
- `admin.emails.automation.deleted`
- `admin.emails.automation.run_cancelled`

## Pourquoi ?

Tableau de bord interne (V2) pour répondre à :
- Quels filtres sont les plus utilisés en transactional ?
- Quels types de critères audience sont populaires ?
- Quel pourcentage d'admins finit le wizard audience ? (funnel)
- Quels step types sont les plus utilisés dans les automations ?
- Combien d'actions par session admin ?

## Implémentation

Tracking via une fonction utilitaire qui INSERT en `user_event`
(table déjà existante après M5.2) avec `source='admin'`, `email`=admin
email, `event_name`=event ci-dessus, `properties`=context.

```typescript
// lib/admin/analytics.ts
export async function trackAdminEvent(
  event: AdminEvent,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const session = await getAdminSession();
  if (!session) return;
  
  await insertUserEvent({
    email: session.email,
    event_name: event,
    properties,
    source: 'admin',
  });
}
```

Usage :
```typescript
await trackAdminEvent('admin.emails.audience.created', {
  rulesCount: 3,
  hasOr: false,
});
```

## Vie privée

Ces events ne contiennent **pas** d'email user end. Juste les actions
admin sur la plateforme.

## Pas en V1

L'instrumentation peut être faite en M5.6 (polish). Pas critique pour
l'usage métier.

## Dashboard V2

Une page interne `/admin/emails/insights` (V2) consommerait ces events
pour afficher des heatmaps + funnels.
