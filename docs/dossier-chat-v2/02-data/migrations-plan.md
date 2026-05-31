# Plan de migrations DB

> Toutes les migrations sont générées via `drizzle-kit generate` et exécutées via `drizzle-kit migrate`. **Pas de SQL manuel** sur le main branch.

## Ordre des migrations

| # | Nom | Vague | Tables touchées | Type | Rollback safe ? |
|---|---|---|---|---|---|
| 0017 | `add_intent_centroid_and_examples` | V5 | `chat_intent_centroid`, `chat_intent_example` | additif | ✅ DROP TABLE |
| 0018 | `add_canned_pair_tables` | V4 | `chat_canned_pair`, `chat_canned_pair_version` | additif | ✅ |
| 0019 | `add_faq_entry_table` | V6 | `chat_faq_entry` | additif | ✅ |
| 0020 | `add_tools_tables` | V5 | `chat_tool`, `chat_tool_call_log` | additif | ✅ |
| 0021 | `add_knowledge_origin_table` | V3 | `chat_knowledge_origin` | additif | ✅ |
| 0022 | `add_health_state_table` | V5 | `chat_health_state` | additif | ✅ |
| 0023 | `extend_message_meta_index` | V4 | `chat_message` index sur `meta->>'pairKey'` | additif | ✅ DROP INDEX |
| 0024 | `extend_orders_tracking_fields` | V7 | `orders` (trackingNumber, carrier, trackingStatus) | additif | ✅ DROP COLUMN |
| 0025 | `add_promo_codes_table` | V7 | `promo_codes` | additif | ✅ |
| 0026 | `add_intent_centroid_hnsw_index` | V5 | `chat_intent_centroid` HNSW index | additif | ✅ DROP INDEX |
| 0027 | `add_faq_entry_hnsw_index` | V6 | `chat_faq_entry.question_embedding` HNSW | additif | ✅ |

## Principes

1. **Additif uniquement**. Aucune migration ne supprime ni renomme une colonne existante. Si besoin, on déprécie d'abord, on supprime dans une release future.
2. **Indexes en CONCURRENTLY**. Tous les `CREATE INDEX` sur tables existantes utilisent `CREATE INDEX CONCURRENTLY` pour éviter le lock.
3. **Pas de FOREIGN KEY ON CASCADE DELETE** sur les leads ou audit (préservation forensic).
4. **Backfill séparé des migrations DDL**. Si une nouvelle colonne nécessite une valeur backfilled, c'est un script tsx séparé exécuté manuellement (`pnpm backfill:<name>`).

## Procédure de release

Pour chaque vague :

```bash
# 1. Génération
pnpm db:generate --name=<name>

# 2. Revue par tech-lead (PR review obligatoire)
git diff apps/web/drizzle/

# 3. Test en local sur DB de dev
DATABASE_URL=postgres://... pnpm db:migrate

# 4. Test sur staging
# 5. Apply en prod (window de maintenance ou hors heure de pointe)
DATABASE_URL=$PROD_URL pnpm db:migrate

# 6. Smoke tests post-migration
pnpm test:e2e --grep="chat smoke"
```

## Procédure de rollback

Si une migration échoue ou cause un incident :

```bash
# 1. Identifier la dernière migration appliquée
psql $DATABASE_URL -c "SELECT * FROM __drizzle_migrations ORDER BY id DESC LIMIT 1;"

# 2. Générer migration inverse manuelle si nécessaire
# (Drizzle ne génère pas de DOWN automatique)
# Créer apps/web/drizzle/<timestamp>_rollback_<name>.sql avec les DROP correspondants

# 3. Appliquer
pnpm db:migrate

# 4. Si données déjà écrites dans la nouvelle structure :
#    - Backfill inverse via script tsx
#    - OU restore from PITR backup (Neon)
```

**Note** : Toutes les nouvelles tables v2 sont rollback‑safe car additives. Aucune donnée existante n'est touchée par leur création.

## Seeders associés

Chaque vague s'accompagne de seeders idempotents :

| Vague | Seeder | Commande | Idempotence |
|---|---|---|---|
| V3 | `seed-chat-knowledge-products` | `pnpm seed:chat-kb-products` | Hash check (rawHash) |
| V3 | `seed-chat-knowledge-cities` | `pnpm seed:chat-kb-cities` | Idem |
| V4 | `seed-chat-canned-pairs` | `pnpm seed:chat-canned` | UPSERT par `key` |
| V5 | `seed-chat-intent-examples` | `pnpm seed:chat-intent-examples` | UPSERT par hash texte |
| V5 | `seed-chat-tools` | `pnpm seed:chat-tools` | UPSERT par `name` |
| V6 | `seed-chat-faq-entries` | `pnpm seed:chat-faq` | UPSERT par `key`+`language` |

Tous les seeders sont enregistrés dans `apps/web/src/lib/seeders/registry.ts`.

## Performance & espace disque

Estimations à 6 mois en régime :

| Table | Lignes estimées | Espace | Notes |
|---|---|---|---|
| `chat_intent_centroid` | 16 | < 100 KB | 16 vecteurs |
| `chat_intent_example` | 1 500 | ~ 1 MB | 30 ex × 16 intents × 3 langues |
| `chat_canned_pair` | 50 | < 100 KB | |
| `chat_canned_pair_version` | 200 | < 500 KB | 4 versions / paire |
| `chat_faq_entry` | 150 | 5 MB | 50 entrées × 3 langues + embeddings 1536d |
| `chat_tool` | 10 | < 50 KB | |
| `chat_tool_call_log` | 500 000 | ~ 1 GB | Cron purge 90 j |
| `chat_knowledge_origin` | 1 500 | < 1 MB | 28 produits + 430 villes × 3 langues |
| `chat_health_state` | 1 000 | < 100 KB | |

Total ajouté < 2 GB. Acceptable pour Neon Hobby (3 GB). Recommander Pro tier si on dépasse.

## Maintenance index

HNSW indexes sur `chat_intent_centroid.vector` et `chat_faq_entry.question_embedding` :
- `m=16, ef_construction=64` (valeurs par défaut, suffisantes pour < 10k vecteurs).
- `REINDEX CONCURRENTLY` mensuel si les vecteurs sont fréquemment mis à jour.
- Monitor `pg_stat_user_indexes.idx_scan` pour valider utilisation.

## Migrations futures (prévues hors scope v2)

- 0028 : `add_chat_conversation_tag` (tags pour clustering thématique conversations)
- 0029 : `add_chat_session_attribution` (UTM, referrer, campaign)
- 0030 : `add_chat_ab_experiment` (framework A/B test)

Documenter au fur et à mesure dans ce fichier.
