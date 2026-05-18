# 06 — Tracking, attribution & conversion

> **Vue d'ensemble** : sans doute *le* domaine le plus mature du repo. Tracking server-side complet (CAPI Meta v2.15 + Snap v3 + GTM côté serveur via API), client-side conforme Consent Mode v2, attribution multi-touch, plans tracking versionnés en base, anti-doublons via `eventId`. 48 commits sur les 30 derniers jours, 3 audits dédiés, 21 docs `docs/gtm/` + 14 docs `docs/tracking/` + 9 docs `docs/tracking-attribution/`.

---

## 1. Stack tracking

| Couche | Technologie | Localisation |
|---|---|---|
| Côté client (GTM tags) | GTM Web Container (Consent Mode v2) | `components/tracking/GtmHeadScript.tsx` |
| Côté client (pixels) | Snap Pixel, Meta Pixel | `components/tracking/PixelLoader.tsx`, `SnapPixelEvents.tsx` |
| Côté serveur (CAPI Meta) | Meta Conversions API v2.15 | `src/lib/tracking/providers/meta.ts` |
| Côté serveur (Snap CAPI) | Snap Conversions API v3 | `src/lib/tracking/providers/snap.ts` |
| Côté serveur (GTM SS) | GTM server-side via API | `src/lib/tracking/mappings/gtm-export.ts` |
| Routage interne | `/api/track` | validations Zod, dedup, dispatch providers |
| Consent | Consent Mode v2 Google + bandeau maison | `components/tracking/ConsentBanner.tsx` |
| Attribution | UTM + fbp/fbc/gclid/ttclid/sccid stockés | `lib/tracking/attribution/` |
| Plans tracking | versionnés en base + export GTM | `lib/tracking/plan/` + `schema-tracking-plan.ts` |

---

## 2. Architecture des événements

### 2.1 Catalogue centralisé

`lib/tracking/event-catalog.ts` (~35 k LOC selon audit backend) :
- Liste exhaustive des events canoniques (`page_view`, `view_content`, `add_to_cart`, `begin_checkout`, `purchase`, `lead`, ...).
- Mapping → providers (Meta, Snap, GA4, GTM).
- Validation Zod par event.

### 2.2 Plans tracking versionnés

`docs/event-mappings/` (3 docs) :
- `EVENT_MAPPINGS_CONCEPTUAL_ANALYSIS.md`
- `EVENT_MAPPINGS_IMPLEMENTATION_STATUS.md`
- `README.md`

Schema `schema-tracking-plan.ts` permet de stocker en base les plans (env profiles, mappings, variantes A/B). Admin UI : `components/admin/tracking/plans/wizard/` (4 fichiers > 400 LOC).

### 2.3 Dispatch flow

```
Front: emit('begin_checkout', { ... })
  ↓
/api/track POST
  ↓
Validation Zod (event + payload)
  ↓
dedup via eventId (UNIQUE)
  ↓
fan-out parallèle:
  ├─ Meta CAPI v2.15  (lib/tracking/providers/meta.ts)
  ├─ Snap CAPI v3     (lib/tracking/providers/snap.ts)
  ├─ GTM SS API       (lib/tracking/mappings/gtm-export.ts)
  └─ User event log   (user_event table, source='server')
```

---

## 3. Consent Mode v2

### 3.1 Bandeau

`ConsentBanner.tsx` :
- Default `denied` (RGPD-first).
- Categories : `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`, `functional_storage`.
- Bouton "Accepter tout" / "Refuser tout" / "Personnaliser".
- Persistance : `localStorage` + cookie (1 an).
- Event `fg:consent-changed` dispatché → propagation à GTM, fbq, ttq, snaptr.

### 3.2 GtmHeadScript (consent default avant container)

```tsx
gtag('consent', 'default', {
  'analytics_storage': defaultGranted ? 'granted' : 'denied',
  'ad_storage': defaultGranted ? 'granted' : 'denied',
  'ad_user_data': defaultGranted ? 'granted' : 'denied',
});
gtag('js', new Date());
gtag('config', 'G-XXXXX');
```

Chargé `strategy="beforeInteractive"` AVANT le container GTM → conforme spec Google 2024.

### 3.3 PixelLoader

