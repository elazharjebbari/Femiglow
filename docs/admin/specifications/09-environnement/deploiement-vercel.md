# Déploiement Vercel

## Plan

| Plan | Choix | Coût |
|---|---|---|
| Vercel Pro | obligatoire (cron > 1/jour) | ~20 USD/mois |
| Bandwidth | inclus 1 TB | suffisant |
| Edge Requests | inclus 1M | suffisant pour année 1 |
| Vercel Analytics | activé | inclus Pro |
| Build Concurrency | 1 build à la fois suffit | ok |

## Configuration projet

`apps/web/vercel.json` :

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs",
  "regions": ["fra1"],
  "crons": [
    {
      "path": "/api/cron/tick",
      "schedule": "* * * * *"
    }
  ]
}
```

| Réglage | Valeur | Justification |
|---|---|---|
| `regions` | `["fra1"]` | Francfort = proche Maroc + même région que Neon eu-central-1 |
| `framework` | `nextjs` | détection auto |
| Output | `.next/standalone` | par défaut Next.js |

## Branches & déploiements

| Branche Git | Déploiement | URL |
|---|---|---|
| `main` | production | https://femiglow.ma |
| `develop` | preview persistant | https://develop-femiglow.vercel.app |
| `feat/*`, `fix/*` | preview éphémère | https://femiglow-pr-{n}.vercel.app |

Vercel détecte automatiquement les PRs GitHub et crée un déploiement
preview par PR. Lien posté en commentaire automatique.

## Variables d'environnement Vercel

Renseignées via `vercel env` ou dashboard.

| Scope | Variables |
|---|---|
| `production` | toutes (cf. `env-variables.csv`) |
| `preview` | toutes sauf `ADMIN_PASSWORD` (pas de seed auto) |
| `development` | uniquement les non-secrets — pour `vercel dev` |

Commande pour synchroniser localement :

```bash
vercel link
vercel env pull .env.local
```

## Build pipeline

```
git push origin feat/admin-leads
        │
        ▼
GitHub envoie webhook → Vercel
        │
        ▼
Vercel crée Neon branch (intégration)
        │
        ▼
Build : pnpm install → pnpm build (1-3 min)
        │
        ▼
Tests CI parallèles (GitHub Actions)
        │
        ▼
Migrations Drizzle appliquées sur Neon branch
        │
        ▼
Déploiement preview disponible
        │
        ▼
Tests E2E sur preview (GH Actions)
        │
        ▼
Reviewer approuve → merge main
        │
        ▼
Vercel déploie production (zero-downtime)
```

## Domaine personnalisé

`femiglow.ma` est attaché au projet Vercel.

- DNS : `A`/`AAAA` chez le registrar pointent vers Vercel.
- TLS : géré par Vercel (Let's Encrypt auto-renew).
- HSTS preload : à inscrire après 6 mois de fonctionnement stable.

## Politique de rollback

Vercel garde **toutes** les versions déployées. Pour rollback :

```bash
vercel rollback https://femiglow-{older-deployment}.vercel.app --scope=femiglow
```

ou via dashboard : Deployments → trois points → Promote to Production.

À combiner avec rollback DB si la migration est problématique
(cf. [`../06-data/migrations-strategy.md`](../06-data/migrations-strategy.md)).

## Limites Vercel à surveiller

| Limite | Plan Pro | Alerte budget |
|---|---|---|
| Function Duration | 60s | warning à 30s p95 |
| Edge Function memory | 128 MB | warning à 100 MB |
| Bandwidth | 1 TB/mois | warning 80 % |
| Edge Requests | 1M/mois | warning 80 % |
| Logs retention | 1 jour Pro | exporter quotidien si besoin >24h |

Configurer dans Vercel : Settings → Spending → Alerts.

## CDN & cache

- Assets statiques (`_next/static/*`) : cache 1 an immutable.
- Pages admin (`force-dynamic`) : `Cache-Control: no-store`.
- Images optimisées : Vercel Image Optimizer (`next/image`).

## Tests

| Type | Vérification |
|---|---|
| Smoke | `curl https://femiglow.ma` → 200 |
| Lighthouse | score perf > 80 sur `/` |
| Headers | E2E `e2e/security-headers.spec.ts` |
| Cron actif | log Vercel `cron.tick.completed` toutes les minutes |
