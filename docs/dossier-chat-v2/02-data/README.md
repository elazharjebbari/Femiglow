# Data

> Modélisation, taxonomies, datasets, rétention. Cette section est la source de vérité pour tout ce qui touche au stockage et à la sémantique des données chat.

## Fichiers

| Fichier | Type | Audience | Quoi |
|---|---|---|---|
| [`erd.puml`](erd.puml) | PlantUML | data, backend | Diagramme entité‑relation cible (existant + nouvelles tables) |
| [`data-dictionary.csv`](data-dictionary.csv) | CSV | data, backend, QA | Liste de tous les champs avec type, contrainte, raison |
| [`intent-taxonomy.csv`](intent-taxonomy.csv) | CSV | content, NLP | 16 intents + définition + exemples + lead‑decision impact |
| [`intent-dataset-sample.csv`](intent-dataset-sample.csv) | CSV | NLP | Échantillon dataset annoté (~50 lignes) FR/AR/AR‑MA |
| [`canned-pairs-seed.csv`](canned-pairs-seed.csv) | CSV | content | Seed initial de 12 paires canned |
| [`faq-entries-seed.csv`](faq-entries-seed.csv) | CSV | content | Seed initial de 18 entrées FAQ gateway |
| [`retention-rgpd.md`](retention-rgpd.md) | Markdown | compliance, legal | Politique de rétention + droit à l'oubli |
| [`migrations-plan.md`](migrations-plan.md) | Markdown | backend, ops | Plan de migrations Drizzle, ordre, rollback |

## Principes data

1. **Append‑only pour l'audit**. `chat_message`, `chat_conversation_event`, `chat_tool_call_log` ne sont **jamais** modifiés ; soft‑delete uniquement.
2. **Idempotence**. Toute ingestion KB est ré‑exécutable (hash) ; toute paire canned a un `bodyHash` versioned.
3. **PII séparée**. Les `chat_lead` (PII) sont liés aux conversations par `sessionId` mais jamais joints dans les exports analytics par défaut.
4. **Multilingue first‑class**. Toute table contenant du texte user‑facing a des colonnes `*_fr`, `*_ar`, `*_ar_ma`.
5. **Soft‑delete + RGPD purge**. `deletedAt` pour les contenus admin ; cron `gdpr-purge` pour expirations.

## Conventions de nommage

- Tables : `chat_*` préfixe pour tout ce qui est chat.
- Colonnes : `snake_case`.
- IDs : `uuid v4`.
- Timestamps : `created_at`, `updated_at`, `deleted_at` (nullable).
- Soft‑delete : `deleted_at TIMESTAMP` au lieu de `is_deleted BOOL`.
- Hashs : `sha256_<champ>` (préfixe explicite).
- Vecteurs : `embedding` (toujours dim 1536 sauf cas spécifique documenté).
