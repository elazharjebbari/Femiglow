# 00.3 — Critères de succès

> Conditions mesurables pour considérer le chantier comme « terminé ».

## Chantier 1 — Pipeline conversion

### Critères fonctionnels

- [ ] **C1.F.1** — Un `purchase` envoyé via `/api/track` est reçu par Google
      Ads (vérifié dans l'interface Google Ads → Conversions → 24h).
- [ ] **C1.F.2** — Le même `purchase` envoyé via gtag.js client ET via /api/track
      est compté **une seule fois** dans Google Ads (déduplication par
      `event_id`).
- [ ] **C1.F.3** — Si `gtag.js` est bloqué (test avec uBlock), le `purchase`
      reste comptabilisé par Google Ads (via CAPI serveur).
- [ ] **C1.F.4** — `form_start` fire au premier focus d'un champ du wizard
      sur `/kit` ET `/commander`. Visible dans Tag Assistant.
- [ ] **C1.F.5** — `begin_checkout` ne fire PLUS au mount de `/commander`.
      Vérifié en chargeant `/commander` sans interaction : aucun
      `begin_checkout` n'est émis.
- [ ] **C1.F.6** — `lead_capture` apparaît avec `is_conversion: true` dans
      `tracking_events_log` (fix du bug `CONVERSION_EVENTS`).

### Critères techniques

- [ ] **C1.T.1** — `googleAdsAdapter.dispatch()` retourne `success` avec une
      latence P95 < 800ms.
- [ ] **C1.T.2** — Échecs CAPI Google Ads journalisés dans
      `tracking_events_log.providers_results` avec code d'erreur explicite.
- [ ] **C1.T.3** — Retry exponentiel 3 tentatives en cas d'échec transient
      (429, 5xx, network).
- [ ] **C1.T.4** — Refresh token Google Ads chiffré en DB (AES-GCM, IV et tag
      stockés en colonnes séparées).

### Critères qualité

- [ ] **C1.Q.1** — Coverage Jest > 85% sur `lib/tracking/providers/google-ads.ts`.
- [ ] **C1.Q.2** — Test e2e Playwright : checkout complet sur `/kit` →
      vérification que les 5 providers ont dispatch success.

---

## Chantier 2 — GTM Editor UX

### Critères fonctionnels

- [ ] **C2.F.1** — Bouton "Importer depuis Providers" présent sur le form
      GTM. Au clic, les champs sont pré-remplis depuis `tracking_providers`.
- [ ] **C2.F.2** — Indicateur visuel (✅ / ⚠) à côté de chaque champ pixel
      indique si la valeur correspond à celle du Provider.
- [ ] **C2.F.3** — Bouton "Modifier" sur chaque version dans la liste ouvre
      le form pré-rempli avec les valeurs de cette version.
- [ ] **C2.F.4** — Sauvegarder une modification crée une **nouvelle version**
      (audit trail préservé). L'ancienne reste accessible.
- [ ] **C2.F.5** — Récap diff visible avant sauvegarde (changements
      détectés par env).

### Critères techniques

- [ ] **C2.T.1** — Route `GET /api/admin/tracking/providers/snapshot`
      implémentée. Retourne un objet typé `ProvidersSnapshot`.
- [ ] **C2.T.2** — Méthode `gtmConfigStore.clone(versionId, newName)`
      implémentée. Idempotente.
- [ ] **C2.T.3** — `GtmConfigForm` accepte un prop `seedFrom: 'providers' | 'version' | 'template' | 'empty'`.

### Critères UX

- [ ] **C2.UX.1** — Temps de remplissage d'une nouvelle version GTM < 5min
      (vs ~30min avant).
- [ ] **C2.UX.2** — Form navigable au clavier complet (Tab + Enter).
- [ ] **C2.UX.3** — Axe-core : 0 violation critique / serious.

---

## Chantier 3 — Catégorisation conversions

### Critères fonctionnels

- [ ] **C3.F.1** — Page `/admin/tracking/events/categorization` affiche tous
      les events `isConversion: true` avec leur catégorie Google Ads (default
      ou override).
- [ ] **C3.F.2** — Dropdown éditable par event : `Purchase | Lead | Contact | Signup | View Content | None`.
- [ ] **C3.F.3** — Sauvegarder un override persiste dans
      `tracking_event_overrides`.
- [ ] **C3.F.4** — Bouton "Reset au default" remet la catégorie depuis le
      catalogue.

### Critères techniques

- [ ] **C3.T.1** — Migration DB : table `tracking_event_overrides` créée
      avec FK `event_name → tracking_event_definitions.name`.
- [ ] **C3.T.2** — Fonction `resolveEventCategory(eventName)` qui lit
      override puis fallback catalogue. Coverage Jest 100%.
- [ ] **C3.T.3** — `googleAdsAdapter.dispatch()` utilise
      `resolveEventCategory()` pour choisir le Conversion Action Label.

---

## Chantier 4 — Observabilité

### Critères fonctionnels

- [ ] **C4.F.1** — Page `/admin/tracking/analytics/providers` affiche par
      provider : Total events 7j, Success rate, Latency P50/P95, Errors 24h.
- [ ] **C4.F.2** — Chart "Conversions par jour" (7 derniers jours)
      visible.
- [ ] **C4.F.3** — Drill-down : clic sur un provider → liste des derniers
      events échoués avec error code.

### Critères techniques

- [ ] **C4.T.1** — Aggregation SQL via `tracking_events_log` directement
      (pas de table dérivée).
- [ ] **C4.T.2** — Refresh auto toutes les 30s (revalidate via SWR).
- [ ] **C4.T.3** — `Consent Mode v2` : `gtag('consent','update')` propagé
      à TOUS les tags loaded (vérifié sur GA4 + Google Ads + GTM).

### Critères UX

- [ ] **C4.UX.1** — Dashboards lisibles sur mobile (responsive).
- [ ] **C4.UX.2** — Indicateur de statut clair : ✅ / ⚠ / ❌ par provider.

---

## Critères globaux (toutes phases)

### Performance

- [ ] **G.P.1** — `/api/track` p95 < 200ms (incluant dispatch CAPI parallèle).
- [ ] **G.P.2** — Aucune régression performance sur `/kit` (LCP, FID).

### Sécurité

- [ ] **G.S.1** — Tokens (CAPI, OAuth) chiffrés au repos.
- [ ] **G.S.2** — Rate-limit anti-flood sur `/api/track` (10 events/sec/user).
- [ ] **G.S.3** — Audit log pour toute modification de pixel/conversion config.

### Tests

- [ ] **G.T.1** — Coverage globale Jest > 80%.
- [ ] **G.T.2** — Tous les Playwright e2e verts.
- [ ] **G.T.3** — **Test ultime pipeline** : un parcours `/kit` → form_start
      → lead_capture → address → purchase → vérif 5 providers dispatched OK
      via MSW + Playwright.

### Documentation

- [ ] **G.D.1** — Chaque ADR a son markdown.
- [ ] **G.D.2** — Runbook de déploiement validé manuellement.
