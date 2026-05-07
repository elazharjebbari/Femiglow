# Setup Neon + Vercel — runbook initial

Procédure d'installation infrastructurelle pour la console admin
FemiGlow. Couvre les tâches **ADM-001 → ADM-020** (Phase 1) et la
config Vercel/Neon nécessaire au runtime des tâches **ADM-061 → ADM-095**
(webhooks).

---

## 1. Compte Neon (Postgres serverless)

1. Créer un projet `femiglow-admin` sur https://console.neon.tech.
2. Région : **eu-central-1** (Frankfurt, latence proche de `fra1`
   Vercel et du Maroc).
3. Créer 2 branches :
   - `main` (prod, autoscaling 0.25→1 CU)
   - `e2e` (preview/staging, autoscaling 0→0.25 CU)
4. Récupérer les URLs de connexion (onglet *Connection Details*) :
   - **Pooled** (port 6543, role `neondb_owner`) → `DATABASE_URL`
     pour Edge runtime / serverless.
   - **Direct** (port 5432) → `DIRECT_DATABASE_URL` pour migrations
     drizzle-kit (qui ouvrent une session SQL longue).

## 2. Application du schéma initial

Le schéma TypeScript est versionné dans
[`src/lib/db/schema.ts`](../../../apps/web/src/lib/db/schema.ts) ; la
migration SQL générée se trouve dans
[`drizzle/migrations/0000_initial.sql`](../../../apps/web/drizzle/migrations/0000_initial.sql).

```bash
cd apps/web
export DATABASE_URL='postgresql://...neon.tech/femiglow?sslmode=require'
pnpm db:migrate
```

`drizzle-kit migrate` applique chaque fichier `.sql` non encore présent
dans la table `drizzle.__drizzle_migrations` (créée automatiquement).
Sur prod, lancer la commande **uniquement** depuis un poste de
confiance (jamais via CI sans guard manuel).

Pour rejouer un schéma vierge sur la branche `e2e` :

```bash
DATABASE_URL='...e2e branch...' pnpm db:push
```

## 3. Création du premier admin

```bash
psql "$DIRECT_DATABASE_URL" <<'SQL'
INSERT INTO admin_users (id, email, password_hash, name)
VALUES (
  'au_' || substr(md5(random()::text), 1, 20),
  'fondatrice@femiglow.ma',
  '$argon2id$...',  -- généré via : node -e "import('@node-rs/argon2').then(m=>m.hash('PASS',{algorithm:2,memoryCost:19456,timeCost:2,parallelism:1}).then(console.log))"
  'Fondatrice'
);
SQL
```

## 4. Variables d'environnement Vercel

Dans le dashboard Vercel → *Settings → Environment Variables*, créer
les entrées suivantes en **Production** + **Preview** :

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled | Production = branche `main`, Preview = `e2e` |
| `DIRECT_DATABASE_URL` | Neon direct | Idem |
| `ADMIN_SESSION_PASSWORD` | `openssl rand -base64 48` | ≥ 32 caractères ; rotation tous les 6 mois |
| `WEBHOOK_SECRET_KEY` | `openssl rand -base64 48` | Master key AES-256-GCM ; rotation = procédure documentée |
| `CRON_SECRET` | `openssl rand -base64 48` | Bearer attendu par `/api/cron/tick` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry projet `femiglow-admin` | Public |
| `LOG_LEVEL` | `info` (prod) / `debug` (preview) | |
| `NEXT_PUBLIC_ENV` | `production` / `preview` | Utilisé pour `secure: true` cookies |

Stocker les secrets en clair dans **1Password vault `FemiGlow Ops`**.

## 5. Vercel Cron

`vercel.json` déclare une cron toutes les minutes pointant vers
`/api/cron/tick`. Vercel ajoute automatiquement un header
`Authorization: Bearer <CRON_SECRET>` ; la route refuse toute requête
sans bearer correct.

## 6. DNS

Domaine `femiglow.ma` géré chez le registrar marocain. Records :

```
A      @            76.76.21.21       (Vercel)
AAAA   @            2606:4700:...     (Vercel IPv6)
CNAME  www          cname.vercel-dns.com
TXT    @            v=spf1 ...        (email)
```

Test : `dig femiglow.ma +short` puis `curl -I https://femiglow.ma`.

## 7. Sentry

Projet Sentry `femiglow-admin`, plateforme **Next.js**. DSN copié dans
`NEXT_PUBLIC_SENTRY_DSN`. Activer :
- Performance monitoring (10 % sample en prod)
- Releases via `sentry-cli` (CI step à venir Phase 5)
- Filtre `environment: production|preview|development`

## 8. Vérifications post-deploy

Une fois le premier deploy passé sur Vercel :

```bash
# DNS + TLS
curl -I https://femiglow.ma                         # 200/301
curl -I https://femiglow.ma/admin                   # 307 → /admin/login

# Headers admin
curl -I https://femiglow.ma/admin/login | grep -i robots-tag
# X-Robots-Tag: noindex, nofollow

# Cron auth (sans bearer = 401)
curl -X POST https://femiglow.ma/api/cron/tick      # 401
```

## 9. PITR + backup

Neon active PITR automatiquement (rétention 7j sur le free tier, 30j
sur le pro tier). Procédure de restore : voir
[`runbook-incident.md`](runbook-incident.md) §3.

---

## Annexe — fallback in-memory

Tant que `DATABASE_URL` n'est pas défini, le client DB
([`src/lib/db/client.ts`](../../../apps/web/src/lib/db/client.ts))
retombe sur un store en mémoire (Maps `globalThis.__femiglowStore`).
Utile pour les tests vitest (245+ tests) et le développement local
sans Postgres. Ne **jamais** déployer en prod sans `DATABASE_URL`.
