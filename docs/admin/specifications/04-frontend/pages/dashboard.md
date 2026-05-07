# Page — `/admin/dashboard`

| Aspect | Valeur |
|---|---|
| Type | Server Component, streaming via Suspense |
| Auth | requise |
| Layout | admin (header + sidebar) |
| Breadcrumb | "Tableau de bord" |

## Wireframe

Voir [`../../03-ux-navigation/wireframes-textuels.md`](../../03-ux-navigation/wireframes-textuels.md#admindashboard).

## Sections

### 1. KPI cards (3 cartes)

| Carte | Requête | Couleur accent |
|---|---|---|
| **Leads 24 h** | `count(leads WHERE created_at > NOW() - INTERVAL '24h')` | ciel |
| **Non traités** | `count(leads WHERE status = 'new')` | champagne |
| **Livraisons KO 24 h** | `count(deliveries WHERE status='failed' AND created_at > NOW() - INTERVAL '24h')` | petale |

Chaque carte :
- Compteur grand (Cormorant 36 px tabular-nums).
- Libellé kicker.
- Sous-texte : variation vs J-1 ou lien "Voir détails →".
- Click sur la carte → navigation filtrée.

### 2. Derniers leads (5)

Tableau compact :

| Date | Nom | Type | Statut | Action |
|---|---|---|---|---|
| il y a Xh | Prénom Nom | badge | badge | → |

Lien "Voir tous les leads →" sous le tableau.

## Streaming

```tsx
export default function DashboardPage() {
  return (
    <Container width="content">
      <Heading level={1}>Tableau de bord</Heading>
      <Suspense fallback={<KPISkeleton />}>
        <KPICards />
      </Suspense>
      <Suspense fallback={<RecentLeadsSkeleton />}>
        <RecentLeads />
      </Suspense>
    </Container>
  );
}

async function KPICards() {
  const kpi = await getDashboardKpi();
  return <div className="grid grid-cols-3 gap-4">…</div>;
}
```

## Requêtes Drizzle

`apps/web/src/lib/db/queries/kpi.ts` :

```ts
export async function getDashboardKpi() {
  const [{ count: leads24h }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(gt(leads.createdAt, sql`NOW() - INTERVAL '24 hours'`));
  // ... répété pour les 2 autres
  return { leads24h, untreated, failedDeliveries24h };
}
```

## Tests

| Type | Fichier |
|---|---|
| Unit | `getDashboardKpi.test.ts` (testé avec DB de test seedée) |
| MSW | sans objet (lecture directe DB côté serveur) |
| E2E | `e2e/dashboard.spec.ts` — login → vérifier les compteurs présents |
