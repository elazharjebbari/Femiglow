# Runbook : Déduplication des leads chat_lead

## Contexte

En production, des leads en doublon existaient dans la table `chat_lead` :
- 1 session avec 2 leads (`s_zxpovcty1a69unw4bx8q`)
- 4 numéros de téléphone dupliqués, le pire ayant 7 leads pour le même `+212648621472`

Cause racine : absence de contrainte UNIQUE + race conditions dans les 3 chemins de création.

## Fix appliqué (code + migration)

### Phase 1 : UNIQUE sur `session_id` (déployé)

1. **Migration 0054** : dedup des données existantes + `UNIQUE INDEX ON (session_id)`
2. **`leadRepo.create`** : upsert atomique `INSERT ... ON CONFLICT (session_id) DO NOTHING`
3. **`wizardLeadRepo.createWizardLead`** : même pattern upsert

### Phase 2 : Multi-identité `(session_id, identity_hash)` (déployé)

Permet à un visiteur de créer un second lead dans la même session si l'identité (téléphone + prénom) est différente.

4. **Migration 0055** : colonne `identity_hash` (SHA-256 de `phone_e164|first_name` normalisé), backfill des 33 rows existantes, remplacement de l'index UNIQUE `(session_id)` par `(session_id, identity_hash)`
5. **`computeIdentityHash()`** : SHA-256 de `trim(phone_e164) + "|" + lower(trim(firstName))`
6. **`leadRepo.create`** : conflict target → `(sessionId, identityHash)`, fallback `findBySessionAndIdentity`
7. **`wizardLeadRepo.createWizardLead`** : même pattern, conflict target `(sessionId, identityHash)`
8. **`leadRepo.upgrade`** : recalcule `identityHash` quand phone/name changent
9. **Orchestrateur** : inline-contact check par identité (`findBySessionAndIdentity`) au lieu de `hasLeadForSession`
10. **Route `/api/chat/lead/contact`** : dédup par identité au lieu de par session seule

## Index en production

```sql
-- Index composite UNIQUE (remplace l'ancien chat_lead_session_unique_idx)
chat_lead_session_identity_unique_idx ON chat_lead (session_id, identity_hash)

-- Index standalone pour queries admin
chat_lead_identity_hash_idx ON chat_lead (identity_hash)
```

## Comportement multi-identité

| Scénario | Comportement |
|----------|-------------|
| Même session, même tél+nom, resubmit | `ON CONFLICT DO NOTHING` → retourne le lead existant |
| Même session, tél différent | Nouveau lead créé (hash différent) |
| Même session, même tél, nom différent | Nouveau lead créé (hash différent) |
| Lead `inline-contact` + upgrade même identité | `findBySessionAndIdentity` trouve le lead → upgrade |
| Lead `inline-contact` + identité différente | Nouveau lead créé |
| Session convertie + nouvelle commande même tab | Nouveau sessionId (sessionStorage) → nouveau lead auto |

## Procédure de rollback

Si la migration 0055 pose problème :

```sql
-- Restaurer l'ancien index UNIQUE sur session_id seul
DROP INDEX IF EXISTS chat_lead_session_identity_unique_idx;
DROP INDEX IF EXISTS chat_lead_identity_hash_idx;
ALTER TABLE chat_lead ALTER COLUMN identity_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chat_lead_session_unique_idx ON chat_lead (session_id);
```

## Vérification en production

```bash
# Vérifier l'index composite
psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'chat_lead' AND indexname LIKE '%identity%';"

# Vérifier les hashes backfillés
psql "$DATABASE_URL" -c "SELECT id, session_id, phone_e164, first_name, identity_hash FROM chat_lead LIMIT 5;"

# Vérifier qu'aucun identity_hash n'est NULL
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM chat_lead WHERE identity_hash IS NULL;"
```

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `drizzle/migrations/0054_chat_lead_unique_session.sql` | Dedup + UNIQUE sur session_id |
| `drizzle/migrations/0055_chat_lead_identity_hash.sql` | Colonne identity_hash + index composite |
| `src/lib/chat/db/schema.ts` | Colonne `identityHash` + index |
| `src/lib/chat/repos/identity-hash.ts` | Nouveau — `computeIdentityHash()` |
| `src/lib/chat/repos/lead.ts` | `create` → conflict `(sessionId, identityHash)`, `findBySessionAndIdentity`, `upgrade` recalcule hash |
| `src/lib/checkout/repos/lead-repo.ts` | `createWizardLead` → conflict `(sessionId, identityHash)` |
| `src/lib/chat/services/orchestrator.ts` | Inline-contact : check par identité |
| `src/app/api/chat/lead/contact/route.ts` | Dédup par identité |
| `src/lib/chat/repos/lead-dedup.test.ts` | 13 tests multi-identité |
| `src/lib/chat/repos/identity-hash.test.ts` | 7 tests hash |