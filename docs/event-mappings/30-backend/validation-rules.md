# 30.4 — Règles de validation

## Validation par provider

Chaque provider a ses propres règles de format `mappedName`. Validation Zod stricte, refus côté serveur ET côté client (UX immediate feedback).

### Meta

- Standard events : `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`, `Lead`, `CompleteRegistration`, etc. (cf. Meta doc Pixel)
- Custom events : nom libre, max 40 chars, alphanumérique + underscore + espace
- Regex : `/^[A-Za-z][A-Za-z0-9_ ]{0,39}$/`
- `isCustom=true` requis si nom hors liste standard

### GA4

- Events libres mais conventionnellement snake_case
- Max 40 chars
- Regex : `/^[a-z][a-z0-9_]{0,39}$/`
- Recommandé : utiliser les noms standard GA4 pour bénéficier des rapports natifs (`purchase`, `begin_checkout`, `view_item`, etc.)

### Google Ads

- Format conversion action label : `AW-XXX/abc123` ou nom libre
- Max 60 chars
- Pas de regex stricte (Google accepte beaucoup de formats)

### TikTok

- Standard events : `Pageview`, `ViewContent`, `ClickButton`, `AddToCart`, `InitiateCheckout`, `CompletePayment`, etc.
- Custom events possibles
- Max 50 chars

### Snap

- Standard events en UPPER_SNAKE : `PAGE_VIEW`, `ADD_CART`, `START_CHECKOUT`, `PURCHASE`, etc.
- Max 50 chars

### Pinterest

- Standard events lowercase : `pagevisit`, `addtocart`, `checkout`, `lead`, `signup`, etc.
- Max 50 chars

## Validation cross-cellule

- Un event peut avoir `null` partout sauf 1 provider — accepté (event mono-vendor)
- Tous `null` → warning UX mais accepté (event "muted")

## Validation cross-event

- Pas de doublon de `mappedName` pour le même provider entre deux events canoniques (sinon le vendor reçoit la même valeur pour 2 events différents)
- Warning UX non bloquant (parfois intentionnel : `lead_capture` et `generate_lead` mappent tous deux à Meta `Lead`)

## Validation taille payload

- `mappings` JSONB max 100 KB (Postgres TOAST limite naturelle, mais on cap à 100 KB applicatif pour rester sain)
- Nombre d'events canoniques max 100 (sanity check ; aujourd'hui ~30)

## Sécurité

- Pas de HTML/JS dans `mappedName` (regex stricte évite injection)
- `notes` : sanitize HTML côté UI (markdown safe ok, scripts strip)
- Audit log capture l'IP anonymisée et UA hash (compliance RGPD)

## Cas particuliers

### Reserved id `__default__`

- Tentative create avec `id='__default__'` → 409
- Tentative edit (PUT) sur `__default__` → 403 `cannot_edit_default`
- Tentative delete → 403 `cannot_delete_default`
- Tentative archive → accepté (status archived est le state par défaut du default)
- Activate `__default__` → OK (c'est l'opération reset-to-default)

### Version active

- Tentative delete sur `is_active=true` → 403 `cannot_delete_active`
- Pour delete, l'admin doit d'abord activate une autre version

### Status `deleted`

- Pas listée par défaut dans GET (filter omit deleted)
- Re-activate possible via restore (status → archived → activate)
- Auto-purge V2 : delete physique après 90 jours en `deleted` (job cron)

## Tests validation

Cf. `validator.test.ts` :
- ✅ Meta `Purchase` → ok standard
- ✅ Meta `My_Custom_Event` → ok avec isCustom=true
- ❌ Meta `pur-chase` (kebab) → fail (hyphen interdit)
- ❌ GA4 `Purchase` (capital) → fail (snake_case requis)
- ❌ TikTok `... 51 chars` → fail (max 50)
- ✅ All `null` → accepté avec warning UX
- ❌ JSONB > 100 KB → fail `mapping_size_exceeded`
