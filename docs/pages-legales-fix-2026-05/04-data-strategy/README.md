# 04 — Data Strategy

## Fichiers

| Fichier | Contenu |
|---|---|
| [`backfill-historique.md`](./backfill-historique.md) | Migration data : rename vars + insert + cleanup |
| [`audit-queries.md`](./audit-queries.md) | SQL d'audit prêts à coller |
| [`monitoring.md`](./monitoring.md) | Métriques + alertes post-deploy |

## Principes

1. **Pas de DELETE sur historique métier** — seuls les E2E orphelins sont supprimés
2. **Idempotent** — re-exécuter migration sans effet de bord
3. **Réversible** — rollback SQL fourni
4. **Auditable** — snapshots before/after archivés
5. **Observable** — dashboards admin + Sentry rules
