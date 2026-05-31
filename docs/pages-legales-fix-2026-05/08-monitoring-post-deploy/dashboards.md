# Dashboards

## 1. `/admin/legal/audit` (à créer optionnellement)

Vue temps-réel de la santé du module :

```
┌────────────────────────────────────────────────────────────┐
│  Audit pages légales                  Snapshot: il y a 2min│
│  ────────────────────────────────────────────────────────  │
│                                                              │
│  📊 État général                                             │
│  ┌────────────────────┐                                     │
│  │ 9 pages métier     │   6 publiées · 3 drafts            │
│  │ 0 E2E orphans  ✅  │                                     │
│  │ 24 vars définies   │                                     │
│  │ 0 drift detected ✅│                                     │
│  └────────────────────┘                                     │
│                                                              │
│  🔴 Drafts bloqués (missing_vars)  0                        │
│                                                              │
│  🟡 Vars requises vides (X)                                 │
│  • DELIVERY_PARTNER                                          │
│  • COMPANY_FORM                                              │
│  • COMPANY_RC                                                │
│  • HOSTING_NAME                                              │
│  • HOSTING_ADDRESS                                           │
│  • ICE                                                       │
│                                                              │
│  📧 Email legal@femiglow-maroc.com                          │
│  • 2 demandes < 24h                                          │
│  • 0 demandes > 5j (SLA dépassé)                            │
│                                                              │
│  [Cleanup E2E] [Audit drift] [Republish all]               │
└────────────────────────────────────────────────────────────┘
```

Données via SQL + email inbox monitoring.

## 2. Sentry dashboard

### Project: femiglow-prod

**Filtres** :
- Tag `release:legal-v2`
- Search `legal.vars` OR `legal.cleanup`
- Time : 24h / 7d / 30d

**Issues à surveiller** :
1. Erreur SSR `/legal/*` — devrait être 0
2. Erreur INSERT legal_template_vars — devrait être 0
3. Erreur cleanup endpoint — devrait être 0
4. Erreur missing var inattendue — devrait être 0

## 3. Vercel logs filtrés

```bash
# Tous les events legal
vercel logs --follow | grep -E '"event":"legal\.(vars|cleanup|publish)"'

# Erreurs uniquement
vercel logs --follow --level error | grep "legal"
```

**Volumes attendus** :
- `legal.vars.create` : 1-2 events/mois (création manuelle admin)
- `legal.cleanup.e2e` : 1 event/semaine (cron)
- `legal.publish` : 1-5 events/mois

## 4. Plausible events custom

### Events à émettre

```ts
// /admin/legal visit
plausible('admin_legal_view', {
  props: { pages_total: stats.total, drafts: stats.drafts }
});

// /admin/legal/template-vars visit
plausible('admin_legal_vars_view', {
  props: { vars_total: vars.length }
});

// Create var
plausible('admin_legal_var_create', {
  props: { key }
});

// Cleanup E2E executed
plausible('admin_legal_cleanup_executed', {
  props: { deleted: result.deleted }
});

// Publish success/fail
plausible('admin_legal_publish', {
  props: { slug, status: 'success' | 'missing_vars' }
});
```

### Custom dashboard "Legal Admin Health"

- Bar chart : `admin_legal_view` par jour (7d)
- Counter : `admin_legal_var_create` total (30d)
- Funnel : view → edit → publish
- Filter : par slug pour analyser pages individuelles

## 5. Section dans `/admin/live-health`

Si le projet a déjà un dashboard live-health (sprint `live-systems-fix-2026-05`), ajouter une carte :

```tsx
<section aria-label="Santé legal">
  <h2>Legal pages</h2>
  <KpiCard
    label="Drift count"
    value={driftCount}
    accent={driftCount > 0 ? 'rose' : 'emerald'}
  />
  <KpiCard
    label="E2E orphans"
    value={e2eOrphans}
    accent={e2eOrphans > 10 ? 'rose' : 'stone'}
  />
  <KpiCard
    label="Pages publiées"
    value={published}
    accent="emerald"
  />
</section>
```

## 6. CLI dashboard rapide

**Fichier nouveau** : `apps/web/scripts/legal-status.ts`

```ts
import './_load-env.mjs';
import { db, schema } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function main() {
  const conn = db()!;
  const [pages] = await conn.select({ value: sql<number>`COUNT(*)` }).from(schema.legalPages);
  const [drafts] = await conn.select({ value: sql<number>`COUNT(*)` }).from(schema.legalPages)
    .where(sql`status = 'draft' AND slug NOT LIKE 'e2e-test-%'`);
  const [orphans] = await conn.select({ value: sql<number>`COUNT(*)` }).from(schema.legalPages)
    .where(sql`slug LIKE 'e2e-test-%'`);
  const [vars] = await conn.select({ value: sql<number>`COUNT(*)` }).from(schema.legalTemplateVars);

  console.log('\n📊 Legal status\n');
  console.log(`  Pages totales      : ${pages?.value}`);
  console.log(`  Drafts métier      : ${drafts?.value}`);
  console.log(`  E2E orphans        : ${orphans?.value}`);
  console.log(`  Vars définies      : ${vars?.value}`);
  console.log('');
}

main().catch(console.error);
```

Usage :
```bash
pnpm tsx scripts/legal-status.ts
```

## 7. Screenshots pour archive

À sauvegarder dans `docs/pages-legales-fix-2026-05/screenshots/` :

- `prod-mentions-legales-before.png` (avec ICE visible)
- `prod-mentions-legales-after.png` (anonymisé)
- `prod-admin-legal-before.png` (E2E orphans visibles)
- `prod-admin-legal-after.png` (propre)
- `prod-admin-template-vars-after.png` (avec bouton + nouvelle var)
