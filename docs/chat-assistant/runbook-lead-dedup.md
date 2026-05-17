# Runbook : Déduplication des leads chat_lead

## Contexte

En production, des leads en doublon existent dans la table `chat_lead` :
- 1 session avec 2 leads (`s_zxpovcty1a69unw4bx8q`)
- 4 numéros de téléphone dupliqués, le pire ayant 7 leads pour le même `+212648621472`

Cause racine : absence de contrainte UNIQUE sur `session_id` + race conditions dans les 3 chemins de création (orchestrateur, chat form, wizard).

## Fix appliqué (code)

1. **`leadRepo.create`** : upsert atomique `INSERT ... ON CONFLICT (session_id) DO NOTHING RETURNING *` + fallback `findBySession`
2. **`wizardLeadRepo.createWizardLead`** : même pattern upsert
3. **Tests** : `lead-dedup.test.ts` (7 tests passants couvrant create, findBySession, hasLeadForSession, upgrade)

## Procédure de déploiement

### Étape 1 : Vérifier les doublons existants

```bash
# Compter les doublons par session_id
psql "$DATABASE_URL" -c "
  SELECT session_id, COUNT(*) AS n
  FROM chat_lead
  GROUP BY session_id
  HAVING COUNT(*) > 1
  ORDER BY n DESC;
"

# Compter les doublons par phone_e164
psql "$DATABASE_URL" -c "
  SELECT phone_e164, COUNT(*) AS n
  FROM chat_lead
  WHERE phone_e164 IS NOT NULL AND phone_e164 != '+0'
  GROUP BY phone_e164
  HAVING COUNT(*) > 1
  ORDER BY n DESC;
"
```

### Étape 2 : Sauvegarder les doublons (audit trail)

```bash
# Exporter les doublons avant suppression
psql "$DATABASE_URL" -c "
  COPY (
    SELECT *
    FROM chat_lead
    WHERE session_id IN (
      SELECT session_id FROM chat_lead GROUP BY session_id HAVING COUNT(*) > 1
    )
    ORDER BY session_id, created_at
  ) TO STDOUT WITH CSV HEADER
" > /tmp/chat_lead_duplicates_backup_$(date +%Y%m%d).csv
```

### Étape 3 : Appliquer la migration (dedup + index UNIQUE)

```bash
psql "$DATABASE_URL" -f apps/web/drizzle/migrations/0054_chat_lead_unique_session.sql
```

Cette migration :
1. Supprime les leads en doublon (garde le plus récent par `session_id`)
2. Crée l'index `chat_lead_session_unique_idx` sur `session_id`

### Étape 4 : Vérifier l'index

```bash
psql "$DATABASE_URL" -c "\d chat_lead" | grep unique
psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'chat_lead' AND indexname LIKE '%unique%';"
```

### Étape 5 : Reconstruire et redémarrer

```bash
cd /var/www/femiglow
pnpm build
systemctl restart femiglow.service
```

### Étape 6 : Vérifier en production

- Créer un lead via le wizard → doit retourner 201
- Re-soumettre le même formulaire → doit retourner le même lead (idempotent)
- Vérifier qu'aucun nouveau doublon n'apparaît

## Rollback

Si la migration pose problème, supprimer l'index UNIQUE :

```sql
DROP INDEX IF EXISTS chat_lead_session_unique_idx;
```

Les doublons supprimés sont dans le backup CSV (étape 2).

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `drizzle/migrations/0054_chat_lead_unique_session.sql` | Nouveau — dedup + index UNIQUE |
| `src/lib/chat/repos/lead.ts` | `create` → upsert ON CONFLICT |
| `src/lib/checkout/repos/lead-repo.ts` | `createWizardLead` → upsert ON CONFLICT |
| `src/lib/chat/repos/lead-dedup.test.ts` | Nouveau — 7 tests dédup |