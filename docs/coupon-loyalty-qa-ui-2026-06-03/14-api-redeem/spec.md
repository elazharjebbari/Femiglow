# F14 — Contrat API `POST /api/coupons/redeem`

## Rôle & surface
Valide (sans consommer) un code de crédit fidélité pour **prévisualiser** la réduction côté client
(saisie dans `InvitationCodeField`, F08). **Publique, sans auth**, best-effort. La consommation réelle
est autoritaire à la création de commande (hors périmètre). Fichier cible :
`src/app/api/coupons/redeem/route.ts`. Couche **I** (contrat) ; une variante **M** (MSW) existe côté
client en F08.

## Fonctionnement optimal (ce qui DOIT se passer)
1. Parse `req.json()`. JSON invalide → `422 { valid:false, reason:'invalid_input' }`.
2. Valide `bodySchema = { code: z.string().trim().min(3).max(40) }`. Échec → `422 { valid:false, reason:'invalid_input' }`.
3. Import dynamique + `validateGrant(code)` :
   - `{ valid:true, valueCents }` → `200 { valid:true, valueCents }`.
   - `{ valid:false, reason }` avec `reason ∈ not_found|already_redeemed|expired|not_yet_active`
     → `200 { valid:false, reason }`.
4. Toute exception non rattrapée de `validateGrant` (catch) → `200 { valid:false, reason:'error' }`.

## Contrat I/O
- **Méthode/chemin** : `POST /api/coupons/redeem`. Body `{ code: string }`.
- **Réponses** :
  - `200 { valid:true, valueCents:number }` — code valide.
  - `200 { valid:false, reason }` — code invalide, `reason` ∈ {`not_found`,`already_redeemed`,`expired`,`not_yet_active`,`error`}.
  - `422 { valid:false, reason:'invalid_input' }` — JSON malformé OU schéma invalide (code < 3 / > 40 / absent).
- **Statut HTTP** : seul `invalid_input` est `422` ; **tous les autres reason sont `200`** (y compris `error`).
- **Normalisation** : `validateGrant` applique `code.trim().toUpperCase()` ⇒ `fg-atlas-2048` matche `FG-ATLAS-2048`.

## Cas limites & non-happy-path — couverture EXHAUSTIVE des reason
| reason | mise en place | statut | corps |
|---|---|---|---|
| `valid:true` | grant `issued`, activé, non expiré | 200 | `{ valid:true, valueCents }` |
| `not_found` | code inexistant | 200 | `{ valid:false, reason:'not_found' }` |
| `not_yet_active` | grant avec `activatesAt` dans le futur (`now < activatesAt`) | 200 | `{ valid:false, reason:'not_yet_active' }` |
| `expired` | grant avec `expiresAt` dépassé (`now > expiresAt`) | 200 | `{ valid:false, reason:'expired' }` |
| `already_redeemed` | grant `redeemed` (via `redeemGrant`) | 200 | `{ valid:false, reason:'already_redeemed' }` |
| `invalid_input` (schéma) | `code` de 2 chars / 41 chars / absent | 422 | `{ valid:false, reason:'invalid_input' }` |
| `invalid_input` (parse) | corps non-JSON | 422 | `{ valid:false, reason:'invalid_input' }` |
| `error` | `validateGrant` jette (mock import qui throw) | 200 | `{ valid:false, reason:'error' }` |

Frontières : code = exactement 3 chars (valide schéma), exactement 40 chars (valide), 2 chars (422),
41 chars (422). Casse/espaces : `"  fg-atlas-2048  "` normalisé. Aucune auth requise (header absent → toujours traité).

## Invariants couverts
- **INV-ACTIVATION** : `not_yet_active` quand `now < activatesAt`.
- **INV-VALIDITY** : `expired` quand `now > expiresAt` (= activatesAt + 60 j).
- Best-effort public : aucune erreur 5xx exposée au client ; `error` renvoyé en `200`.
- Distinction nette `422 invalid_input` (corps) vs `200 reason` (logique métier).

## Critères d'acceptation (observables)
- Code valide → `res.status===200 && body.valid===true && typeof body.valueCents==='number'`.
- Chaque code invalide → `res.status===200 && body.valid===false && body.reason===<attendu>`.
- Code < 3 / > 40 / absent / JSON cassé → `res.status===422 && body.reason==='invalid_input'`.
- `validateGrant` qui throw → `res.status===200 && body.reason==='error'`.
- Casse insensible : `fg-atlas-2048` et `FG-ATLAS-2048` donnent le même résultat.

## Points à vérifier — tous points de vue
- Backend : seuil 422 limité à invalid_input ; catch renvoie `error` en 200 ; normalisation casse.
- Frontend : F08 mappe chaque `reason` vers un message FR/AR (jamais le code brut affiché).
- UI/UX : `error`/`not_found` → message neutre ; `not_yet_active` → date d'activation (côté commande).
- Data : route ne consomme PAS le grant (validation non mutante) ; statut inchangé après appel.
- A11y / i18n : messages d'erreur testés en F08, pas ici.
