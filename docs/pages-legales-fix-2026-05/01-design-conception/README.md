# 01 — Design & Conception

Conception détaillée du fix, indépendamment de l'implémentation.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`architecture-cible.md`](./architecture-cible.md) | Diagramme architecture cible (DB / API / UI) |
| [`data-model.md`](./data-model.md) | Schéma DB après migration (legal_template_vars étendue) |
| [`api-contracts.md`](./api-contracts.md) | Signatures Drizzle + endpoints API |
| [`flow-diagrams.md`](./flow-diagrams.md) | Flow publish avant/après |

## Principes directeurs

1. **Non-régression absolue** : les 6 pages publiées doivent continuer à fonctionner sans interruption pendant la migration.
2. **Backward compatibility** : la migration rename utilise UPDATE en place (pas DROP + CREATE) — pas de perte de valeurs.
3. **Idempotence** : la migration peut être ré-exécutée sans effet de bord (ON CONFLICT DO NOTHING + WHERE conditions).
4. **Observabilité** : chaque mutation (create var, rename, cleanup) est loggée.
5. **Réversibilité** : feature flag off → comportement legacy ; rollback SQL fourni.
6. **Conformité juridique** : aucune var légale obligatoire ne disparaît silencieusement (validation juriste avant deploy).
