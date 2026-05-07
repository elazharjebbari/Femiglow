# 11 — Runbook

Procédures opérationnelles pour le module **Tracking & Analytics
Console**. Toutes les commandes sont à exécuter depuis `apps/web/`
sauf mention contraire. Conventions : tout ID commence par
`tp_`/`tc_`/`ted_`/`tce_`/`tpr_`/`tev_`/`tcs_` (cf. README §
Conventions).

---

## 1. Ajouter un nouveau pixel (provider)

### Cas A — Provider supporté (Meta, TikTok, Google, Snap, Pinterest)

1. Se connecter à `/admin` (compte fondatrice ou superadmin).
2. **Tracking → Providers → + Ajouter**.
3. Sélectionner le type (`meta`, `tiktok`, `google`, `snap`,
   `pinterest`).
4. Renseigner les credentials :
   - **Meta** : `pixel_id`, `access_token` (CAPI), `test_event_code`
     optionnel.
   - **TikTok** : `pixel_id`, `access_token`.
   - **Google** : `measurement_id` (G-XXXX), `api_secret`,
     `conversion_label` par event (CSV ou JSON).
   - **Snap** : `pixel_id`, `oauth_refresh_token`, `client_id`,
     `client_secret`.
   - **Pinterest** : `tag_id`, `access_token`, `ad_account_id`.
5. Cliquer **Tester la connexion** : la console envoie un event
   `pixel_test` en mode dry-run (`test_event_code` Meta, équivalent
   sur les autres). Vérifier le retour vert (HTTP 2xx).
6. Cocher **Activer côté client** (charge le script du pixel) et/ou
   **Activer côté serveur** (CAPI). Au moins un des deux requis.
7. Sélectionner les events à dispatcher (par défaut : tout le funnel
   commerce P0). Bouton **Mapping avancé** pour overrider les
   conversion labels Google.
8. **Enregistrer** → un audit `provider_created` est inséré.

