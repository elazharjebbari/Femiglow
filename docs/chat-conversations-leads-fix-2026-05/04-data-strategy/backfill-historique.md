# Backfill historique

> Migration data en 3 étapes : pré-migration audit, migration, vérification.

## Étape 1 — Audit pré-migration

Avant d'appliquer quoi que ce soit en prod, capturer l'état actuel :

```sql
-- 1.1 Compte total
SELECT COUNT(*) AS total_sessions FROM chat_session;
SELECT COUNT(*) AS total_leads FROM chat_lead;

-- 1.2 Distribution par préfixe d'ID
SELECT LEFT(id, 3) AS prefix, COUNT(*) AS n
  FROM chat_session
 GROUP BY 1
 ORDER BY n DESC;

-- 1.3 Distribution par source leads
SELECT source, COUNT(*) AS n
  FROM chat_lead
 GROUP BY 1
 ORDER BY n DESC;

-- 1.4 Sessions sans aucun message
SELECT COUNT(*) AS sessions_sans_messages
  FROM chat_session s
 WHERE NOT EXISTS (
   SELECT 1 FROM chat_message m
    WHERE m.session_id = s.id AND m.role = 'user'
 );

-- 1.5 Sessions wizard préfixe 's_' sans lead lié
SELECT COUNT(*) AS ghosts_orphelins
  FROM chat_session s
 WHERE s.id LIKE 's\_%' ESCAPE '\'
   AND NOT EXISTS (SELECT 1 FROM chat_lead l WHERE l.session_id = s.id);
```

**Sauvegarder ces counts** dans une note (ex. Notion / Linear ticket / commentaire PR) pour comparer après.

## Étape 2 — Application de la migration

### 2.1 Migration Drizzle (ajout colonne)

```bash
# Local d'abord
cd apps/web
pnpm drizzle-kit migrate

# Ou exécution SQL directe si urgence
psql $DATABASE_URL -f drizzle/migrations/0XYZ_chat_session_kind.sql
```

La migration contient :
1. `ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat'`
2. `ADD CONSTRAINT chat_session_kind_check CHECK (kind IN (...))`
3. `CREATE INDEX CONCURRENTLY chat_session_kind_status_idx`
4. `UPDATE chat_session SET kind = 'wizard_pivot' WHERE id LIKE 's\_%' ESCAPE '\' AND kind = 'chat'`

### 2.2 Backfill complémentaire (si besoin)

Pour les cas spéciaux où l'ID préfixe ne suffit pas (ex. legacy avec ID custom) :

```sql
-- Backfill via JOIN sur chat_lead.source (cas edge)
UPDATE chat_session s
   SET kind = 'wizard_pivot',
       updated_at = NOW()
 WHERE s.kind = 'chat'
   AND EXISTS (
     SELECT 1 FROM chat_lead l
      WHERE l.session_id = s.id
        AND l.source IN ('wizard_kit', 'wizard_commander')
   );

-- Vérification : combien de rows updated ?
-- (psql retourne UPDATE N — noter)
```

### 2.3 Backfill TypeScript (alternative)

Si on préfère piloter via script audité (logs détaillés) :

```bash
cd apps/web
# Dry run d'abord
pnpm tsx scripts/backfill-chat-session-kind.ts --dry-run

# Si OK, execute
pnpm tsx scripts/backfill-chat-session-kind.ts --execute
```

Le script affiche :
```
Backfill chat_session.kind — DRY RUN

Candidates (id préfixe s_ + kind='chat') : 42

💡 Use --execute to apply the update.
```

Puis après --execute :
```
✅ Updated 42 rows to kind='wizard_pivot'

📊 Backfill complete. 0 rows remaining mismatched.
```

## Étape 3 — Vérification post-migration

