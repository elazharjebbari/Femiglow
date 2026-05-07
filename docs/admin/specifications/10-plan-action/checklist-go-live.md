# Checklist Go-Live

À cocher dans l'ordre. Aucune case ne peut être sautée. La fondatrice
contre-signe la checklist au moment du go-live.

## J-14 — Préparation

### Code & qualité
- [ ] Toutes les tâches `ADM-001` à `ADM-140` mergées
- [ ] Branche `main` à jour, CI verte
- [ ] Coverage Vitest ≥ 80 % global, ≥ 90 % sur `lib/auth`, `lib/crypto`, `lib/webhooks`
- [ ] Tous les E2E Playwright verts en preview
- [ ] Lighthouse CI : perf > 80, a11y = 100
- [ ] Zero violation `@axe-core/playwright` sur les pages critiques

### Sécurité
- [ ] Rapport OWASP top 10 sans critique non résolu
- [ ] `pnpm audit --prod` 0 vulnerability high
- [ ] Snyk scan 0 high non corrigé
- [ ] gitleaks scan complet historique : 0 secret
- [ ] CSP en mode `enforce` (pas `report-only`)
- [ ] Tous les contrôles `controles.csv` à statut `done` ou `accepted_risk` (signé)
- [ ] DPIA archivée et signée (cf. `07-securite/rgpd-loi-09-08.md`)
- [ ] Notice CNDP rédigée et prête à envoyer (déclaration formulaire 09-08)

### Infrastructure
- [ ] Compte Vercel Pro actif
- [ ] Compte Neon Pro actif (PITR 7j confirmé)
- [ ] Sentry configuré avec scrubPii actif
- [ ] UptimeRobot ping `/healthz` toutes les 5 min
- [ ] Logtail drain configuré (rétention 30j)
- [ ] DNS `femiglow.ma` pointant vers Vercel (A/AAAA)
- [ ] TLS Let's Encrypt valide (vérif `curl -vI https://femiglow.ma`)
- [ ] Variables Vercel production renseignées (toutes celles de `env-variables.csv`)
- [ ] PREVIEW utilise des secrets distincts de PROD

### Monitoring & alertes
- [ ] Alerte Sentry P0 (5xx > 5/min) → Slack `#alerts`
- [ ] Alerte UptimeRobot down → SMS fondatrice
- [ ] Alerte cron silencieux (> 5 min sans tick) → email
- [ ] Alerte spike login failures (> 30/h) → email + Slack
- [ ] Alerte queue webhook > 200 → email
- [ ] Test de chacune de ces alertes en preview (réception confirmée)

### Backup & restore
- [ ] PITR Neon testé (restauration manuelle T-1h en preview)
- [ ] Script `pg_dump` mensuel S3 testé
- [ ] Bucket S3 chiffré KMS, rétention 1 an
- [ ] Procédure de restore documentée et testée

### Documentation
- [ ] `runbook-incident.md` à jour
- [ ] `incident-response.md` à jour
- [ ] `secrets-rotation.md` à jour
- [ ] Manuel utilisateur fondatrice rédigé + screenshots
- [ ] Liste des accès et coordonnées d'urgence dans 1Password

## J-7 — Répétition générale

- [ ] Exercice runbook P0 (rollback simulé) → succès en < 15 min
- [ ] Exercice rotation `ADMIN_SESSION_PASSWORD` en preview
- [ ] Exercice rotation `WEBHOOK_SECRET_KEY` (script re-chiffrement)
- [ ] Test charge légère 200 req/s sur 5 min → p95 < 500ms
- [ ] Smoke E2E complet sur preview
- [ ] Revue de sécurité finale par 1 personne externe

## J-1 — Pré-launch

- [ ] Migration DB finale appliquée sur prod (additif uniquement)
- [ ] Compte admin fondatrice créé via `scripts/create-admin.ts`
- [ ] Email de récupération vérifié (fondatrice peut recevoir un mail)
- [ ] Mot de passe initial communiqué à la fondatrice (canal sécurisé)
- [ ] Fondatrice se connecte avec succès en preview
- [ ] Démo + formation 1h faite avec la fondatrice
- [ ] Fondatrice peut : login, voir liste leads, voir détail, créer un endpoint, voir une delivery

## Jour J — Bascule

### T-30 min
- [ ] Backup snapshot manuel Neon (extra-PITR)
- [ ] Tag git `v1.0.0` posé sur le commit déployé
- [ ] Communication interne (email à la fondatrice + Slack `#general`)
- [ ] Pas de merge `main` autorisé pendant la bascule
- [ ] Plan de rollback (`plan-rollback.md`) ouvert et lu

### T-0 — Go
- [ ] Déploiement promu en production (Vercel)
- [ ] Smoke `curl -I https://femiglow.ma` → 200
- [ ] Login admin manuel par la fondatrice → 200 + cookie
- [ ] Créer 1 lead test via `/admin/leads` (workflow complet)
- [ ] Créer 1 endpoint webhook test (https://webhook.site)
- [ ] Vérifier que la delivery test est reçue côté webhook.site
- [ ] Vérifier qu'un audit_event est créé pour chaque action
- [ ] Vérifier que les logs structurés arrivent dans Logtail

### T+30 min
- [ ] Pas d'erreur 5xx dans Sentry
- [ ] `/healthz` reste 200 (5 pings consécutifs)
- [ ] Cron tick exécuté (audit `system.cron_tick`)
- [ ] Latence p95 < 500ms

### T+24h
- [ ] Aucune erreur P0/P1
- [ ] Pas de pic anormal de login failures
- [ ] Queue webhooks vidée correctement
- [ ] Coût Vercel + Neon en ligne avec le prévisionnel

## J+7 — Bilan post-launch

- [ ] Aucun incident P0
- [ ] ≤ 1 incident P1 (résolu en < 1h)
- [ ] KPI nominal : login disponible, leads listés, deliveries OK
- [ ] Fondatrice exprime confiance dans l'outil
- [ ] Synthèse écrite (1 page) envoyée à la fondatrice

Si tous ces points sont OK : **launch validé** → focus sur backlog v2.

Sinon : post-mortem + correctifs avant tout autre développement.

## Signature

```
Date go-live : ____________________
Signataire (fondatrice) : ___________
Signataire (dev) : __________________
```
