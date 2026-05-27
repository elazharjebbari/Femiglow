# 04 — Data Strategy

Stratégie data : backfill historique, queries d'audit, monitoring.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`backfill-historique.md`](./backfill-historique.md) | Plan de migration data (avant/pendant/après) |
| [`audit-queries.md`](./audit-queries.md) | SQL d'audit prêts à coller pour vérifier l'état avant/après |
| [`monitoring.md`](./monitoring.md) | Métriques à tracker post-deploy + alertes |

## Principes data

1. **Pas de DELETE** — toutes les opérations sont des UPDATE (archivage réversible).
2. **Idempotent** — re-exécuter le backfill n'a aucun effet (kind déjà set).
3. **Auditable** — chaque mutation laisse une trace (logs Sentry + Plausible event).
4. **Réversible** — si erreur détectée, DROP COLUMN est possible (avec feature flag off).
5. **Observable** — dashboards `/admin/chat/audit` + `/admin/live-health` montrent les counts.

## Volumes anticipés

À partir de l'observation preview (DB locale) :
- ~100 sessions au total
- ~30-50 ghosts wizard à backfiller en `kind='wizard_pivot'`
- ~5-10 ghosts orphelins > 30j (à archiver via cleanup endpoint)

Sur prod réel (estimation) :
- 10-100x plus de sessions selon le traffic
- Backfill instant (<5s pour 10k rows)
- Cleanup mensuel ~50-200 rows attendues
