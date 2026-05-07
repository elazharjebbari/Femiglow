# Page — `/admin/webhooks`

| Aspect | Valeur |
|---|---|
| Type | Server Component |
| Auth | requise |
| Layout | admin |
| Breadcrumb | "Webhooks" |

## Wireframe

Voir [`../../03-ux-navigation/wireframes-textuels.md`](../../03-ux-navigation/wireframes-textuels.md#adminwebhooks).

## Comportement

1. `listWebhookEndpoints()` charge tous les endpoints (incluant désactivés mais pas soft-deleted).
2. Pour chaque endpoint, calcule en agrégat :
   - Nombre de livraisons 24h
   - Nombre d'échecs 24h
   - Date dernière livraison réussie
3. Bouton "Nouveau webhook" → `/admin/webhooks/new`.
4. Click sur ligne → `/admin/webhooks/[id]/deliveries`.

## Tableau

| Colonne | Contenu |
|---|---|
| Nom | label libre (string ≤ 80) |
| URL | tronquée 40 char + tooltip URL complète |
| Événements | badges (`lead.created`, `order.created`, …) max 3 + "+N" |
| Actif | toggle on/off (changement immédiat) |
| Livraisons 24h | compteur (succès / total) |
| Dernière livraison | relative + statut (✓ ou ✗) |
| Action | menu kebab : Modifier · Désactiver · Supprimer |

## Toggle actif/inactif

```tsx
<Switch
  checked={endpoint.active}
  onCheckedChange={async (next) => {
    await fetch(`/api/admin/webhooks/${endpoint.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: next }),
    });
    router.refresh();
  }}
/>
```

Pas d'optimistic ici — la valeur est trop critique pour un rollback silencieux.

## Suppression

Suppression = soft-delete (`deleted_at` rempli, plus aucune émission).
Confirmation modale obligatoire :

> "Êtes-vous sûre de vouloir supprimer le webhook **{nom}** ?
> Les livraisons en file d'attente seront annulées.
> Les données historiques seront conservées 18 mois."

## Empty state

> "Aucun webhook configuré.
> Créez-en un pour notifier vos systèmes externes lors d'un nouveau lead."
> CTA : "Nouveau webhook"

## Indicateur de santé

Badge en haut de la page si tout va bien :

> ✓ Tous les webhooks fonctionnent.

Sinon (au moins 1 endpoint avec ≥3 échecs consécutifs récents) :

> ⚠ 2 webhooks en erreur — voir le détail.

## Tests

| Type | Fichier |
|---|---|
| Unit | `WebhooksTable.test.tsx`, `WebhookToggle.test.tsx`, `DeleteWebhookDialog.test.tsx` |
| MSW | `scenario-webhooks-list.md`, `scenario-webhooks-toggle.md`, `scenario-webhooks-delete.md` |
| a11y | `jest-axe` |
| E2E | `e2e/webhooks-list.spec.ts` |
