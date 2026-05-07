# Audit trail

Toute action sensible — authentification, mutation administrative,
manipulation de données — est journalisée dans la table
`audit_events`. La conservation est de **36 mois** (obligation
loi 09-08 + besoin métier).

## Schéma

```sql
CREATE TABLE audit_events (
  id          text        PRIMARY KEY,
  actor_id    text        REFERENCES admin_users(id),
  action      text        NOT NULL,
  target_type text,
  target_id   text,
  ip          text,
  user_agent  text,
  meta        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestabloratamptz NOT NULL DEFAULT NOW()
);
```

Cf. [`../06-data/schema.sql`](../06-data/schema.sql) pour les indexes
exacts.

## Catalogue des actions

| Action | Cible | Quand |
|---|---|---|
| `admin.login` | (none) | login réussi |
| `admin.login.failed` | (none) | login échoué (mot de passe ou rate-limit) |
| `admin.logout` | (none) | déconnexion |
| `lead.created` | `lead` | création via formulaire (ou admin v1.1) |
| `lead.status_changed` | `lead` | changement de statut |
| `lead.note_added` | `lead` | ajout de note |
| `lead.exported_csv` | (multi) | export CSV téléchargé |
| `lead.viewed` | `lead` | NON v1 (volume trop élevé) |
| `webhook.endpoint.created` | `webhook_endpoint` | création |
| `webhook.endpoint.updated` | `webhook_endpoint` | modification |
| `webhook.endpoint.deleted` | `webhook_endpoint` | soft-delete |
| `webhook.endpoint.toggled` | `webhook_endpoint` | active/inactive |
| `webhook.secret.rotated` | `webhook_endpoint` | régénération HMAC |
| `webhook.test.invoked` | `webhook_endpoint` | bouton "Tester" |
| `webhook.delivery.retried` | `webhook_delivery` | bouton "Renvoyer" |
| `rgpd.lead.erased` | `lead` | anonymisation suite demande |

## Helper

```ts
// apps/web/src/lib/db/queries/audit.ts
export async function logAuditEvent(input: {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditEvents).values({
    id: createId(),
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    ip: input.ip,
    userAgent: input.userAgent,
    meta: input.meta ?? {},
  });
}
```

Convention : appeler **dans** la transaction de la mutation parente,
pour garantir l'atomicité (mutation + audit ensemble).

## Champs `meta` typiques

```ts
// status_change
meta = { from: 'new', to: 'in_progress', reason?: '…' }

// note_added
meta = { lengthChars: 142 }
// (pas le texte complet — on a déjà le note dans lead_events)

// endpoint.updated
meta = { changes: { name: { from: '…', to: '…' }, events: { from: [...], to: [...] } } }

// secret.rotated
meta = { previousFingerprint: 'sha256:abcd…', newFingerprint: 'sha256:efgh…' }
```

## Pas de PII brute en `meta`

Règle : ne **jamais** stocker email, téléphone, contenu de note en clair
dans `audit_events.meta`. L'objectif : réduire le risque de duplication
et faciliter une éventuelle anonymisation.

Si on doit identifier une donnée, on stocke l'`id` (référence) — la donnée
elle-même reste dans sa table source, sujette à anonymisation.

## Accès

- **Pas d'UI v1** pour consulter l'audit. Accès SQL direct (DPO + dev senior uniquement).
- Évolution v1.1 : page `/admin/audit` (si justifié).

## Requêtes types

### Toutes les actions d'une admin sur 7 jours

```sql
SELECT created_at, action, target_type, target_id, meta
FROM audit_events
WHERE actor_id = $1
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Historique d'un lead

```sql
SELECT created_at, action, actor_id, meta
FROM audit_events
WHERE target_type = 'lead' AND target_id = $1
ORDER BY created_at DESC;
```

### Pic de logins échoués (détection)

```sql
SELECT date_trunc('hour', created_at) AS hour, count(*) AS failed
FROM audit_events
WHERE action = 'admin.login.failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

## Conservation & archivage

| Moment | Action |
|---|---|
| Tous les jours | rien (volumes faibles, ~30 lignes/jour attendues) |
| Tous les trimestres | export `pg_dump` → S3 chiffré (clé KMS DPO) |
| À 36 mois | purge automatique (cron v1.1) |
| Sur demande judiciaire | export ad-hoc + chain-of-custody |

## Garanties

| Propriété | Garantie | Implémentation |
|---|---|---|
| Append-only | aucune route DELETE/UPDATE | convention + lint |
| Atomique avec la mutation | oui | transaction Drizzle |
| Horodaté serveur | oui | `DEFAULT NOW()` |
| Identifiable | oui | `actor_id` FK |
| Non répudiable | oui | join FK + audit légal |
| Disponible | oui | Neon PITR 7j + export trimestriel |

## Tests

| Type | Fichier |
|---|---|
| Unit | `audit.test.ts` (vérifie qu'une mutation insère bien l'audit) |
| Integration | `audit-coverage.test.ts` table de chaque mutation → audit attendu |
