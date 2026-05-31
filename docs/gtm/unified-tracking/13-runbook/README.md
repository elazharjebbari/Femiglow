# 13 — Runbook

Procédures opérationnelles **prêtes à exécuter** par n'importe quel admin technique (Younes, Lead, SRE) sous pression.

Chaque runbook est :
- **Auto-suffisant** : pas besoin de chercher des infos ailleurs.
- **Séquentiel** : étapes numérotées, à exécuter dans l'ordre.
- **Vérifié** : commandes testées, sorties attendues précisées.
- **Versionné** : daté + responsable indiqué.

## Fichiers

| Fichier | Sujet |
|---|---|
| [deployment-runbook.md](deployment-runbook.md) | Procédure de déploiement en production |
| [rollback-runbook.md](rollback-runbook.md) | Procédure de rollback (feature flag + DB si nécessaire) |
| [incident-response.md](incident-response.md) | Réponse aux incidents (drift critique, erreurs prod, etc.) |
| [migration-runbook.md](migration-runbook.md) | Procédure de migration data legacy → v2 |
| [monitoring-runbook.md](monitoring-runbook.md) | Comment lire les dashboards et alertes |

## Convention

Chaque procédure suit cette structure :
```
1. Préconditions
2. Étapes (numérotées)
3. Critères de succès
4. Plan B si échec
5. Communication
```

## Drills

Les runbooks doivent être **rehearsed** au moins une fois en staging avant utilisation en prod.

| Runbook | Drill avant ? |
|---|---|
| Deployment | OUI (sprint 6) |
| Rollback | OUI (sprint 6) |
| Migration | OUI (dry-run prod copy) |
| Incident response | OUI (chaos drill optionnel) |
| Monitoring | Non (lecture-seule) |
