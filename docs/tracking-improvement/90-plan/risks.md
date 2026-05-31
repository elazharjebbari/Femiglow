# 90.4 — Risques + mitigations

## Risques projet

### R1 — OAuth Google Ads bloquant

**Probabilité** : Élevée
**Impact** : Élevé
**Description** : L'obtention du refresh token Google Ads nécessite des
permissions admin sur le compte Google Ads. Si Marketing tarde à fournir
les accès, M2 est retardée.

**Mitigation** :
1. Démarrer la procédure OAuth **avant** M1 (en parallèle de M0)
2. Avoir un environnement Google Ads test pré-configuré
3. Backup plan : développer avec Customer ID test → migrer en prod après

**Indicateurs** :
- Customer ID disponible : J-1
- Refresh token obtenu : J+2

### R2 — Régression checkout

**Probabilité** : Moyenne
**Impact** : Élevé
**Description** : Modifier les mappings d'events sur le wizard de checkout
peut casser le funnel.

**Mitigation** :
1. Feature flag par event (`feature_form_start_enabled`)
2. Tests e2e Playwright COMPLET avant chaque déploiement
3. Déployer en staging d'abord (7j minimum d'observation)
4. Rollback procedure documentée et testée

**Indicateurs** :
- Pas de drop conversion rate > 5% en staging
- Tests e2e verts sur 3 itérations consécutives

### R3 — Migration DB invalide

**Probabilité** : Faible
**Impact** : Élevé
**Description** : Une migration mal écrite peut corrompre `tracking_event_overrides`
ou rendre `tracking_providers` inaccessible.

**Mitigation** :
1. Backup auto DB avant migration (`pnpm reset` system)
2. Migrations testées en staging d'abord
3. Migrations idempotentes (IF NOT EXISTS partout)
4. Rollback SQL prêt pour chaque migration

**Indicateurs** :
- Migration appliquée en staging sans erreur
- Backup pris avant prod

### R4 — Latence dispatch trop élevée

**Probabilité** : Moyenne
**Impact** : Moyen
**Description** : Si Google Ads CAPI prend > 2s, le batch entier est lent
et peut faire timeout côté client.

**Mitigation** :
1. Timeout 2s par provider (AbortController)
2. Parallélisation des dispatches (Promise.all)
3. Si quota Google Ads atteint, circuit breaker
4. Logs latence pour identifier les goulots

**Indicateurs** :
- /api/track p95 < 200ms en prod
- Google Ads dispatch p95 < 800ms

### R5 — Désync GTM ↔ Providers

**Probabilité** : Élevée
**Impact** : Faible
**Description** : Si l'admin modifie un pixel dans Providers sans re-syncer
sa version GTM active, le tag client peut être désaligné.

**Mitigation** :
1. Indicateur visuel ⚠ sur les champs divergents
2. Bouton "Re-sync depuis Providers" toujours présent
3. Alerte email si divergence > 24h
4. Documentation utilisateur explicite

**Indicateurs** :
- Aucune désync > 7 jours détectée

### R6 — Tag Google Ads bloqué par ad-blocker

**Probabilité** : Élevée
**Impact** : Variable
**Description** : Même avec server CAPI, le tag client `gtag.js` est utile
pour la collecte cookies first-party. Si bloqué, certains identifiers
sont absents côté Google Ads.

**Mitigation** :
1. Le server CAPI fournit Enhanced Conversions (email/phone hash)
   qui matchent même sans cookie
2. Communiquer aux marketers que client + serveur = complémentaires
3. Monitorer le ratio conversions client / serveur en dashboard

**Indicateurs** :
- Ratio client/server stable autour de 70-80%

## Risques techniques

### R7 — Refresh token Google Ads expire

**Probabilité** : Faible
**Impact** : Élevé (conversions perdues jusqu'à manual fix)
**Description** : Si le refresh token est révoqué côté Google ou expire.

**Mitigation** :
1. Monitor erreurs OAuth dans `tracking_events_log`
2. Alert email à admin si > 5 erreurs / heure
3. Re-onboarding wizard one-click pour rafraîchir

### R8 — Quota Google Ads API atteint

**Probabilité** : Très faible (15k/jour, FemiGlow ~100/jour)
**Impact** : Moyen
**Description** : Si pic de trafic ou bug d'envoi en boucle.

**Mitigation** :
1. Rate limit `/api/track` côté serveur (10 req/sec/IP)
2. Circuit breaker si > 30% erreurs 5 min
3. Dashboard quota usage

### R9 — Sécurité — refresh token compromis

**Probabilité** : Très faible
**Impact** : Critique (attaquant peut envoyer fake conversions)
**Description** : Token chiffré mais clé d'env mal protégée.

**Mitigation** :
1. Token chiffré AES-GCM (déjà standard du projet)
2. IV unique par token, jamais réutilisé
3. Clé de chiffrement uniquement en env var (jamais en git)
4. Rotation manuelle quarterly recommandée

## Risques organisationnels

### R10 — Marketing change Conversion Actions Google Ads

**Probabilité** : Moyenne
**Impact** : Faible (mismatch labels)
**Description** : Si Marketing crée/supprime des Conversion Actions sans
notifier l'équipe technique.

**Mitigation** :
1. Sync mensuel marketing/tech sur conversion actions
2. Test event mensuel pour valider le mapping
3. Page `/admin/tracking/events/categorization` rend visible l'état actuel

### R11 — Disponibilité Tech Lead pour reviews

**Probabilité** : Moyenne
**Impact** : Moyen (délais)
**Description** : Reviews PR peuvent bloquer si Tech Lead absent.

**Mitigation** :
1. Découpage en petits PRs (max 500 LOC chacun)
2. Documentation auto-suffisante (ce dossier)
3. Pair-programming pour les modules critiques (google-ads.ts)

## Plan de mitigation globale

Toutes les semaines :
- Standup avec stakeholders (10 min)
- Review du risques register
- Update du milestone tracker

Toutes les milestones :
- Go/No-Go decision avec PM
- Documentation à jour
- Tests verts confirmés
