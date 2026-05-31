# Déploiement i18n en production

> Procédure complète pour déployer l'i18n FemiGlow en prod : pré-deploy checklist, setup Vercel env vars, migration DB, canary 10% → 50% → 100%, monitoring, communication.
>
> **Principe** : déploiement **progressif** avec feature flag, rollback ≤ 5 min, monitoring premières 24h critique.
>
> **Audience** : lead technique (exécution), founder (signoff), QA (vérifications), équipe (comm).

---

## Sommaire

- [Pré-deploy checklist](#pré-deploy-checklist)
- [Setup env vars Vercel](#setup-env-vars-vercel)
- [Migration DB](#migration-db)
- [Snapshot DB](#snapshot-db)
- [Déploiement initial (sans activation)](#déploiement-initial-sans-activation)
- [Canary 10%](#canary-10)
- [Canary 50%](#canary-50)
- [Canary 100%](#canary-100)
- [Communication équipe](#communication-équipe)
- [Monitoring premières 24h](#monitoring-premières-24h)
- [Si incident : rollback](#si-incident--rollback)
- [Checklist post-deploy](#checklist-post-deploy)

---

## Pré-deploy checklist

À cocher **avant** de toucher à la prod. Si un seul point rouge → STOP, on ne déploie pas.

### Tests et qualité

- [ ] CI master 100% verte (typecheck, lint, unit, integration, e2e, visual, a11y)
- [ ] Coverage gates respectés (cf. `apps/web/vitest.config.ts`)
- [ ] ESLint rule i18n custom en mode `error` (cf. Phase 6)
- [ ] Lighthouse CI vert sur 3 locales (perf, a11y, SEO ≥ thresholds)
- [ ] 0 flaky test sur 3 runs consécutifs CI
- [ ] Rapport boucle correction signé ([`../11-test-execution/`](../11-test-execution/))

### Contenu et traductions

- [ ] `messages/fr.json` validé fondatrice
- [ ] `messages/ar.json` 100% complet + validé native speaker AR-MA
- [ ] `messages/en.json` 100% complet + review humaine P0
- [ ] Glossaires à jour (`docs/i18n-strategy-2026-05/06-data-strategy/glossaire-*`)
- [ ] Pas de `[TODO-...]` résiduel dans les messages

### Code et build

- [ ] `pnpm -F web build` exit 0 en local
- [ ] `pnpm -F web build` exit 0 en CI sur master
- [ ] Bundle size delta < +15% vs baseline (cf. Lighthouse report)
- [ ] No `console.log` ou `debugger` résiduel dans le code

### Infrastructure

- [ ] Snapshot DB pré-deploy validé (cf. § Snapshot DB)
- [ ] Vercel env vars configurées sur production (sans activer encore)
- [ ] Edge config Vercel disponible (si canary par %)
- [ ] Sentry configuré pour tagger locale (cf. T7.6)
- [ ] Analytics dimension custom `locale` configurée
- [ ] DNS et certificats SSL OK (femiglow.ma)

### Monitoring et alerting

- [ ] Dashboard Sentry "i18n errors" créé
- [ ] Dashboard Vercel Analytics "Locale distribution" créé
- [ ] Alerts Sentry configurées :
  - Erreur 5xx > 1% sur 5 min → alerte
  - Erreur 5xx > 5% sur 5 min → page on-call
  - Spike events × 10 vs baseline → alerte
- [ ] Webhook Slack #team-femiglow configuré
- [ ] On-call désigné pour les 72h post-deploy

### Documentation

- [ ] [`./troubleshooting.md`](./troubleshooting.md) à jour avec erreurs connues
- [ ] [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) lu par tous
- [ ] Templates messages Slack incident prêts
- [ ] CR pré-deploy meeting créé

### Équipe

- [ ] Lead disponible pendant 72h post-deploy
- [ ] Founder dispo pour validation immédiate
- [ ] Pas de PR critique en parallèle (geler master 24h avant deploy)
- [ ] Pas de vendredi soir, pas de jour férié

---

## Setup env vars Vercel

À faire **1-2 jours avant** le canary 10%. Setup sans activer.

### Variables à créer / mettre à jour

Voir [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md) pour la matrice complète.

Liste minimale :

| Variable | Production | Preview | Development |
|---|---|---|---|
| `I18N_ENABLED` | **false** (toggle après canary) | `true` | `true` |
| `I18N_LOCALES_ACTIVE` | `fr,ar,en` | `fr,ar,en` | `fr,ar,en` |
| `I18N_RTL_ENABLED` | `true` | `true` | `true` |
| `I18N_CMS_BINDINGS_ENABLED` | **false** (toggle si phase 3 OK) | `true` | `true` |

### Commandes Vercel CLI

#### Méthode 1 — Via CLI (recommandé)

```bash
# Auth (si pas déjà fait)
vercel login
vercel link --project femiglow

# I18N_ENABLED en production : false (sera flippé true au canary 100%)
vercel env add I18N_ENABLED production
# Entrer : false
# (puis Y pour confirmer)

# I18N_LOCALES_ACTIVE en production
vercel env add I18N_LOCALES_ACTIVE production
# Entrer : fr,ar,en

# I18N_RTL_ENABLED en production
vercel env add I18N_RTL_ENABLED production
# Entrer : true

# I18N_CMS_BINDINGS_ENABLED en production (selon phase 3 status)
vercel env add I18N_CMS_BINDINGS_ENABLED production
# Entrer : false (si phase 3 pas déployée) ou true

# Idem pour preview (vu plus haut), development se gère via .env.local
```

#### Méthode 2 — Via Dashboard

1. https://vercel.com/femiglow/web/settings/environment-variables
2. Cliquer "Add New"
3. Pour chaque variable :
   - Name : `I18N_ENABLED`
   - Value : `false`
   - Environments : cocher seulement "Production"
   - Save
4. Répéter pour les 3 autres variables

### Vérifier la configuration

```bash
vercel env ls production
# Attendu : voir les 4 vars I18N_*

# Voir une valeur spécifique (si autorisé)
vercel env pull --environment=production /tmp/.env.prod
cat /tmp/.env.prod | grep I18N_
# Vérifier les valeurs
rm /tmp/.env.prod   # nettoyer
```

### Redeploy pour appliquer

Vercel n'applique les nouvelles env vars qu'au prochain deploy :

```bash
# Trigger un redeploy (sans nouveau commit)
vercel --prod
# Ou via dashboard : Deployments → ... → Redeploy
```

⚠️ Ce redeploy avec `I18N_ENABLED=false` ne change rien visuellement (le site continue de servir en monolingue FR). C'est le but : préparer l'infra.

### Vérifier après redeploy

```bash
# Tester le site en prod
curl -s https://femiglow.ma/ | grep -o '<html[^>]*>'
# Attendu : <html lang="fr">  (sans dir RTL, sans préfixe locale)

curl -s -I https://femiglow.ma/contact
# Attendu : 200 OK (legacy route, pas de redirect vers /fr/contact)

curl -s -I https://femiglow.ma/fr/contact
# Attendu : 404 (la route /[locale]/ n'est pas activée)
```

---

## Migration DB

Si la phase 3 (CMS multilingue) inclut des migrations Drizzle, les appliquer **avant** le canary.

### Lister les migrations en attente

```bash
cd apps/web
pnpm drizzle-kit check
# Liste les migrations qui seraient appliquées
```

### Appliquer en staging d'abord

```bash
# Connect staging
DATABASE_URL=$STAGING_DATABASE_URL pnpm db:migrate
# Vérifier
psql $STAGING_DATABASE_URL -c "\dt"
psql $STAGING_DATABASE_URL -c "SELECT * FROM i18n_locales;"
```

### Tester en staging

- [ ] Toutes les pages admin fonctionnent
- [ ] CMS save / load OK
- [ ] Pas d'erreur dans les logs Vercel staging

### Appliquer en production

⚠️ **Avant cette étape** : snapshot DB obligatoire (cf. section suivante).

```bash
# Connect production
DATABASE_URL=$PROD_DATABASE_URL pnpm db:migrate
# Vérifier
psql $PROD_DATABASE_URL -c "SELECT count(*) FROM component_field_bindings;"
# Devrait être identique à avant (migration additive uniquement)
```

### Si migration foire en prod

Voir [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) § Rollback migration Drizzle.

Migrations FemiGlow i18n sont **toutes additives** (cf. ADR-006), donc rollback rare. Si vraiment besoin :

```bash
# Drop index (innocuous)
psql $PROD_DATABASE_URL -c "DROP INDEX IF EXISTS idx_cfb_locale_lookup;"

# Le backfill 'fr' reste — n'est pas un problème
```

---

## Snapshot DB

À faire **avant chaque deploy à risque** (phase 3 migration, phase 7 deploy).

### Via Neon Console

1. https://console.neon.tech/app/projects/femiglow-prod
2. Branches → `main`
3. "Create branch" → from `main` current state
4. Nom : `pre-i18n-deploy-{YYYYMMDD-HHMM}`
5. Retention : 30 jours minimum
6. Create

### Via Neon CLI

```bash
# Auth
neonctl auth

# Snapshot
neonctl branches create \
  --project-id femiglow-prod \
  --name "pre-i18n-deploy-$(date +%Y%m%d-%H%M)" \
  --parent main

# Lister
neonctl branches list --project-id femiglow-prod
```

### Vérifier le snapshot

```bash
# Récupérer connection string du snapshot
neonctl connection-string \
  --project-id femiglow-prod \
  --branch "pre-i18n-deploy-{date}"

# Tester restore-like : connecter et compter rows
psql $SNAPSHOT_URL -c "SELECT count(*) FROM component_field_bindings;"
psql $SNAPSHOT_URL -c "SELECT count(*) FROM i18n_locales;"
# Comparer avec prod actuel : doit être identique
```

### Documenter

Créer une entrée dans `docs/i18n-strategy-2026-05/00-context/log-snapshots.md` :

```markdown
## Snapshot pre-i18n-deploy-{date}

- **Date** : YYYY-MM-DD HH:MM UTC
- **Trigger** : avant canary i18n
- **Nom branch Neon** : `pre-i18n-deploy-{date}`
- **Tables backupées** : toutes
- **Retention** : jusqu'au {date+30j}
- **Restorable test** : ✓ vérifié sur DB temp
```

---

## Déploiement initial (sans activation)

### Étape 1 — Merger la PR sur master

```bash
# Sur la PR de la phase concernée
gh pr merge --squash --auto
# Squash garde un historique propre
```

### Étape 2 — Vérifier le deploy auto Vercel

Vercel déploie automatiquement sur push master. Suivre :

```bash
# Via CLI
vercel inspect <deployment-url>

# Ou via Dashboard
# https://vercel.com/femiglow/web/deployments
```

Attendre l'état "Ready" (~3-5 min).

### Étape 3 — Smoke test post-deploy

Avec `I18N_ENABLED=false` en prod, le site doit toujours fonctionner en monolingue FR legacy :

```bash
# Routes legacy
curl -I https://femiglow.ma/
curl -I https://femiglow.ma/contact
curl -I https://femiglow.ma/kit
curl -I https://femiglow.ma/maison
curl -I https://femiglow.ma/rituel
# Attendu : tout 200 OK

# Routes /[locale]/* devraient retourner 404 (pas activées)
curl -I https://femiglow.ma/fr/contact
# Attendu : 404 (middleware bypass car I18N_ENABLED=false)
```

### Étape 4 — Vérifier Sentry n'a pas d'erreur spike

https://sentry.io/organizations/femiglow/issues/

Filtrer sur les 15 dernières minutes. Doit être au baseline (~ 0 nouveau).

### Étape 5 — Tests E2E synthétiques (optionnel)

```bash
# Lancer les tests E2E contre la prod
PLAYWRIGHT_BASE_URL=https://femiglow.ma pnpm -F web exec playwright test e2e/smoke/
# Attendu : tous passent (smoke tests legacy)
```

---

## Canary 10%

### But

Activer i18n pour **10% du trafic** en prod pendant 24h. Détecter les anomalies avant exposition massive.

### Méthode 1 — Via Vercel Edge Config (recommandé)

```bash
# Créer une Edge Config (si pas déjà fait)
vercel edge-config create

# Setter une key de rollout
vercel edge-config set I18N_ROLLOUT_PERCENT 10
```

Côté code (middleware ou Edge Function) :

```typescript
// apps/web/src/middleware.ts (extrait conceptuel)
const rolloutPercent = await get('I18N_ROLLOUT_PERCENT') ?? 0;
const userBucket = hashUserId(req.cookies.userId ?? req.ip);
const inCanary = userBucket < rolloutPercent;

if (!inCanary) {
  return NextResponse.next(); // legacy
}
// Apply i18n middleware
```

### Méthode 2 — Toggle global avec monitoring serré (alternative)

Si Edge Config pas dispo, activer pour 100% mais surveiller comme un canary :

```bash
vercel env rm I18N_ENABLED production
vercel env add I18N_ENABLED production
# Entrer : true
vercel --prod
```

⚠️ Méthode plus risquée — préférer la méthode 1.

### Étape 1 — Setup canary

```bash
# Activer rollout 10%
vercel edge-config set I18N_ROLLOUT_PERCENT 10

# Trigger redeploy
vercel --prod
```

### Étape 2 — Vérifier que ça marche

Ouvrir plusieurs navigateurs / private windows / VPN différents :

- 10% (1 sur 10 essais) → arrive sur `/fr/contact` (i18n actif)
- 90% → arrive sur `/contact` (legacy)

### Étape 3 — Monitoring 24h

#### Sentry

```
https://sentry.io/organizations/femiglow/issues/
Filters :
- Tag locale: fr, ar, en
- Last 24h
```

KPIs à surveiller :

| Métrique | Seuil normal | Seuil alarmant |
|---|---|---|
| Erreurs 5xx | < 0.5% requests | > 1% |
| Erreurs JS client | < 50/h | > 200/h |
| Erreurs RSC | 0 | > 5 |
| Erreurs middleware | 0 | > 1 |

#### Vercel Analytics

```
https://vercel.com/femiglow/web/analytics
```

KPIs :

| Métrique | Seuil normal | Seuil alarmant |
|---|---|---|
| LCP p75 | < 2.5s | > 4s |
| CLS p75 | < 0.1 | > 0.25 |
| FID p75 | < 100ms | > 300ms |
| Conversion (visit → cart) | baseline ±5% | -10% sur 1h |

#### Logs Vercel

```bash
vercel logs https://femiglow.ma --since=1h
# Surveiller les erreurs middleware
```

### Étape 4 — Communication équipe

Slack #team-femiglow :

```
[I18N] Canary 10% démarré
Date : {date}
Trafic exposé : 10%
Locales actives : fr, ar, en
Monitoring : 24h
Owner on-call : @lead

KPIs dashboard : <lien>
Rollback si incident : `vercel edge-config set I18N_ROLLOUT_PERCENT 0`
```

### Décision après 24h

Au bout de 24h :

| Situation | Décision |
|---|---|
| 0 incident, KPIs stables | **GO** canary 50% |
| Bug isolé non-critique (typo, layout mineur) | Fix + redeploy, garder 10% encore 24h |
| Bug critique (5xx, layout cassé) | **Rollback** : `I18N_ROLLOUT_PERCENT=0`, investiguer |
| Conversion drop > 5% | Pause + investigation business |

---

## Canary 50%

### Étape 1 — Ramp à 50%

```bash
vercel edge-config set I18N_ROLLOUT_PERCENT 50
```

### Étape 2 — Monitoring 48h

Mêmes KPIs que canary 10%, mais avec attention particulière à :

- **Conversion par locale** : `/ar/*` et `/en/*` doivent atteindre des chiffres exploitables (≥ 100 sessions / locale en 48h pour avoir signal)
- **Bounce rate par locale** : ne doit pas exploser (>80% par exemple)
- **Erreurs spécifiques par locale** : Sentry tag filter

### Étape 3 — Communication

```
[I18N] Canary 50% démarré
Date : {date}
Trafic exposé : 50%
Monitoring : 48h
0 incident en phase 10%

Locale distribution observée à 10% :
- FR : 78% des sessions
- AR : 12%
- EN : 10%

Décision GO canary 100% : {date+48h}
```

### Décision après 48h

| Situation | Décision |
|---|---|
| KPIs stables, conversion stable | **GO** 100% |
| Conversion drop par locale | Investigation + retour 10% si grave |
| Bug critique | Rollback complet |

---

## Canary 100%

### Étape 1 — Ramp final

```bash
# Option A — Garder Edge Config mais 100%
vercel edge-config set I18N_ROLLOUT_PERCENT 100

# Option B — Retirer le rollout (i18n activé pour tous)
vercel edge-config delete I18N_ROLLOUT_PERCENT
vercel env rm I18N_ENABLED production
vercel env add I18N_ENABLED production
# Entrer : true
vercel --prod
```

### Étape 2 — Monitoring 72h serré

Au-delà des KPIs habituels, vérifier :

- **Toutes les routes en prod** : `/`, `/fr/*`, `/ar/*`, `/en/*` répondent 200
- **SEO** : Google Search Console — vérifier que les URLs sont indexées
- **Sitemaps** : `/sitemap.xml` contient les 3 locales × N routes
- **hreflang** : `<head>` contient les bonnes alternates

```bash
# Smoke prod complet
for locale in fr ar en; do
  for route in '' 'contact' 'kit' 'maison' 'rituel' 'journal'; do
    url="https://femiglow.ma/${locale}/${route}"
    echo -n "Testing $url : "
    curl -s -o /dev/null -w "%{http_code}\n" "$url"
  done
done
# Attendu : tout 200
```

### Étape 3 — Sitemap submission Google

```bash
# Soumettre à Google Search Console
# https://search.google.com/search-console
# → Sitemaps → ajouter : https://femiglow.ma/sitemap.xml
```

### Étape 4 — Vérifier hreflang

```bash
curl -s https://femiglow.ma/fr/contact | grep hreflang
# Attendu :
# <link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/contact">
# <link rel="alternate" hreflang="ar" href="https://femiglow.ma/ar/contact">
# <link rel="alternate" hreflang="en" href="https://femiglow.ma/en/contact">
# <link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/contact">
```

### Étape 5 — Communication équipe

```
[I18N] Canary 100% — i18n en prod live ✓
Date : {date}
Locales actives : fr, ar, en

Timeline canary :
- 10% : {date1} → {date2} (24h)
- 50% : {date2} → {date3} (48h)
- 100% : {date3} → live (72h surveillance accrue)

KPIs cumulés sur 4 jours :
- Sessions total : {N}
- Distribution : FR {X}%, AR {Y}%, EN {Z}%
- Conversion : baseline {X}% → actuelle {Y}% (delta {Z}%)
- Erreurs critiques : 0
- LCP p75 : {X}s (objectif < 2.5s ✓)

Prochaines étapes :
- Monitoring 30 jours
- Phase 8 stabilisation (bug bash, a11y, perf approfondi)
- Post-mortem complet
```

---

## Communication équipe

### Templates Slack

#### Pré-deploy (J-1)

```
[I18N] Demain : démarrage canary 10% i18n

@here

Date début : demain {date} à {heure} UTC
Owner : @lead
On-call : @lead pendant 72h

Préparation :
- ✓ Snapshot DB fait
- ✓ Env vars Vercel configurées
- ✓ Dashboards monitoring prêts
- ✓ Doc rollback à jour

Communication :
- Update toutes les 4h pendant les premières 24h
- Slack incident channel : #team-femiglow
- Page on-call si besoin : @lead

Pas de PR sur master demain SVP (geler 24h avant).
```

#### Pendant canary

Mise à jour toutes les 4h en début de canary :

```
[I18N Canary 10% — H+4h]

KPIs :
- Sessions /fr/* : {N} (+{delta} vs baseline)
- Sessions /ar/* : {N}
- Sessions /en/* : {N}
- Erreurs Sentry : {N} (baseline : {N})
- LCP p75 par locale : FR {X}s, AR {Y}s, EN {Z}s
- Conversion : {X}% (baseline {Y}%)

Statut : ✓ vert / ⚠ jaune / 🚨 rouge
Action : continue / pause / rollback
```

#### Post-deploy 100%

```
[I18N] Live en prod ✓

i18n FemiGlow déployé à 100% du trafic depuis {date}.

Locales actives :
- 🇫🇷 Français (par défaut) — femiglow.ma/fr/
- 🇲🇦 العربية (RTL) — femiglow.ma/ar/
- 🇬🇧 English — femiglow.ma/en/

Stats premiers 7 jours :
- Sessions cumulées : {N}
- Distribution : FR {X}%, AR {Y}%, EN {Z}%
- Conversion : stable (±{X}%)

Merci à toute l'équipe ! @founder @dev @translator-ar @translator-en @qa
```

### Communication publique (optionnel)

Selon politique FemiGlow. Si annonce :

#### LinkedIn / Instagram FR

```
Notre site est désormais disponible en arabe et en anglais.
femiglow.ma/ar — للعملاء العرب
femiglow.ma/en — for international clients

Une étape qui nous rapproche de toutes celles qui prennent soin de leurs mains, dans leur langue.

#FemiGlow #Maroc
```

#### Instagram AR

```
موقع FemiGlow متوفر الآن باللغة العربية.
femiglow.ma/ar

#FemiGlow
```

### Status page (si existe)

```
[INFO] Nouvelle fonctionnalité — i18n
Date : {date}
Statut : Operational

Le site femiglow.ma est désormais disponible en 3 langues : Français, Arabe et Anglais.
```

---

## Monitoring premières 24h

### Dashboard à garder ouvert

1. **Sentry** : https://sentry.io/organizations/femiglow/issues/
   - Filter : Last 24h
   - Group by : Tag locale

2. **Vercel Analytics** : https://vercel.com/femiglow/web/analytics
   - Real User Monitoring
   - Locale distribution
   - Core Web Vitals par locale

3. **GA4 / Plausible** : conversion funnel
   - Sessions par locale
   - Bounce rate par locale
   - Conversion (visit → cart → purchase) par locale

### Routine surveillance

Pendant les **24 premières heures** :

- **H+0** : vérifier deploy OK, premier monitoring
- **H+1** : check KPIs initiaux
- **H+4** : update Slack
- **H+8** : update Slack
- **H+12** : check nuit (selon fuseau horaire)
- **H+18** : vérifier reprise activité après nuit
- **H+24** : bilan complet, décision GO canary 50%

Pendant **24-72h** suivantes :

- Update Slack toutes les 8h
- Check Sentry sur incidents tag i18n
- Vérifier conversion alignée

Au-delà de 72h :

- Monitoring standard (alertes Sentry actives, daily check)

### KPIs précis à monitorer

| KPI | Source | Seuil OK | Seuil alarmant |
|---|---|---|---|
| Erreur 5xx total | Vercel | < 0.3% | > 1% |
| Erreur 5xx `/ar/*` | Sentry tag | < 0.5% | > 2% |
| Erreur 5xx `/en/*` | Sentry tag | < 0.5% | > 2% |
| LCP p75 `/fr/*` | Vercel RUM | < 2.5s | > 4s |
| LCP p75 `/ar/*` | Vercel RUM | < 2.5s | > 4s |
| LCP p75 `/en/*` | Vercel RUM | < 2.5s | > 4s |
| CLS p75 toutes locales | Vercel RUM | < 0.1 | > 0.25 |
| Conversion globale | GA4 | baseline ±5% | -10% sur 1h |
| Bounce rate /ar/* | GA4 | < 60% | > 80% |
| Sessions /ar/* | GA4 | ≥ 50 / 24h | < 10 |
| 404 sur sitemap URLs | Vercel logs | 0 | > 5 |

---

## Si incident : rollback

Voir [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) pour la procédure complète.

### Décision rollback en 1 minute

| Symptôme | Sévérité | Action |
|---|---|---|
| Erreur 5xx > 5% sur 5 min | SEV1 | **Rollback immédiat** |
| Conversion drop > 20% sur 30 min | SEV1 | **Rollback immédiat** |
| Layout cassé > 50% utilisateurs visible | SEV1 | **Rollback immédiat** |
| Erreur 5xx 1-5% sur 5 min | SEV2 | Investigation + rollback si pas résolu sous 15 min |
| Bug fonctionnel critique (checkout cassé) | SEV2 | Rollback partiel (désactiver locale concernée) |
| Typo / bug cosmétique | SEV3 | Fix forward (PR + redeploy) |
| Bug isolé à 1 parcours rare | SEV3 | Fix forward |

### Commande rollback ≤ 5 min

```bash
# Option 1 — Toggle master flag
vercel env rm I18N_ENABLED production
vercel env add I18N_ENABLED production
# Entrer : false
vercel --prod
# Temps : 3-5 min

# Option 2 — Edge Config (plus rapide si activé)
vercel edge-config set I18N_ROLLOUT_PERCENT 0
# Temps : 30s (pas de redeploy nécessaire)
```

### Communication immédiate

```
🚨 [INCIDENT] Rollback i18n en cours

Heure : {UTC time}
Trigger : <description>
Action : I18N_ENABLED=false (ou ROLLOUT=0)
Impact estimé : {N}% utilisateurs
Statut : Rollback effectif depuis {time}

Prochains steps :
- Investigation cause racine (en cours)
- Post-mortem programmé : {date+24h}
```

### Post-incident

1. Confirmer KPIs reviennent au baseline (sous 15 min)
2. Investiguer cause racine (1-2h)
3. Fix sur staging
4. Tester sur staging
5. Re-canary 10% (jamais direct 100% post-incident)
6. Post-mortem template `08-plan-action/rollback.md` § Template post-mortem

---

## Checklist post-deploy

### Immédiatement après canary 100%

- [ ] Site accessible `/fr/*`, `/ar/*`, `/en/*` (curl tests)
- [ ] LocaleSwitcher visible et fonctionnel
- [ ] Cookie `NEXT_LOCALE` persiste
- [ ] hreflang dans `<head>` correct
- [ ] Sitemap `/sitemap.xml` contient 3 locales
- [ ] Sentry : 0 erreur critique nouvelle
- [ ] Vercel Analytics : LCP < 2.5s sur 3 locales
- [ ] Conversion stable (±5% vs baseline)

### Sur 7 jours

- [ ] Soumettre sitemap à Google Search Console
- [ ] Vérifier indexation Google des URLs `/fr/`, `/ar/`, `/en/`
- [ ] Analyser locale distribution réelle vs attendue
- [ ] Review feedback users (support, social)
- [ ] Compiler bug list pour Phase 8 stabilisation
- [ ] Update post-mortem avec stats réelles

### Sur 30 jours

- [ ] Bilan SEO : impressions/clics par locale (Google Search Console)
- [ ] Bilan business : conversion par locale, AOV par locale, panier moyen
- [ ] Bilan tech : bundle size, perf trends, erreur trends
- [ ] Décision : ajouter nouvelle locale ? Cf. [`ajouter-nouvelle-langue.md`](./ajouter-nouvelle-langue.md)
- [ ] Retro sprint i18n : qu'est-ce qui a marché, qu'est-ce qui a foiré
- [ ] Post-mortem signé et partagé

---

## Annexe — Templates emails

### Email founder pré-deploy (J-2)

```
Objet: [i18n] Deploy prévu {date+2j} — Validation requise

Bonjour {founder},

Toutes les conditions sont vertes pour démarrer le canary i18n :

✓ Tests CI 100% verts
✓ Validation native speaker AR-MA OK
✓ Validation voix FR OK
✓ Performance Lighthouse OK
✓ A11y OK
✓ Snapshot DB prêt
✓ Plan rollback testé

Calendrier prévu :
- J+2 : démarrage canary 10% (heure : matin UTC)
- J+3 : ramp à 50% si KPIs verts
- J+5 : ramp à 100%

Votre signoff pour démarrer ? OK / non / décaler ?

Merci
{Lead}
```

### Email post-deploy (J+5)

```
Objet: [i18n] Deploy 100% effectif — Récap

Bonjour {founder},

L'i18n FemiGlow est à 100% en production depuis {date}.

Stats premiers 4 jours :
- {N} sessions cumulées
- {X}% FR, {Y}% AR, {Z}% EN
- 0 incident critique
- Conversion stable ({X}% vs baseline {Y}%)

Points d'attention pour la suite :
- {Point 1 : ex bounce rate AR plus élevé que prévu, à investiguer}
- {Point 2}

Prochaines étapes :
- Monitoring 30j en mode "alertes seulement"
- Phase 8 stabilisation (bug bash, a11y profond) la semaine prochaine
- Post-mortem complet sous 7j

Bravo à toute l'équipe.
{Lead}
```

---

## Liens utiles

- [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md) — Configuration flags
- [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) — Procédures rollback détaillées
- [`./troubleshooting.md`](./troubleshooting.md) — Erreurs fréquentes
- [`./operations-quotidiennes.md`](./operations-quotidiennes.md) — Monitoring post-deploy
- [`../10-monitoring/`](../10-monitoring/) — Dashboards et KPIs

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
