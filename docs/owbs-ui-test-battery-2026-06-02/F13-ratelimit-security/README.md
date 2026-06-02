# F13 — Rate-limit `/sync` & sécurité (honeypot, anti-abus, anti-injection)

**Surface :** `POST /api/checkout/lead/sync` (rate-limit, plafonds), validation
Zod `leadId`, honeypot wizard/chat, anti-collision visitorId. **Public :**
système/opérateur.

## 1. Fonctionnement optimal
- `/sync` : **rate-limit par IP** (40/min) → `429` + `Retry-After` ; plafonds (32 envelopes / 60 KB → `413`) ; validation Zod stricte (envelope malformée → `400`).
- **honeypot** : wizard (`website`) et chat (`_phone_alt`) remplis → soumission neutralisée (succès silencieux), aucun lead.
- **leadId client** : regex `^cl_[0-9a-z]{20,}$` côté schéma + service ; anti-collision inter-visiteurs (`LeadVisitorMismatchError` → 409).
- Aucune **PII** en clair dans les logs.

## 2. Points à vérifier (tous angles)
### Sécurité
- Flood `/sync` → `429` (sans bloquer un usage légitime normal).
- `leadId` falsifié / format invalide → rejet (`400`/`409`).
- Un `leadId` détourné vers un **autre** visiteur → `409` (mismatch).
- Honeypot efficace (wizard + chat).
### UX (ne pas pénaliser le légitime)
- Le seuil rate-limit ne déclenche pas pour une acheteuse réelle (1 flush/étape + beacon).
- Un `429` côté beacon ne casse rien (best-effort).
### Data
- Logs sans PII (ids/scopes/statuts seulement).

## 3. Oracle principal
> Au-delà de 40 req/min/IP, `/sync` renvoie `429` ; un `leadId` falsifié est rejeté ;
> un honeypot rempli ne crée **aucun** lead ; un usage normal n'est jamais bloqué.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md)
