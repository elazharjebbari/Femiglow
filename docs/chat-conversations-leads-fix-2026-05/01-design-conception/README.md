# 01 — Design & Conception

Conception détaillée du fix, indépendamment de l'implémentation.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`architecture-cible.md`](./architecture-cible.md) | Diagramme architecture cible (DB / API / UI) avec `kind` discriminator |
| [`data-model.md`](./data-model.md) | Schéma DB cible : colonne `kind`, contraintes CHECK, indexes |
| [`api-contracts.md`](./api-contracts.md) | Signatures des queries Drizzle et endpoints API touchés |
| [`flow-diagrams.md`](./flow-diagrams.md) | Flow d'écriture / lecture (chat vs wizard) avant/après fix |

## Principes directeurs

1. **Non-régression absolue** : aucune query existante ne doit changer de comportement sans feature flag actif.
2. **Backward compatibility** : la colonne `kind` a un default `'chat'` → toute row historique sans valeur reste consistante.
3. **Idempotence** : la migration peut être ré-exécutée sans effet de bord (ADD COLUMN IF NOT EXISTS).
4. **Observabilité** : chaque transition (insert chat vs wizard) est loggée avec `kind` pour audit.
5. **Réversibilité** : feature flag off → comportement legacy ; DROP COLUMN possible si on doit annuler la migration.
