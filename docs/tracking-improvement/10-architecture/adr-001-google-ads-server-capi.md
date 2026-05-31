# ADR-001 — Google Ads server-side via Enhanced Conversions API

> **Statut** : Proposed
> **Date** : 2026-05-13
> **Décideurs** : Tech Lead, Marketing, PO

## Contexte

Le système actuel envoie les conversions Google Ads UNIQUEMENT via le tag
client `gtag.js`. Conséquences :
- Ad-blockers bloquent ~15-25% des conversions (estimation FR)
- Consent denied → 0 conversion attribuée
- Pas de fallback si JS échoue

## Options évaluées

### Option 1 — Status quo (client-only)
- ❌ Ne résout aucun problème
- ❌ Conversions perdues continuent

### Option 2 — Google Ads Enhanced Conversions API (server)
- Envoi de la conversion via API serveur Google
- Email/téléphone hashés (SHA-256) → matching Google sans cookie
- Cohabite avec tag client : dédup native via `event_id`
- ✅ Bypass ad-blockers
- ✅ Fonctionne sans cookie tiers
- ⚠ Nécessite OAuth Customer ID Google Ads

### Option 3 — Google Ads Offline Conversions API
- Conversions importées par batch après le clic initial
- Attribution via `gclid` capturé à l'arrivée
- ✅ Idéal pour funnels long (lead → call → contract)
- ⚠ Latence forte (batch toutes les 4-6h)
- ⚠ Plus complexe à implémenter

## Décision

**Option 2 — Enhanced Conversions API** pour la V1.

Rationale :
- Latence acceptable (~500ms-1s)
- Cohabite avec gtag.js client (déduplication via `event_id`)
- API REST standard, OAuth Customer ID
- Permet d'évoluer vers Offline Conversions plus tard si besoin

## Conséquences

### Positives
- Récupération de 10-25% de conversions perdues
- Conformité ePrivacy (consent côté serveur)
- Robustesse aux pannes JS / ad-blockers

### Négatives
- Effort dev important (OAuth, refresh tokens, retry logic)
- Dépendance à Google Ads API (quotas, breaking changes)
- Maintenance OAuth (rotation des refresh tokens)

### Mitigations
- Implémenter retry exponentiel sur 429/5xx
- Logger toutes les conversions échouées pour reprise manuelle
- Documenter la procédure OAuth dans le runbook

## Implementation notes

- Endpoint : `https://googleads.googleapis.com/v17/customers/{customer_id}:uploadClickConversions`
- Auth : OAuth refresh token (stocké chiffré dans `tracking_providers`)
- Developer Token : niveau MCC, stocké en .env (`GOOGLE_ADS_DEVELOPER_TOKEN`)
- Body : `{ conversions: [{ gclid, conversion_action, conversion_date_time, conversion_value, currency_code, user_identifiers: [...] }] }`

## Suivi

- C1.F.1 à C1.F.6 (cf. success-criteria.md)
- KPI : ratio conversions server / client en steady state.
