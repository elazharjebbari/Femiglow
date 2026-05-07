# Page — `/admin/webhooks/[id]/deliveries`

| Aspect | Valeur |
|---|---|
| Type | Server Component |
| Auth | requise |
| Layout | admin |
| Breadcrumb | `Webhooks / {nom} / Livraisons` |

## Wireframe

Voir [`../../03-ux-navigation/wireframes-textuels.md`](../../03-ux-navigation/wireframes-textuels.md#adminwebhooksiddeliveries).

## Comportement

1. `getWebhookEndpoint(id)` charge l'endpoint. Si null/deleted → `notFound()`.
2. `listDeliveries(id, filters)` charge les livraisons paginées.
3. Filtres : statut, période, type d'événement, code HTTP.
4. Click sur ligne → détail dans drawer latéral (Client Component).

## En-tête

```
┌─────────────────────────────────────────────────────────────┐
│ Slack #leads                                          [Edit]│
│ https://hooks.slack.com/services/T01/B02/xxxx               │
│ Événements : lead.created, order.created                    │
│ Statut : ✓ Actif    Dernière livraison : il y a 2 min       │
└─────────────────────────────────────────────────────────────┘
```

## Filtres

| Filtre | Param URL | Valeurs |
|---|---|---|
| Statut | `status` | `pending`, `delivered`, `failed`, `dead` |
| Période from | `from` | ISO date |
| Période to | `to` | ISO date |
| Événement | `event` | enum (`lead.created`, …) |
| Code HTTP | `http_code` | text (200, 4xx, 5xx) |

## Tableau

| Colonne | Contenu |
|---|---|
| Date | `2026-05-03 14:32:18` (absolu, tabular-nums) |
| Événement | `lead.created` |
| Tentative | `1/5` |
| HTTP | code couleur (vert 2xx, orange 4xx, rouge 5xx) |
| Latence | `187 ms` (tabular-nums) |
| Statut | badge (`pending`/`delivered`/`failed`/`dead`) |
| Action | bouton "Voir" → drawer |

## Drawer de détail

Largeur 480px, slide-in depuis la droite, dismissible avec Esc.

```
┌──────────────────────────────────────────┐
│ Livraison #abc123                    [×] │
├──────────────────────────────────────────┤
│                                          │
│ Statut : delivered                       │
│ Tentative : 2/5                          │
│ Programmée : 14:30:18                    │
│ Tentée : 14:32:00                        │
│ Latence : 187 ms                         │
│ HTTP : 200                               │
│                                          │
│ ── Headers envoyés ──                    │
│ Content-Type: application/json           │
│ X-FemiGlow-Signature: sha256=...         │
│ X-FemiGlow-Event: lead.created           │
│ X-FemiGlow-Delivery: 01HXY...            │
│ Idempotency-Key: 01HXY...                │
│                                          │
│ ── Payload ──                            │
│ <pre> JSON formaté </pre>                │
│                                          │
│ ── Réponse ──                            │
│ <pre> body 1024 char max </pre>          │
│                                          │
│ [Renvoyer maintenant]                    │
│                                          │
└──────────────────────────────────────────┘
```

## Action « Renvoyer »

```tsx
async function handleRetry() {
  const res = await fetch(
    `/api/admin/webhook-deliveries/${delivery.id}/retry`,
    { method: 'POST' }
  );
  if (!res.ok) toast.error('Erreur');
  else {
    toast.success('Livraison reprogrammée.');
    router.refresh();
  }
}
```

Backend reset `attempts` au seuil correct, met `status='pending'`, `next_attempt_at=now()`.

## Statistiques en haut

3 KPIs au-dessus du tableau :

| KPI | Calcul |
|---|---|
| Taux de succès 24h | `delivered / total` |
| Latence p95 24h | percentile 95 sur `duration_ms` |
| Échecs récents | count `status IN (failed, dead)` 24h |

## Empty state

> "Aucune livraison enregistrée.
> Les événements apparaîtront ici dès qu'un lead sera créé."

## Tests

| Type | Fichier |
|---|---|
| Unit | `DeliveriesTable.test.tsx`, `DeliveryDrawer.test.tsx`, `DeliveryStats.test.tsx` |
| MSW | `scenario-deliveries-list.md`, `scenario-deliveries-filter.md`, `scenario-delivery-detail.md`, `scenario-delivery-retry.md`, `scenario-delivery-retry-conflict.md` |
| a11y | `jest-axe` (focus trap dans drawer) |
| E2E | `e2e/webhook-deliveries.spec.ts` |
