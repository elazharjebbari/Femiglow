# Listmonk sync — push éphémère

## Rôle

Pousser une snapshot d'audience FemiGlow vers Listmonk comme **liste
éphémère**, créer une campagne pointant cette liste, et planifier le
cleanup.

## Contrat

```typescript
export async function pushSnapshotToListmonk(
  snapshotId: string,
  opts: { 
    listName?: string;     // default fg-{slug}-{snapshotId.slice(0,8)}
    tags?: string[];        // default ['ephemeral']
  }
): Promise<{ listmonkListId: number; pushed: number; durationMs: number }>;
```

## Workflow

```
1. Récupérer le snapshot + ses members (paginated)
2. Créer une liste Listmonk :
   POST /api/lists
   { name: 'fg-clientes-vip-abc123', type: 'private', optin: 'single', tags: ['ephemeral'] }
   → list_id
3. Update email_audience_snapshot SET listmonk_list_id, listmonk_list_name
4. Push subscribers en bulk (par chunks de 1000) :
   POST /api/import/subscribers
   { params: { mode: 'subscribe', subscription_status: 'confirmed', lists: [list_id] },
     subscribers: [{ email, name, attribs: { source: 'fg-snapshot' } }, ...] }
5. Wait import done (poll /api/import/subscribers/status)
6. Retourner { list_id, pushed }
```

## Idempotency

- Si snapshot a déjà `listmonk_list_id` non null → no-op, retourne l'existant
- Si la liste Listmonk a été supprimée entre-temps → on recrée (best-effort)

## Cleanup cron

Quotidien `/api/cron/email-audience-purge` :

```typescript
// 1. Trouver les listes éphémères périmées
const expired = await db.select().from(emailAudienceSnapshot)
  .where(and(
    isNotNull(emailAudienceSnapshot.listmonk_list_id),
    lt(emailAudienceSnapshot.purgeable_after, sql`now()`),
  ));

// 2. Pour chacune, supprimer côté Listmonk
for (const snap of expired) {
  try {
    await listmonkClient.delete(`/api/lists/${snap.listmonk_list_id}`);
    await db.update(emailAudienceSnapshot)
      .set({ listmonk_list_id: null })
      .where(eq(emailAudienceSnapshot.id, snap.id));
  } catch (err) {
    // Liste peut-être déjà supprimée manuellement → ignore 404
    if (!is404(err)) {
      logger.error('listmonk.cleanup.failed', { snapshotId: snap.id, err });
    }
  }
}
```

## Error handling

| Erreur | Stratégie |
|---|---|
| 401 Listmonk | Vérifier .env LISTMONK_API_USER/TOKEN, alerte |
| 503 Listmonk down | Retry exponentiel (3 tries) |
| 409 list name conflict | Append `-{ts}` au name, retry |
| Timeout import | Status check toutes les 5s, max 5min |
| Partial import (some emails invalid) | Logger les failures, ne pas re-tenter |

## Performance

- Bulk push : chunks de 1000 emails (Listmonk default limit)
- Parallélisation : pas en V1 (séquentiel) ; en V2 si > 50k

Cible : 10k push en < 5min.

## Tests MSW

Voir [11-tests/02-msw-integration/listmonk-sync.test.spec.md](../11-tests/02-msw-integration/listmonk-sync.test.spec.md).

Scénarios :
- Happy path 100 rows
- Liste déjà créée → no-op
- 503 Listmonk → 3 retries
- Partial import → log + complete
- Cleanup : supprime la liste, met à jour DB
- Cleanup : 404 Listmonk (déjà sup) → DB updated quand même
