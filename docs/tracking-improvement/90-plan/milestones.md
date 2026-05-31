# 90.3 — Milestones

## M1 — Quick wins (J+2)

Livraison la plus rapide. Inclut tous les fixes triviaux qui ne nécessitent
pas de migration DB importante.

- ✅ Fix bug `CONVERSION_EVENTS` Set (`lead_capture` ajouté)
- ✅ Event `form_start` ajouté au catalogue
- ✅ Mapping Meta de `begin_checkout` révisé en CustomEvent
- ✅ Hook `useFormStartTracking` opérationnel
- ✅ `form_start` fire au premier focus sur /kit et /commander

**Validation** : test Playwright `tracking-form-start.spec.ts` vert.

## M2 — Server CAPI complet (J+7)

Cœur du chantier 1 : Google Ads server-side.

- ✅ Migrations DB appliquées (0028-0031)
- ✅ `googleAdsAdapter.dispatch()` opérationnel
- ✅ OAuth refresh token chiffré + cache
- ✅ Enhanced Conversions (user_data hash) implémenté
- ✅ gclid capture en middleware
- ✅ event_id propagé client → serveur → Google
- ✅ Retry strategy fonctionnelle (429, 401, timeout)

**Validation** : test event manuel via `/admin/tracking/test-event` →
reçu dans Google Ads UI sous 1h.

## M3 — Admin UX (J+10)

Chantier 2 + 3 livrés.

- ✅ Route `GET /api/admin/tracking/providers/snapshot` opérationnelle
- ✅ Pré-remplissage GTM ← Providers fonctionne
- ✅ Wizard édition de version (clone + diff)
- ✅ Page `/admin/tracking/events/categorization` opérationnelle
- ✅ Override de catégorie persiste en DB

**Validation** : tests Playwright `admin-gtm-*.spec.ts` verts.

## M4 — Observability (J+12)

Chantier 4.

- ✅ Page `/admin/tracking/analytics/providers` rendue
- ✅ ConversionsChart fonctionnel (7j)
- ✅ Refresh auto 30s opérationnel
- ✅ Consent Mode v2 propagation fixée

**Validation** : dashboard manuel test, axe-core 0 critical.

## M5 — Tests complets + déploiement (J+14)

- ✅ Coverage Jest > 80% sur tous les modules tracking
- ✅ Tous les e2e Playwright verts (10+ scenarios)
- ✅ **Test ultime pipeline validation vert**
- ✅ Smoke tests post-deploy passent
- ✅ Documentation finalisée
- ✅ Déploiement prod réussi

**Validation** : staging déployé J+13, prod J+14 avec monitoring intensif J+14 → J+21.

## Récapitulatif

| Milestone | Date cible | Effort cumulé | Critique pour business |
|---|---|---|---|
| M1 | J+2 | 9h | ⭐⭐ Fix conversion tracking immédiat |
| M2 | J+7 | 26h | ⭐⭐⭐⭐⭐ Google Ads CAPI opérationnel |
| M3 | J+10 | 47h | ⭐⭐⭐ Admin UX nettement améliorée |
| M4 | J+12 | 56h | ⭐⭐ Visibilité ROI tracking |
| M5 | J+14 | 80h | ⭐⭐⭐⭐⭐ Pipeline validée en prod |

## Critères Go/No-Go par milestone

À chaque milestone, point de revue :
- ✅ Tests verts ?
- ✅ Code review approuvée ?
- ✅ Documentation à jour ?
- ✅ Stakeholders alignés ?

Si NO → ne pas avancer à la milestone suivante.