Le pixel est actif **immédiatement** côté client (script chargé au
prochain `page_view` via `<TrackingProvider>`) et côté serveur
(dispatcher s'abonne au worker dedup).

### Cas B — Provider custom (script tiers, Hotjar, Clarity, etc.)

1. **Tracking → Providers → + Ajouter → Type : Custom**.
2. Champ **Nom** (ex. `Hotjar`).
3. Champ **Code custom** (textarea) : copier le snippet officiel.
4. Le code est validé : pas de `eval`, pas de `document.write`,
   pas de `<script src="javascript:">`. Charge sandboxée via
   `<Script strategy="afterInteractive" nonce={cspNonce}>`.
5. Optionnel : champ **Hooks events** (JSON) pour mapper les events
   FemiGlow vers des appels custom (`onAddToCart: "hj('event', 'add_cart')"`).
6. **Tester** dans la page `/admin/tracking/test` (sandbox iframe).
7. **Enregistrer**.

> **Sécurité** : tout code custom passe par `csp/sanitize.ts` qui
> refuse les patterns dangereux. La revue manuelle reste obligatoire
> avant activation en production (un audit `pending_review` est créé).

---

## 2. Désactiver / réactiver le tracking sur un composant

### Désactivation rapide (incident, RGPD)

1. **Tracking → Inventaire → Composants**.
2. Recherche par nom (ex. `KitHero`).
3. Cliquer la ligne → drawer s'ouvre.
4. Toggle **Tracking actif** → `Off`.
5. Confirmation : "Désactiver `view_promotion` × `select_promotion` ×
   `click` sur 4 pages ?". Cliquer **Désactiver**.

L'effet est **instantané** : le `<TrackingProvider>` re-fetch sa
config toutes les 60s, et le SDK client check `isComponentEnabled()`
avant chaque `emit()`. Pour forcer immédiatement, déclencher un
revalidate :

```bash
curl -X POST https://femiglow.com/api/admin/tracking/revalidate \
  -H "Cookie: admin_session=..."
```

### Désactivation événement par événement

Drawer composant → onglet **Events** → toggle individuel (ex. ne
plus tracker `scroll_depth` mais conserver `click`).

### Réactivation après incident

Même procédure. L'historique des toggles est conservé dans
`tracking_audit` (qui, quand, pourquoi via le champ `note`).

---

## 3. Audit consentement (RGPD / réclamation utilisateur)

Cas typique : un utilisateur demande la preuve de son consentement
ou une rectification.

```bash
# Recherche par anonymous_id (visible dans le cookie fg_aid côté client)
psql $DATABASE_URL -c "
  SELECT id, anonymous_id, consent_state, source, recorded_at
  FROM tracking_consent_snapshots
  WHERE anonymous_id = 'aid_XXXX'
  ORDER BY recorded_at DESC
  LIMIT 50;
"
```

Pour un export complet (RGPD article 15) :

```bash
pnpm tsx scripts/tracking-export-user.ts --anonymous-id aid_XXXX --out /tmp/user-export.json
```

Le script agrège : snapshots consent, events log, providers ayant
reçu les events. Format JSON conforme RGPD.

Pour effacer (article 17) :

```bash
pnpm tsx scripts/tracking-erase-user.ts --anonymous-id aid_XXXX --confirm
```

Le script :
1. supprime les `tracking_events_log` ayant `anonymous_id` matchant,
2. envoie une demande de suppression CAPI à chaque provider concerné
   (Meta `/<dataset_id>/users` DELETE, TikTok équivalent, etc.),
3. archive un audit `gdpr_erasure` signé.

> **Délai** : la propagation côté providers prend 48h à 30j selon
> le provider. Documenter la date d'envoi dans la réponse à
> l'utilisateur.

---

## 4. Déboguer un event manquant

Symptôme : un event attendu (ex. `purchase`) n'apparaît pas dans
GA4 ou Meta Events Manager.

### Étape 1 — vérifier côté client

Dans le navigateur, ouvrir la console et exécuter :

```js
window.femiglowDataLayer.flush()
window.femiglowDataLayer.recent(20)
```

`recent()` retourne les 20 derniers events poussés. Si l'event
manque ici → problème côté composant (mauvais déclenchement,
condition, dedup trop agressif).

### Étape 2 — vérifier l'ingestion

Onglet **Network** du DevTools, filtrer `/api/track`. La requête
doit retourner `204 No Content`. Si `4xx` :
- `400` : payload invalide (Zod). Voir `error.fields`.
- `401` : consent refusé. Vérifier `consent.ad_storage`.
- `429` : rate-limit. Réduire la fréquence (max 60/min/IP).

### Étape 3 — vérifier la persistence

```sql
SELECT id, event, status, providers_dispatch, received_at
FROM tracking_events_log
WHERE event = 'purchase'
  AND received_at > now() - interval '15 minutes'
ORDER BY received_at DESC
LIMIT 10;
```

Si l'event est en `status = 'invalid'`, lire `validation_errors`
(JSON colonne).

### Étape 4 — vérifier le dispatch provider

Drawer event log → onglet **Dispatch**. Chaque provider affiche son
statut : `success`, `pending`, `failed` (avec body de réponse).

Cas fréquents :
- **Meta** : `Invalid parameter` → user_data manquant. Vérifier que
  `fbp`/`fbc` sont bien capturés (cookies first-party requis).
- **Google** : `MEASUREMENT_ID_INVALID` → mauvais G-XXXX.
- **TikTok** : `TT002` → access_token expiré.

### Étape 5 — déboguer en live

`/admin/tracking/test` permet de rejouer un event sur la session
courante avec `dry_run: true`. La réponse contient le payload
exact envoyé à chaque provider et leur réponse.

---

## 5. Auditer les déduplications CAPI (Meta, TikTok)

Objectif : maintenir un **match rate ≥ 95%** sur Meta Events
Manager (sinon perte d'attribution).

```bash
pnpm tsx scripts/tracking-dedup-audit.ts --provider meta --since 7d
```

Sortie typique :

```
Meta dedup audit (last 7d)
─────────────────────────────────────
Events sent client (Pixel) : 12 348
Events sent server (CAPI)  : 12 102
Match (event_id present)   : 11 814 (95.7%)
Server only                : 288 (2.3%)
Client only                : 246 (2.0%)

Missing event_id breakdown :
  - purchase            : 12  ← critique
  - add_to_cart         : 105
  - view_item           : 129

Suggestion : vérifier que l'eventID Pixel est bien
transmis pour les composants suivants : KitHero, Recap.
```

Si le match rate < 95%, suivre la procédure §6.

---

## 6. Réparer une dérive d'event_id

Symptôme : `dedup_audit` < 95% match rate.

Causes possibles :
- Le composant émet l'event côté client mais le serveur reçoit un
  payload sans `event_id` (bug TrackingClient).
- L'horloge client est désynchronisée (`event_id` UUIDv7 timestamp
  divergent → considéré comme nouvel event côté Meta).
- Le pixel charge avant le SDK FemiGlow et émet son propre eventID.

### Procédure

1. Activer le mode **debug** : `localStorage.fg_debug = '1'` côté
   navigateur.
2. Dans la console : `window.femiglowDataLayer.lastEventIds` retourne
   un Map des 100 derniers events_id émis par event name.
3. Comparer avec **Meta Events Manager → Test Events** : les
   `event_id` doivent matcher exactement entre Pixel et CAPI.
4. Si divergence : vérifier que le pixel utilise bien notre wrapper
   `fbq('track', name, params, { eventID })`. Le code custom ne
   doit **jamais** appeler `fbq` directement.

### Reset complet

Si la corruption est généralisée (> 20% mismatch), purger le cache
LRU client et serveur :

```bash
# Serveur (Redis ou in-memory)
curl -X POST https://femiglow.com/api/admin/tracking/dedup/flush \
  -H "Cookie: admin_session=..."

# Client : push un event de revalidation, le SDK reset son LRU
```

---

## 7. Rotation des secrets providers

Tous les access_tokens et secrets doivent être rotés tous les 90 jours
(règle interne) ou immédiatement en cas de fuite.

### Meta

1. Business Manager → Paramètres système → **Générer un token**.
2. Scopes : `ads_management`, `business_management`.
3. Copier le token.
4. **/admin/tracking/providers/meta** → **Modifier** → coller dans
   `access_token` → **Tester** → **Enregistrer**.
5. Ancien token révoqué automatiquement par Meta dans les 60s
   (purge sécurité).

### TikTok

1. Events Manager → Paramètres → **Generate access token**.
2. Console FemiGlow : même procédure.
3. Garder l'ancien actif **24h** pour drain les retries en cours
   (TikTok ne purge pas immédiatement).

### Google

`api_secret` géré dans Admin GA4 → Data Streams → Measurement
Protocol API secrets → **Create**. Coller dans la console.

### Snap (OAuth2)

Snap utilise OAuth2 avec refresh_token. Si le refresh_token expire
(rare, > 1 an d'inactivité) :

```bash
pnpm tsx scripts/snap-oauth-renew.ts
```

Le script ouvre le navigateur sur l'URL Snap d'autorisation, capture
le code retour, échange contre un nouveau refresh_token, met à jour
la config provider en DB.

### Pinterest

`access_token` valide 1 an. Renouveler via Pinterest Developer
Portal → My apps → **Generate token** → mêmes étapes.

> **Audit** : chaque rotation génère un audit
> `provider_credentials_rotated` avec `rotated_by`, `rotated_at`.

---

## 8. Purge manuelle de la rétention

La purge automatique tourne tous les jours à 03:00 UTC (cron
Vercel). Pour forcer :

```bash
pnpm tsx scripts/tracking-purge.ts --older-than 13months --dry-run
```

Inspecter le compteur. Puis sans `--dry-run` :

```bash
pnpm tsx scripts/tracking-purge.ts --older-than 13months --confirm
```

Ce qui est purgé :
- `tracking_events_log` > 13 mois
- `tracking_consent_snapshots` > 24 mois (rétention preuves RGPD)
- `tracking_audit` jamais (rétention indéfinie pour compliance)

Tables agrégées (`tracking_events_daily`, etc.) conservées sans
limite (elles ne contiennent pas de PII).

---

## 9. Resynchroniser l'inventaire (drift composants)

Symptôme : `/admin/tracking/inventory` affiche un badge **3
composants non scannés** ou des composants supprimés du code mais
encore en DB.

Le scan tourne automatiquement à chaque déploiement (hook
`postbuild`). Pour le déclencher manuellement :

```bash
pnpm tsx scripts/tracking-scan.ts
```

Le scan :
1. parse `app/` et `components/` (AST TypeScript),
2. extrait JSDoc `@tracking-category` / `@tracking-events`,
3. catégorise par heuristique (suffixes Hero/Card/Form/...),
4. diff vs `tracking_components` en DB,
5. propose un patch (création / suppression / mise à jour).

Le diff est affiché dans `/admin/tracking/inventory/diff`. La
fondatrice valide ou rejette chaque ligne.

> **Important** : ne jamais éditer `tracking_components` à la main
> en SQL. Toute modification DB doit passer par le scan + diff
> validé pour conserver l'audit.

---

## 10. Gérer un incident provider (CAPI down)

Symptôme : alerte Vercel Logs + Slack `#tracking-alerts` :
`Meta CAPI 5xx rate > 5% on 5min window`.

### Étape 1 — confirmer l'incident

Vérifier le statut Meta : https://developers.facebook.com/status/dashboard/

### Étape 2 — basculer en mode dégradé

`/admin/tracking/providers/meta` → bouton **Pause CAPI** :
- arrête le dispatcher serveur,
- conserve le pixel client actif (best-effort sans dedup),
- les events sont **mis en queue** dans `tracking_events_log` avec
  `dispatch_status='deferred'`.

### Étape 3 — surveillance

```bash
watch -n 30 "psql \$DATABASE_URL -c \"
  SELECT count(*) FROM tracking_events_log
  WHERE dispatch_status = 'deferred'
    AND providers_dispatch->'meta' IS NULL;
\""
```

### Étape 4 — replay après résolution

Quand Meta est rétabli :

```bash
pnpm tsx scripts/tracking-replay.ts --provider meta --since 1h
```

Le script :
1. lit les events deferred,
2. les dispatche en batch (max 1000/req, respect rate-limit Meta),
3. update `dispatch_status='success'`.

> **Cap** : ne jamais replay > 24h en arrière (Meta rejette les
> events trop anciens). Au-delà, accepter la perte et noter dans
> le post-mortem.

---

## 11. Activer / désactiver le mode test (Meta Test Events)

Pour valider une nouvelle implémentation avant production :

1. Meta Events Manager → **Test Events** → noter le `test_event_code`
   (ex. `TEST12345`).
2. `/admin/tracking/providers/meta` → champ **Test event code** →
   coller `TEST12345`.
3. Sauver.
4. Naviguer sur le site : tous les events apparaissent dans **Test
   Events** en temps réel (≤ 5s).
5. **Important** : retirer le `test_event_code` après validation,
   sinon les events de production sont marqués test (= ignorés
   pour l'optimisation des campagnes).

Idem TikTok (`test_event_code`), Google (`debug_mode: true`),
Snap (`debug_mode: true`).

---

## 12. Investiguer une perte de signal global

Symptôme : KPI dashboard `/admin/tracking` affiche **0 events / heure**
alors que le trafic est nominal.

### Checklist (dans l'ordre)

1. **Vercel Logs** : erreurs 5xx sur `/api/track` ?
2. **Postgres** : `SELECT count(*) FROM tracking_events_log WHERE received_at > now() - interval '15 min';` → si 0, le problème est en amont.
3. **Browser console** : ouvrir le site en navigation privée, vérifier qu'un event `page_view` apparaît dans Network → `/api/track`. Si non :
   - Adblocker actif côté tester ? (uBlock bloque `/api/track` car le path contient `track`).
   - CSP bloque le SDK ? (regarder console errors).
   - `<TrackingProvider>` n'est-il pas monté ? (provider crash silencieux).
4. **Consent** : si `consent.analytics_storage='denied'` globalement (ex. bug DOM bannière), aucun event n'est envoyé. Vérifier `localStorage.fg_consent`.
5. **Rate-limit** : un bot a-t-il saturé le rate-limiter Redis ? `SCAN 0 MATCH ratelimit:track:*`.

### Mode panic — bypass admin

Si rien ne fonctionne et que la commande client urge, activer le
mode **legacy GTM** :

```bash
curl -X POST https://femiglow.com/api/admin/tracking/legacy-mode \
  -H "Cookie: admin_session=..." \
  -d '{"enabled": true}'
```

Le mode legacy charge GTM (`window.dataLayer`) en parallèle du SDK,
permettant aux pixels existants côté GTM de continuer à émettre.
À utiliser **uniquement en urgence** (perte de granularité, dedup
client/serveur cassée).

---

## 13. Migrer vers une nouvelle version du datalayer

Lors d'un bump `schema_version` (ex. v1 → v2), la procédure :

1. Déployer le SDK v2 avec **dual-write** : push sur
   `femiglowDataLayer` (v2) **et** `dataLayer` legacy (v1).
2. Configurer le validateur API pour accepter les deux schémas
   pendant 7 jours.
3. Surveiller `tracking_events_log.schema_version` répartition.
4. Quand v1 < 1% : retirer le dual-write côté SDK.
5. Bumper le minimum requis dans `validator.ts` à v2.
6. Purger les agrégations v1 (optionnel).

Ne **jamais** breaker le schéma sans dual-write : les utilisateurs
avec un bundle en cache (durée jusqu'à 24h sur Vercel CDN)
émettraient en v1 et seraient rejetés.

---

## 14. Vérifier la santé du module (healthcheck)

Endpoint public :

```bash
curl https://femiglow.com/api/track/health
```

Retourne :

```json
{
  "status": "ok",
  "ingestion": { "p95_ms": 38, "errors_5min": 0 },
  "dispatchers": {
    "meta": { "status": "ok", "lag_s": 1.2, "match_rate_24h": 0.962 },
    "google": { "status": "ok", "lag_s": 0.8 },
    "tiktok": { "status": "degraded", "lag_s": 14.5, "errors_1h": 23 },
    "snap": { "status": "ok", "lag_s": 2.1 },
    "pinterest": { "status": "paused" }
  },
  "queue_depth": 12,
  "consent_snapshots_24h": 8421
}
```

Connecter à Better Uptime ou équivalent pour alerting :
- alerte si `ingestion.errors_5min > 50`,
- alerte si n'importe quel dispatcher passe `degraded` > 15min,
- alerte si `queue_depth > 1000`.

---

## 15. Procédures de support N1 (fondatrice)

Réponses prêtes à utiliser pour les questions courantes.

### "Pourquoi mes ventes Meta ne remontent pas ?"

1. Vérifier `/admin/tracking → Providers → Meta → Match rate 7j`.
   Doit être ≥ 95%. Sinon : §5 + §6.
2. Vérifier `/admin/tracking → Logs → filtre event=purchase` : les
   events sont-ils en `success` côté Meta ?
3. Si oui mais Meta ne montre rien : délai Meta jusqu'à 24h.
   Patienter.

### "Le pixel TikTok est-il bien actif ?"

1. Naviguer sur le site avec l'extension Chrome **TikTok Pixel
   Helper**.
2. Doit afficher 🟢 + ID pixel + events détectés.

### "Comment savoir si on est conforme RGPD ?"

1. `/admin/tracking → Consent → Audit RGPD` génère un PDF avec :
   - Liste des trackers actifs et leur catégorie consent.
   - Échantillon de 100 events vérifiant `consent.ad_storage` matche.
   - Liste des providers et leurs DPA signés.

### "Combien on dépense en data tracking ?"

1. `/admin/tracking → Settings → Coûts` affiche :
   - Vercel function invocations `/api/track` × prix unitaire,
   - Postgres storage `tracking_*`,
   - Bande passante CDN (scripts pixels).

---

## 16. Post-mortem template

Après tout incident `severity ≥ medium`, rédiger un post-mortem
dans `docs/incidents/YYYY-MM-DD-tracking-<short>.md` :

```md
# Post-mortem : <titre>

## Résumé
- **Date** : 2026-MM-DD HH:MM UTC
- **Durée** : XX min
- **Impact** : NN events perdus / NN€ attribution manquée

## Timeline
- HH:MM : début incident (signal qui a alerté)
- HH:MM : détection
- HH:MM : mitigation (action prise)
- HH:MM : résolution

## Cause racine
<analyse>

## Ce qui a marché
- ...

## Ce qui a manqué
- ...

## Actions correctives
- [ ] TRK-XXX : <action>
- [ ] ...
```

Lier le post-mortem dans le ticket `TRK-099+` créé pour le suivi.

---

## 17. Commandes de référence rapide

```bash
# Inventaire / scan
pnpm tsx scripts/tracking-scan.ts                      # rescanner composants
pnpm tsx scripts/tracking-scan.ts --diff-only          # afficher diff sans appliquer

# Audits
pnpm tsx scripts/tracking-dedup-audit.ts --provider meta --since 7d
pnpm tsx scripts/tracking-export-user.ts --anonymous-id aid_XXXX --out file.json

# Purge / replay
pnpm tsx scripts/tracking-purge.ts --older-than 13months --dry-run
pnpm tsx scripts/tracking-replay.ts --provider meta --since 1h

# Tests
pnpm test tracking                                     # suite Vitest
pnpm test:e2e --grep tracking                          # Playwright tracking
pnpm tsx scripts/tracking-bundle-budget.ts             # vérifier ≤ 8KB gzip

# Healthchecks
curl https://femiglow.com/api/track/health
curl -X POST https://femiglow.com/api/admin/tracking/revalidate \
  -H "Cookie: admin_session=..."

# Snap OAuth
pnpm tsx scripts/snap-oauth-renew.ts
```

---

## 18. Contacts & escalades

| Sujet | Responsable | Délai |
|---|---|---|
| Incident ingestion (5xx > 5%) | Astreinte tech | 15 min |
| Match rate Meta < 90% | Marketing + tech | 24h |
| Demande RGPD utilisateur | Fondatrice | 30 jours |
| Rotation secrets expirée | Tech | 7 jours avant |
| Nouveau pixel à intégrer | Marketing → tech | brief 48h |

Channels :
- Slack `#tracking-alerts` (alerting auto, 24/7)
- Slack `#tracking-ops` (opérations courantes)
- Email `dpo@femiglow.com` (RGPD uniquement)

---

Le runbook est un document **vivant** : chaque incident résolu
ajoute une procédure ou met à jour une section existante.
Maintenu par la fondatrice avec relecture trimestrielle.
