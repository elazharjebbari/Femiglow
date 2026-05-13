# 90.5 — Journal des décisions

> Trace les décisions architecturales et leur contexte. À mettre à jour
> à chaque nouvelle décision impactant la pipeline tracking.

## D-001 — Approche Google Ads server-side : dual-track

**Date** : 2026-05-13
**Contexte** : 3 options évaluées (cf. ADR-001)
**Décision** : Dual-track (client gtag + server CAPI) avec dédup via event_id
**Rationale** :
- Standard recommandé par Google et Meta
- Cohabite avec le code existant
- Permet de migrer Google Ads progressivement (Customer ID test puis prod)
- Dédup native côté provider (Google match par event_id/orderId)

**Conséquences** :
- Implémentation `googleAdsAdapter.dispatch()` requise
- event_id UUID v4 généré côté client
- Migration `tracking_events_log` pour ajouter colonne `event_id`

## D-002 — Stratégie pré-remplissage GTM : opt-in via bouton

**Date** : 2026-05-13
**Contexte** : 3 options évaluées (cf. ADR-002)
**Décision** : Pré-remplissage déclenché par l'admin via bouton "Importer depuis Providers"
**Rationale** :
- Préserve la flexibilité d'override par version
- UX intuitive (pattern "Reprendre depuis…" connu)
- Pas de breaking change sur versions existantes
- Diff visuel signale les divergences

**Conséquences** :
- Route `GET /api/admin/tracking/providers/snapshot` à créer
- Composant `SyncIndicator` à créer

## D-003 — Édition de version GTM : toujours clone

**Date** : 2026-05-13
**Contexte** : Choix entre édition in-place vs clone
**Décision** : Édition d'une version = création d'une nouvelle version dérivée (clone)
**Rationale** :
- Audit trail préservé (jamais d'écrasement)
- Rollback facile (l'ancienne version reste accessible)
- Conforme au pattern actuel "version snapshots immutables"

**Conséquences** :
- Méthode `gtmConfigStore.clone(versionId, newName)` à implémenter
- Wizard "Modifier" produit une nouvelle version, ne modifie pas l'originale
- Champ `clonedFrom` ajouté pour tracer l'héritage

## D-004 — form_start vs begin_checkout mapping

**Date** : 2026-05-13
**Contexte** : `begin_checkout` Meta `InitiateCheckout` fire au mount = page view déguisé
**Décision** :
- Nouvel event `form_start` qui fire au premier focus
- `begin_checkout` reste, mais mapping Meta → `CustomEvent:checkout_intent`
- `begin_checkout` fire uniquement sur action explicite (click Continue)
- Mapping GA4 / Google Ads inchangé (events standards)

**Rationale** :
- Évite pollution Meta Lookalike audiences
- Préserve les standards GA4/Google Ads
- Signal `form_start` exploitable séparément (engagement vs intent)

**Conséquences** :
- Event `form_start` ajouté au catalog
- Mapping `begin_checkout` Meta révisé
- Hook `useFormStartTracking` créé
- Tests e2e à mettre à jour

## D-005 — Catégorisation events : hybride code + override DB

**Date** : 2026-05-13
**Contexte** : 3 options (hardcoded, fully editable, hybride)
**Décision** : Default depuis event-catalog (code), override possible via `tracking_event_overrides` (DB)
**Rationale** :
- Sécurité du code par défaut (nouvel event = catégorie sensée)
- Flexibilité marketing pour cas particuliers (sans deploy)
- Default visible dans l'UI (transparence)

**Conséquences** :
- Table `tracking_event_overrides` à créer
- Champ `google_ads_category_default` à ajouter dans `tracking_event_definitions`
- Fonction `resolveEventCategory(eventName)` à créer
- UI `/admin/tracking/events/categorization` à construire

## D-006 — Observabilité : built-in plutôt qu'OTLP/Grafana

**Date** : 2026-05-13
**Contexte** : Échelle actuelle (~100 events/jour) + équipe interne
**Décision** : Dashboards built-in Next.js, pas d'export Grafana en V1
**Rationale** :
- Volume insuffisant pour justifier un setup Prometheus/Grafana
- Built-in cohérent avec l'admin existant
- Évolution possible vers OTLP en V2 si besoin

**Conséquences** :
- Pages `/admin/tracking/analytics/*` à construire
- Pas de dépendance externe pour MVP
- Possibilité d'ajouter export OTLP plus tard

## D-007 — Consent Mode v2 : default_granted=true (banner désactivé)

**Date** : 2026-05-13 (état existant maintenu)
**Contexte** : Configuration actuelle FemiGlow : `consent_banner_enabled=false`, `consent_default_granted=true`
**Décision** : Maintenir cette configuration pour V1
**Rationale** :
- Cohérent avec audit légal (juridiction Maroc, à valider)
- Évite friction utilisateur sur landing
- Possibilité d'activer le banner via DB switch si juridiction change

**Conséquences** :
- Snippets gtag/fbq démarrent en granted (pas de blocage)
- Risque RGPD si visiteur UE (à clarifier avec Marketing/Legal)
- Fix `gtag('consent','update')` propagation à implémenter quand même

## D-008 — Identifiants client : event_id UUID v4

**Date** : 2026-05-13
**Contexte** : Plusieurs choix possibles (UUID, ULID, timestamp+random)
**Décision** : UUID v4 standard (`crypto.randomUUID()` natif browser)
**Rationale** :
- API native (pas de lib externe)
- Compatible avec Meta CAPI (Meta accepte UUID en `event_id`)
- Compatible avec Google Ads (utilisé comme `orderId` pour dedup)
- Lisible dans les logs

**Conséquences** :
- Colonne `tracking_events_log.event_id text` à ajouter
- Tous les snippets clients utilisent `crypto.randomUUID()`
- Compat IE11/old-Safari : pas un problème (admin chrome+ + mobile modern)

## D-009 — Retry strategy : 3 tentatives, exponentiel × 2

**Date** : 2026-05-13
**Contexte** : Compromis fiabilité vs latence
**Décision** : 3 attempts, baseDelay 500ms, exponentiel × 2, jitter ±30%
**Rationale** :
- 3 attempts couvrent les transient failures les plus courants
- Total max delay : 500ms + 1s + 2s = 3.5s ≈ acceptable pour CAPI
- Jitter évite thundering herd

**Conséquences** :
- `lib/tracking/providers/retry.ts` enrichi
- Timeout global par dispatch : 5s (incluant retries)
- Failed events loggés dans `tracking_events_log.providers_results`

## D-010 — Test ultime pipeline : Playwright + mocks sortants

**Date** : 2026-05-13
**Contexte** : Comment valider toute la chaîne sans pollution Google Ads / Meta prod
**Décision** : 1 test Playwright qui mock `/api/track`, `/api/checkout/order`, et capture toutes les interactions
**Rationale** :
- Pas de side effects sur prod Google/Meta
- Test reproducible en CI
- Captures détaillées pour debug

**Conséquences** :
- `e2e/ULTIMATE-pipeline-validation.spec.ts` créé
- À run en CI à chaque PR sur master

## Format pour nouvelles décisions

```
## D-XXX — [Titre court]

**Date** : YYYY-MM-DD
**Contexte** : Pourquoi décider maintenant
**Décision** : Choix retenu (1-2 phrases)
**Rationale** : Pourquoi ce choix
**Conséquences** : Impact sur code / docs / process
```
