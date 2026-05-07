# Page — `/admin/leads/[id]`

| Aspect | Valeur |
|---|---|
| Type | Server Component, streaming via Suspense |
| Auth | requise |
| Layout | admin |
| Breadcrumb | `Leads / {nom complet}` |

## Wireframe

Voir [`../../03-ux-navigation/wireframes-textuels.md`](../../03-ux-navigation/wireframes-textuels.md#adminleadsid).

## Comportement

1. `params.id` est validé via `cuid2.isCuid()`. Si invalide → `notFound()`.
2. `getLead(id)` charge le lead + ordre + items + livraisons + timeline.
3. Si `null` ou `deleted_at !== null` → `notFound()`.
4. Streaming :
   - Section identité (immédiat)
   - Timeline (`<Suspense>`)
   - Webhook deliveries (`<Suspense>`)
5. Action de changement de statut → POST `/api/admin/leads/[id]/status`.
6. Action d'ajout de note → POST `/api/admin/leads/[id]/notes`.

## Sections

### 1. En-tête identité

| Bloc | Contenu |
|---|---|
| Avatar (initiales) | premières lettres prénom + nom |
| Nom complet | `Heading level={1}` |
| Type | badge (`contact`, `order`, `newsletter`, `b2b`) |
| Statut | badge avec menu déroulant (changer le statut) |
| Date de création | absolue + relative (`hover`) |

### 2. Identité & contact

```
Email          : leila@example.ma
Téléphone      : +212 6 12 34 56 78
Ville          : Casablanca
Source         : Formulaire contact (page /contact)
Consentement   : ✓ Politique acceptée le 03/05/2026 14:32
```

### 3. Commande (si `type='order'`)

Tableau articles + total :

| Article | Quantité | Prix unitaire | Total |
|---|---|---|---|
| Sérum Anti-âge | 1 | 280,00 MAD | 280,00 MAD |
| Crème Hydratante | 2 | 145,00 MAD | 290,00 MAD |

Sous-total, frais de livraison, total final, devise.

### 4. Timeline (Suspense)

Liste verticale chronologique :

```
● 03/05/2026 14:32 — Lead créé via formulaire contact (IP 102.…)
○ 03/05/2026 14:32 — Webhook envoyé à Slack (succès, 187 ms)
○ 03/05/2026 14:33 — Statut changé : new → in_progress (par admin)
○ 03/05/2026 14:45 — Note ajoutée : "Rappel programmé"
```

### 5. Webhook deliveries (Suspense)

Tableau (même schéma que `/admin/webhooks/[id]/deliveries` filtré sur ce lead) :

| Date | Endpoint | Statut HTTP | Tentative | Action |
|---|---|---|---|---|
| 14:32 | https://hooks.slack.com/… | 200 | 1/5 | Voir payload |

### 6. Actions

| Action | Composant | Endpoint |
|---|---|---|
| Changer statut | `<StatusMenu>` Client | PATCH `/api/admin/leads/[id]/status` |
| Ajouter note | `<NoteForm>` Client | POST `/api/admin/leads/[id]/notes` |
| Renvoyer webhook | bouton sur ligne delivery | POST `/api/admin/webhook-deliveries/[id]/retry` |

## Schéma de changement de statut

```ts
export const changeStatusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'won', 'lost', 'spam']),
  reason: z.string().max(280).optional(),
});
```

Toute transition est journalisée dans la table `lead_events`.

## Schéma d'ajout de note

```ts
export const addNoteSchema = z.object({
  body: z.string().min(1).max(2000),
});
```

## Optimistic update

Sur changement de statut :

1. UI affiche le nouveau statut immédiatement.
2. Si l'API renvoie 200 → confirmation toast.
3. Si erreur → rollback + toast erreur.

```tsx
'use client';
const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
```

## Empty states partiels

| Section | Si vide | Message |
|---|---|---|
| Commande | type !== 'order' | section masquée |
| Timeline | aucun event | "Aucune activité enregistrée." |
| Deliveries | aucune livraison | "Aucun webhook déclenché pour ce lead." |

## Tests

| Type | Fichier |
|---|---|
| Unit | `LeadDetail.test.tsx`, `StatusMenu.test.tsx`, `NoteForm.test.tsx`, `Timeline.test.tsx` |
| MSW | `scenario-lead-detail-load.md`, `scenario-lead-status-change.md`, `scenario-lead-status-conflict.md`, `scenario-lead-note-add.md` |
| a11y | `jest-axe` sur la page complète |
| E2E | `e2e/lead-detail.spec.ts` — voir, changer statut, ajouter note |