```sql
-- 3.1 Distribution finale kind
SELECT kind, COUNT(*) AS n
  FROM chat_session
 GROUP BY 1
 ORDER BY n DESC;

-- Attendu :
-- chat            | ~60-70 (avant backfill)
-- wizard_pivot    | ~30-40 (post backfill)
-- system          | 0

-- 3.2 Aucune row préfixe s_ restée en kind='chat'
SELECT COUNT(*) FROM chat_session
 WHERE id LIKE 's\_%' ESCAPE '\' AND kind = 'chat';
-- Attendu : 0

-- 3.3 Aucune row préfixe cs_ devenue 'wizard_pivot'
SELECT COUNT(*) FROM chat_session
 WHERE id LIKE 'cs\_%' ESCAPE '\' AND kind = 'wizard_pivot';
-- Attendu : 0

-- 3.4 Cohérence kind ↔ source
SELECT s.kind, l.source, COUNT(*) AS n
  FROM chat_session s
  JOIN chat_lead l ON l.session_id = s.id
 GROUP BY 1, 2
 ORDER BY 3 DESC;

-- Cas attendus (✅) :
-- kind='chat'         × source='chat_widget'
-- kind='chat'         × source='inline'
-- kind='wizard_pivot' × source='wizard_kit'
-- kind='wizard_pivot' × source='wizard_commander'

-- Cas inattendus (❌ — à investiguer) :
-- kind='chat'         × source='wizard_kit'      <-- incohérence
-- kind='wizard_pivot' × source='chat_widget'     <-- incohérence

-- 3.5 Compteur "vraies conversations chat" attendu
SELECT COUNT(DISTINCT s.id) AS true_chat_conversations
  FROM chat_session s
 WHERE s.kind = 'chat'
   AND EXISTS (
     SELECT 1 FROM chat_message m
      WHERE m.session_id = s.id AND m.role = 'user' AND m.status = 'sent'
   );

-- 3.6 Compteur leads chat purs
SELECT COUNT(*) AS pure_chat_leads
  FROM chat_lead
 WHERE source IN ('chat_widget', 'inline');
```

## Étape 4 — Cleanup orphelins (post-shipping J+1)

Une fois le fix en prod et validé sur 24h :

```bash
# Via UI admin /admin/chat/audit → bouton "Prévisualiser"
# Puis "Confirmer" si count acceptable

# OU via curl
curl -X POST \
  -H 'cookie: <admin_session>' \
  -H 'content-type: application/json' \
  -d '{"dryRun": true, "olderThanDays": 30}' \
  https://femiglow-maroc.com/api/admin/chat/cleanup-ghosts | jq

# Si candidates raisonnable (~50-200) :
curl -X POST \
  -H 'cookie: <admin_session>' \
  -H 'content-type: application/json' \
  -d '{"dryRun": false, "olderThanDays": 30}' \
  https://femiglow-maroc.com/api/admin/chat/cleanup-ghosts | jq
```

## Étape 5 — Cleanup périodique (post J+30)

Si la pollution remonte (nouveaux ghosts orphelins via wizard abandonnés), exécuter le cleanup une fois par mois.

Optionnel : ajouter une cron weekly. À évaluer après 30 jours d'observation.

## Rollback data

Si à la vérif 3.x on observe des incohérences MAJEURES (ex. tous les `cs_` devenus `wizard_pivot`) :

```sql
-- Reset partiel : tout `cs_*` repasse en `chat`
UPDATE chat_session
   SET kind = 'chat',
       updated_at = NOW()
 WHERE id LIKE 'cs\_%' ESCAPE '\'
   AND kind <> 'chat';

-- Audit après
SELECT kind, COUNT(*) FROM chat_session GROUP BY 1;
```

## Estimation timings

| Volume rows | Migration ADD COLUMN | Backfill | Index CONCURRENTLY | Total |
|---|---|---|---|---|
| 1k | <1s | <1s | <1s | ~2s |
| 10k | <1s | ~1s | ~2s | ~4s |
| 100k | ~2s | ~5s | ~10s | ~20s |
| 1M | ~5s | ~30s | ~60s | ~1.5min |

Aucun lock long. CONCURRENTLY permet d'éviter le blocage des SELECT pendant la création d'index.

## Capture d'état (snapshot file)

Sauvegarder l'état pré et post migration dans un fichier d'audit :

**Fichier** : `docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots/`

```
└── pre-migration-2026-05-26.json
└── post-migration-2026-05-26.json
└── post-cleanup-2026-05-27.json
```

Chaque fichier contient le résultat des queries d'audit 1.1 à 3.x. Utile pour audit ex-post et démonstration de "ce qu'on a fait".

## Que faire si la prod a des données absurdes

Cas où un ID en DB ne suit aucune convention (ni `cs_`, ni `s_`) :

```sql
-- Trouver les ID exotiques
SELECT id, kind, opened_at, page
  FROM chat_session
 WHERE id NOT LIKE 'cs\_%' ESCAPE '\'
   AND id NOT LIKE 's\_%' ESCAPE '\'
 LIMIT 50;
```

Si > 0 rows : analyser au cas par cas. Probables causes :
- Migration ancienne avec autre convention
- Insertion manuelle admin
- Bug script de seed

**Décision** : laisser `kind='chat'` par défaut (safe), traiter manuellement si > 100 rows.