Charge les pixels tier-3 (Snap, GTM custom) uniquement si consent donné :
```ts
if (!hasGivenConsent(consent)) return;
const snippets = await fetch('/api/track/pixels');
whenIdle(() => { for (const s of snippets) injectSnippet(s); });
```
- `requestIdleCallback` → ne bloque pas le first paint.
- `Set<string>` dédup → pas de double injection.
- Unsubscribe `fg:consent-changed` au cleanup.

---

## 4. CAPI Meta (v2.15)

Audit récent (commits `163fb5e`, `9f8c9e2`, `d70cac7`) :
- Payload aligné `action_source`, `event_source_url`, `user_data` (hashing systématique email/phone via SHA-256), `custom_data`.
- Double PAGE_VIEW corrigé.
- Event mappings corrigés.
- Tests : `meta-capi-adapter.test.ts` (13 tests).

### Points de vigilance résiduels
- Event Match Quality (EMQ) côté Meta : à monitorer dans Ads Manager. Inclure `fbp`, `fbc`, `external_id` (lead_id hashé), `client_ip_address`, `client_user_agent` pour maximiser.
- Test Events : actif côté admin (cf. `docs/gtm/` et `snap-pixel-test-plan.md`).

---

## 5. CAPI Snap (v3)

Évolution intense ces derniers jours (10+ commits) :
- `030525f` feat : intégration Snapchat end-to-end.
- `af47924` feat : test suite Snap pixel.
- `9f8c9e2` fix : `action_source`, double PAGE_VIEW.
- `7595103` feat : client-side Snap pixel events + consent handling.
- `b110129` fix : `snapEventMode = 'capi_only'` par défaut (évite double events).
- `497a1c7` fix : race condition pixel ID (poll).
- `2ce33f0` fix : alignement client + CAPI exact v3 spec.
- `163fb5e` fix : `gtm.uniqueEventId` rejection.

**Test plan** : `docs/snap-pixel-test-plan.md` (162 lignes) — pixel ID `9bd26a82...` (live), 10 events mappés, MSW + script live + Ads Manager verification.

### Lacunes identifiées dans le test plan
- `lead_capture` non mappé Snap.
- `contact_submit` non mappé.
- `newsletter_submit` non mappé.
→ À ajouter en P2.

---

## 6. GTM Web + Server-side

### 6.1 Web (Consent Mode v2)
`GtmHeadScript.tsx` (cf. §3.2).

### 6.2 Server-side
`lib/tracking/mappings/gtm-export.ts` — export config GTM via API depuis les plans tracking en base. Permet de re-déployer un container GTM cohérent avec le code.

### 6.3 Anti-erreur (poka-yoke)
`docs/gtm-poka-yoke/` (2 docs) — détection de dérive entre container GTM publié et plan en base. Excellent.

### 6.4 Documentation
21 docs `docs/gtm/` (audit → architecture → variables → triggers → tags → consent → tests → runbook + CHANGELOG). Le plus complet du dossier.

---

## 7. Attribution

`docs/tracking-attribution/` (9 docs) :
- `00-audit.md` → `08-runbook.md`.
- Modèles : first-touch, last-touch, multi-touch (linéaire, time-decay).

Stockage côté front (cookie 90 j) :
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.
- `fbp`, `fbc` (Meta), `gclid` (Google Ads), `ttclid` (TikTok), `sccid` (Snap).
- Premier touche / dernier touche.

Côté serveur, ces valeurs sont incluses dans les events CAPI pour améliorer EMQ.

---

## 8. Dédup & idempotence events

- Chaque event a un `eventId` (UUID client).
- Côté serveur, dédup via `UNIQUE` sur `(eventId, provider)`.
- Permet de relancer un envoi CAPI sans doubler côté Meta/Snap.

---

## 9. Tests

| Type | Fichiers | Description |
|---|---|---|
| Unitaires CAPI Meta | `meta-capi-adapter.test.ts` | 13 tests |
| Unitaires Snap | `snap-pixel-test-plan.md` + tests serveur | MSW + live script |
| Plan exporter | `exporter.test.ts` | 17 modifs récentes |
| Cross-provider | `advanced test suite` (commit `3f00622`) | dedup, cross-provider, client snippets, Snap CAPI v3 |
| Attribution | `client.attribution.test.ts` | typing snapshot |

---

## 10. Bugs récents corrigés (4 dernières semaines)

