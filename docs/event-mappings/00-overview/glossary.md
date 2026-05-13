# 00.2 — Glossary

Vocabulaire partagé pour ce module. Les termes en **gras** sont les
concepts canoniques utilisés dans le code et la doc.

## Concepts métier

| Terme | Définition | Exemple |
|---|---|---|
| **Event canonique** | Nom d'un événement business interne FemiGlow, indépendant des vendors | `purchase`, `form_start`, `lead_capture` |
| **Vendor / Provider** | Plateforme tierce qui reçoit les events (Meta, GA4, Ads, TikTok, Snap, Pinterest, GTM) | Meta = Pixel + CAPI Facebook |
| **Mapping** | Correspondance `event_canonique → nom_event_vendor` pour un vendor donné | purchase → Meta `Purchase` |
| **Standard event** | Event vendor connu de leur catalog (ex : Meta `Purchase`, GA4 `purchase`) | Reçoit optimisation algo native |
| **Custom event** | Event vendor avec nom libre, hors catalog standard | Meta `checkout_intent` (custom) |
| **CustomEvent flag** | Booléen indiquant qu'un mapping Meta doit être traité comme custom event | `is_custom: true` côté Meta |
| **Trigger** | Lieu/condition dans le code où l'event est émis | "On click Continue step lead" |
| **Default mapping** | Configuration par défaut, garantie de reset propre, stockée dans `default-mapping.json` | Initial state du système |

## Concepts versioning

| Terme | Définition | Notes |
|---|---|---|
| **Mapping version** | Un snapshot complet (tous events × tous providers) à un moment T | Stocké en JSONB |
| **Active version** | LA version dont les mappings sont utilisés par le dispatcher | Une seule à la fois |
| **Draft** | Version créée mais non activée, mutable | Édition libre |
| **Archived** | Version désactivée, conservée pour audit et rollback | Réactivable |
| **Deleted (soft)** | Version supprimée logique, exclue de la liste par défaut | Restaurable via DB |
| **Clone** | Action de créer une nouvelle version basée sur une existante | Édition = clone obligatoire (D-001) |
| **Activate** | Marquer une version comme active (désactive l'ancienne) | Atomique via transaction |
| **Reset to default** | Activer la version `__default__` (lecture seule, immutable) | Audit log dédié |

## Concepts techniques

| Terme | Définition | Ref |
|---|---|---|
| **resolveEventMapping** | Fonction qui retourne le mapping pour `(eventName, providerKind)` avec fallback default | `lib/tracking/mappings/resolver.ts` |
| **mappings_jsonb** | Colonne PostgreSQL JSONB contenant la matrice complète d'une version | `event_mapping_versions.mappings` |
| **CSP / 1st-party** | Cookies de domaine `femiglow-maroc.com` vs tiers Meta/Google | Pour discussion sGTM (V2) |
| **GTM Container JSON** | Format officiel d'export/import GTM (Admin → Export Container) | `gtm-container-import.json` |
| **Workspace GTM** | Branche d'édition dans GTM (équivalent draft) | `workspaces` dans l'API |

## Statuts d'une version

```
       ┌────────┐ create     ┌───────┐  activate    ┌────────┐
  ──►  │ DRAFT  │ ────────►  │ READY │ ──────────►  │ ACTIVE │
       └────────┘            └───────┘              └────┬───┘
            ▲ edit (clone)                                │
            │                                             │ archive (activate another)
            │                                             ▼
       ┌────────┐  restore                            ┌──────────┐
       │ DELETED│ ◄──────  soft-delete  ◄───────────  │ ARCHIVED │
       └────────┘                                      └──────────┘
```

- **DRAFT** : créée, pas encore prête. Pas utilisée par dispatcher.
- **READY** : marquée comme prête à être active (optionnel — UX). Pas utilisée par dispatcher.
- **ACTIVE** : LA version courante. Une seule.
- **ARCHIVED** : ancienne version, conservée pour audit/rollback. Réactivable.
- **DELETED (soft)** : exclue de la liste par défaut. Restaurable.

> Note : le statut `READY` est introduit pour permettre un "publish lock"
> où une version est prête mais l'activation est différée (ex : on prépare
> tout pour le lendemain). En V1 simple, on peut omettre `READY` et faire
> directement DRAFT → ACTIVE.

## Acronymes utiles

| Acro | Signification |
|---|---|
| **CAPI** | Conversions API (Meta, TikTok, etc.) — canal serveur ↔ vendor |
| **CMP** | Consent Management Platform |
| **MP** | Measurement Protocol (GA4) |
| **GTM** | Google Tag Manager |
| **sGTM** | Server-side GTM (container hébergé GCP) |
| **JSONB** | JSON Binary PostgreSQL — type natif pour JSON indexable |
| **GIN** | Generalized Inverted Index — index Postgres performant pour JSONB |
| **CSV** | Comma-Separated Values |
| **OpenAPI** | Spec API REST formelle (YAML/JSON) |
| **WCAG** | Web Content Accessibility Guidelines |
| **AA** | Niveau intermédiaire WCAG (cible projet) |
| **A11y** | Accessibility (a-eleven-y) |

## Liens vers le code existant FemiGlow

| Concept | Fichier code actuel |
|---|---|
| Catalog des events canoniques | `apps/web/src/lib/tracking/event-catalog.ts` |
| Mapping code hardcodé (à versionner via cette feature) | `apps/web/src/lib/tracking/providers/event-mapping.ts` |
| Dispatcher serveur (consomme le mapping) | `apps/web/src/lib/tracking/server/dispatcher.ts` |
| Adapter Meta (utilise mapped name) | `apps/web/src/lib/tracking/providers/meta.ts` |
| Categorization existante (ref pour le pattern UI) | `apps/web/src/app/admin/tracking/events/categorization/` |
| GTM config-store existant (ref pour versioning UI) | `apps/web/src/lib/tracking/gtm/config-store.ts` |
