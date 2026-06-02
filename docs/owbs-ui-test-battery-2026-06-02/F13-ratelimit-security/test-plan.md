# F13 — Plan de tests concret

## A. Intégration routes
- **F13-S01** (déjà couvert TST-I-18) : 40×200 puis 429 + `Retry-After` (IP dédiée).
- **F13-S02** : usage normal (≤ qq req) → jamais 429.
- **F13-S03/S04** : 33 envelopes (Zod max 32 → 400) ; corps > 60 KB → 413.
- **F13-S10/S11** : `leadId` malformé sur `/lead` et `/sync` → 400.
- **F13-S12** : `/lead` avec leadId d'un autre visiteur (mock `getById` renvoie visitorId différent) → 409 (déjà TST-I-04 niveau service ; ajouter au niveau route).
- **F13-S22** : capturer les logs (`owbs.sync.batch`, `owbs.outbox.*`) → asserter qu'ils ne contiennent **pas** de PII (téléphone/nom).

## B. RTL (honeypot UI)
- **F13-S20** : wizard — remplir `name="website"` → submit → aucun enqueue.
- **F13-S21** : chat — remplir `_phone_alt` → submit → aucun fetch.

## C. Étapes
1. Rate-limit + plafonds (S01-S04).
2. Anti-injection leadId + mismatch (S10-S12).
3. Honeypots (S20/S21) + no-PII logs (S22).
