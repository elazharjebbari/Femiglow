# 09 — Environnement & déploiement

Configuration des environnements, variables, déploiement, monitoring.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`env-variables.csv`](./env-variables.csv) | Inventaire de toutes les variables d'environnement |
| [`env.example`](./env.example) | Modèle `.env.example` à committer |
| [`deploiement-vercel.md`](./deploiement-vercel.md) | Configuration Vercel, projets, branches |
| [`neon-postgres.md`](./neon-postgres.md) | Configuration Neon, branches DB, PITR |
| [`secrets-rotation.md`](./secrets-rotation.md) | Procédures de rotation |
| [`monitoring.md`](./monitoring.md) | Sentry, Vercel Analytics, alertes |
| [`runbook-incident.md`](./runbook-incident.md) | Runbook opérationnel jour-de-l'incident |

## Environnements

| Env | Nom Vercel | Domaine | DB Neon |
|---|---|---|---|
| Production | `production` | https://femiglow.ma | `main` (region eu-central-1) |
| Preview | `preview` | https://femiglow-{branch}.vercel.app | branche éphémère par PR |
| Développement | local | http://localhost:3000 | Neon dev branch personnelle |
| Test | local CI | jsdom | Neon test branch éphémère |
