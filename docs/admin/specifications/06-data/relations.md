# Relations & contraintes

## Diagramme

Voir [`schema-erd.puml`](./schema-erd.puml).

## Cardinalités

| Source | Relation | Cible | Cardinalité | ON DELETE |
|---|---|---|---|---|
| `leads` | a 0..1 | `orders` | 1 lead → 0/1 order | RESTRICT |
| `orders` | a 1..N | `order_items` | 1 order → ≥1 items | CASCADE |
| `leads` | a 0..N | `lead_events` | 1 lead → 0/N events | RESTRICT |
| `admin_users` | crée 0..N | `lead_events` | 1 admin → 0/N events | SET NULL |
| `admin_users` | crée 0..N | `audit_events` | 1 admin → 0/N events | SET NULL |
| `webhook_endpoints` | a 0..N | `webhook_deliveries` | 1 endpoint → 0/N deliveries | RESTRICT |

## Politique ON DELETE

| Choix | Justification |
|---|---|
| `RESTRICT` (défaut) | force la prudence : impossible de supprimer un parent si enfants existent |
| `CASCADE` | uniquement pour `order_items` (ne pas garder d'items orphelins) |
| `SET NULL` | uniquement pour `actor_id` (admin supprimée mais event historique conservé) |

## Soft-delete vs hard-delete

| Table | Mode | Pourquoi |
|---|---|---|
| `admin_users` | soft (`deleted_at`) | conserver historique d'audit |
| `leads` | soft | conserver pour relance future, audit |
| `orders` | suit le lead | cohérence |
| `webhook_endpoints` | soft | conserver historique deliveries |
| `webhook_deliveries` | hard (purge à 90j) | volume + contenu PII |
| `lead_events` | hard (suit le lead) | append-only |
| `audit_events` | hard (purge à 36 mois) | conservation légale |
| `admin_login_attempts` | hard (purge à 24h) | aucune valeur historique |
| `rate_limit_counters` | hard (purge à 24h) | tampon technique |

## Cohérence transactionnelle

### Cas 1 : création de lead via formulaire public

```ts
await db.transaction(async (tx) => {
  const lead = await tx.insert(leads).values(...).returning();
  if (type === 'order') {
    await tx.insert(orders).values({ leadId: lead.id, ... });
    await tx.insert(orderItems).values(items.map(i => ({ orderId, ... })));
  }
  await tx.insert(leadEvents).values({ leadId: lead.id, type: 'created' });
  // L'enqueue webhook se fait APRÈS commit (pour ne pas émettre
  // si la transaction roll-back)
});
await enqueueEvent({ eventName: 'lead.created', payload: lead });
```

### Cas 2 : changement de statut

```ts
await db.transaction(async (tx) => {
  const updated = await tx.update(leads).set({ status }).where(...).returning();
  await tx.insert(leadEvents).values({
    leadId: updated.id,
    type: 'status_change',
    actorId: session.user.id,
    meta: { from: previous, to: status },
  });
  await tx.insert(auditEvents).values({
    actorId: session.user.id,
    action: 'lead.status_changed',
    targetType: 'lead',
    targetId: updated.id,
    meta: { from: previous, to: status },
  });
});
```

## Contraintes CHECK

| Table | Contrainte | Vérification |
|---|---|---|
| `order_items` | `quantity > 0` | impossible d'avoir un item à 0 |
| `webhook_deliveries` | `attempt >= 0 AND attempt <= max_attempts` (à ajouter v1.1) | sanité |
| `webhook_deliveries` | `(status='pending') = (next_attempt_at IS NOT NULL)` (à ajouter v1.1) | invariant état machine |

## Référentiel d'enum

| Enum | Valeurs |
|---|---|
| `lead_type` | `contact`, `order`, `newsletter`, `b2b` |
| `lead_status` | `new`, `in_progress`, `won`, `lost`, `spam` |
| `lead_event_type` | `created`, `status_change`, `note_added`, `webhook_sent`, `webhook_failed`, `webhook_dead` |
| `webhook_delivery_status` | `pending`, `delivered`, `failed`, `dead` |

L'ajout d'une valeur d'enum nécessite une migration `ALTER TYPE ... ADD VALUE`. Documenté dans [`migrations-strategy.md`](./migrations-strategy.md).

## Transitions de statut autorisées

### lead_status

```
            ┌──────────────┐
            ▼              │
new ──→ in_progress ──→ won
  │           │
  ├──→ lost   ├──→ lost
  │
  └──→ spam (terminal)
```

Toute transition non listée → 409 conflict.

### webhook_delivery_status

```
pending ──→ delivered (terminal)
   │  ▲
   ▼  │
  failed → pending (auto par cron)
   │
   ▼
  dead (terminal)
```

`failed → pending` est une transition automatique (next_attempt_at).
`dead → pending` est possible uniquement via "Renvoyer" (action manuelle, reset attempt=0).