| Commit | Bug | Correction |
|---|---|---|
| `497a1c7` | Snap pixel ID race condition | poll for pixel ID availability |
| `b110129` | Double Snap events | `snapEventMode = 'capi_only'` par défaut |
| `163fb5e` | `gtm.uniqueEventId` rejection /api/track | autoriser dans schema |
| `9f8c9e2` | `action_source` Snap incorrect + double PAGE_VIEW | aligner spec v3 |
| `8e16906` | Doublons d'events | Enhanced Conversions UI control |
| `ba79245` | 3 bugs prod découverts via analyse Tag Assistant | divers fixes |
| `1c13568` | googleads.g.doubleclick.net bloqué CSP | autoriser + doc hits différés |
| `a73a7d2` | pagead2.googlesyndication.com bloqué CSP | autoriser conversions Google Ads |

→ Maturité forte, mais aussi rythme de modifications très élevé sur ce domaine. Vigilance régression.

---

## 11. Forces tracking

1. **Stack server-side + client-side cohérente** (dual path avec dedup).
2. **Consent Mode v2** dès l'init, default denied.
3. **CAPI Meta v2.15 + Snap v3** alignés sur spec officielle.
4. **Attribution multi-touch** stockée et propagée.
5. **Plans tracking versionnés en base** + admin UI.
6. **Poka-yoke GTM** : détection de drift container ↔ plan.
7. **Tests avancés** : 13 tests Meta, suite avancée cross-provider.
8. **Documentation exhaustive** : 21 + 14 + 9 docs dédiés.
9. **Crawlers IA bloqués** dans `robots.txt` (GPTBot, CCBot, ClaudeBot).
10. **`/api/track` validation Zod + dedup + rate-limit-friendly**.

---

## 12. Faiblesses tracking

| # | Constat | Sévérité |
|---|---|---|
| F1 | `lead_capture`, `contact_submit`, `newsletter_submit` non mappés Snap | 🟡 P2 |
| F2 | Pas de rate-limit sur `/api/track` (events spam possible) | 🟡 P2 |
| F3 | Rythme de fixes Snap (8 commits en 7 jours) → risque de régression | 🟠 P1 |
| F4 | Pas de monitoring EMQ Meta automatisé (dépend du dashboard Ads Manager) | 🟡 P2 |
| F5 | Pas de TikTok CAPI (visible nulle part) | 🟢 P3 |
| F6 | `event_catalog.ts` ~35 k LOC → gros fichier difficile à reviewer | 🟡 P2 |
| F7 | Pas de A/B test framework dédié (les variants existent mais le pilotage est manuel) | 🟢 P3 |

---

## 13. Recommandations

### P1
1. **Geler une release tracking** : créer un tag `tracking-stable-2026-05-18`, freeze pendant 2 semaines, observer EMQ Meta + Snap. Si stable, branche `tracking-2026-Q2` pour les évolutions suivantes.
2. **Smoke test post-deploy** : Playwright e2e qui visite `/`, ajoute au panier, va au checkout, et vérifie via Network tab que `meta_capi_purchase`, `snap_capi_purchase`, `gtm_purchase` sont bien émis.
3. **Monitorer EMQ Meta** : script weekly qui scrape l'Events Manager (ou API si dispo) et alerte si EMQ < 7/10.

### P2
4. **Mapper `lead_capture`, `contact_submit`, `newsletter_submit` côté Snap**.
5. **Rate-limit `/api/track`** : `{ max: 100, window: '1m', key: ip }`.
6. **Découper `event-catalog.ts`** par domaine (commerce, content, lead, admin).

### P3
7. **TikTok CAPI** si campagne TikTok prévue.
8. **A/B test framework** (GrowthBook ou maison) si campagnes multi-variants.

---

## 14. Scorecard tracking

| Critère | Score |
|---|---|
| Consent (RGPD) | 9 / 10 |
| CAPI Meta | 9 / 10 |
| CAPI Snap | 8 / 10 (régressions récentes corrigées) |
| GTM | 9 / 10 |
| Attribution | 8 / 10 |
| Dédup events | 9 / 10 |
| Tests | 8 / 10 |
| Documentation | 10 / 10 |
| Couverture vendors | 8 / 10 (manque TikTok) |
| Stabilité (rythme régression) | 6 / 10 |
| **Global** | **8,4 / 10** |
