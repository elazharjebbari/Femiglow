# 03 — Contrats API

## Conventions

- Préfixe : `/api/admin/components/...` (auth admin requise via
  `getAdminSession()`).
- Public read : `/api/components/...` (aucun, tout est SSR).
- Tous les `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- Erreurs : `formatErrorResponse(err)` (pattern `HttpError`).
- Audit : appel à `auditTrackingChange` après chaque mutation.

## Routes

### `GET /api/admin/components`

Liste les composants du registre.

**Query params** :
- `q?: string` — recherche full-text sur key+name+description
- `pageGroup?: string` — `home | journal | kit | maison | rituel | commerce | global`
- `category?: string` — `hero | section | card | ...`
- `hasBinding?: 'true' | 'false'` — filtre par présence d'un binding actif
- `limit?: number` — défaut 100, max 500
- `cursor?: string` — pagination

**Réponse 200** :
```json
{
  "components": [
    {
      "id": "cmp_01HXX...",
      "key": "hero-home",
      "name": "Hero — Page d'accueil",
      "category": "hero",
      "pageGroup": "home",
      "filePath": "apps/web/src/components/sections/Hero.tsx",
      "slots": [{ "key": "primary", "label": "...", "required": true, "acceptKinds": ["image"] }],
      "defaultSvgFallback": "/images/hero-home.svg",
      "defaultLoadingStrategy": "eager",
      "supportsAnimation": true,
      "metadata": { "aspectRatio": "3:2" },
      "bindings": [
        { "slot": "primary", "isActive": true, "media": { "id": "med_...", "slug": "home-hero-home" } }
      ],
      "activeBindingsCount": 1,
      "totalSlots": 1
    }
  ],
  "total": 24,
  "nextCursor": null
}
```

---

### `GET /api/admin/components/[key]`

Détail d'un composant. `key` (slug stable), pas `id`.

**Réponse 200** :
```json
{
  "component": {
    "id": "cmp_...",
    "key": "hero-home",
    "name": "...",
    "slots": [...],
    "defaultSvgFallback": "/images/hero-home.svg",
    "bindings": [
      {
        "id": "cmb_...",
        "slot": "primary",
        "isActive": true,
        "loadingStrategy": "eager",
        "fetchPriority": "high",
        "priority": true,
        "placeholderStrategy": "blurhash",
        "displayOrder": 0,
        "customAlt": null,
        "media": { "id": "med_...", "slug": "...", "kind": "image", "alt": "...", "originalUrl": "..." }
      }
    ],
    "animations": [
      { "id": "cab_...", "isDefault": true, "params": {}, "animation": { "key": "fade-in", "name": "Fade in", "kind": "framer-motion" } }
    ]
  }
}
```

---

### `POST /api/admin/components/sync-registry`

Synchronise la table `siteComponents` depuis `lib/components/registry.ts`.

**Idempotent** : upsert par `key`. Ne supprime jamais (déprecation manuelle).

**Réponse 200** :
```json
{ "ok": true, "upserted": 24, "skipped": 0 }
```

---

### `POST /api/admin/components/[key]/bindings`

Crée ou met à jour un binding pour un slot.

**Body (zod)** :
```ts
{
  slot: string,                          // doit exister dans component.slots
  mediaId?: string | null,               // null → unassign
  loadingStrategy?: MediaLoadingStrategy,
  fetchPriority?: FetchPriority,
  priority?: boolean,
  placeholderStrategy?: PlaceholderStrategy,
  customAlt?: string | null,
  displayOrder?: number,
  isActive?: boolean,
  notes?: string | null,
}
```

**Comportement** : upsert par `(componentId, slot)`. Si `mediaId=null`,
le binding existe mais sans média (équivaut à fallback SVG forcé).

**Réponse 200** :
```json
{ "binding": { "id": "cmb_...", "slot": "primary", ... }, "audit": { "id": "aud_..." } }
```

**Erreurs** :
- `404` — composant ou média introuvable
- `400 (invalid_slot)` — slot ne fait pas partie de `component.slots`
- `400 (kind_mismatch)` — média est `video` alors que slot accepte `image`

---

### `DELETE /api/admin/components/[key]/bindings/[slot]`

Supprime le binding du slot. Le composant retombe sur son fallback SVG.

**Réponse 200** :
```json
{ "ok": true, "deleted": true }
```

---

### `POST /api/admin/components/[key]/animations`

Attache un profil d'animation au composant.

**Body** :
```ts
{
  animationKey: string,    // ex 'fade-in'
  isDefault?: boolean,
  params?: Record<string, unknown>,
}
```

**Comportement** : upsert par `(componentId, animationId)`. Si
`isDefault=true`, met les autres bindings du même composant à `isDefault=false`.

---

### `DELETE /api/admin/components/[key]/animations/[animationKey]`

Détache l'animation du composant.

---

### `GET /api/admin/components/animations`

Liste tous les profils d'animation disponibles.

**Réponse 200** :
```json
{
  "animations": [
    { "key": "fade-in", "name": "Fade in", "kind": "framer-motion", "description": "...", "respectsReducedMotion": true, "config": {...} }
  ]
}
```

---

### `POST /api/admin/components/seed-from-docs`

Ingère les images de `docs/images/values/` :

**Body** :
```ts
{
  /** force re-import si déjà présent (re-upload + nouvelles variants) */
  force?: boolean,
  /** auto-active les bindings après création. Par défaut false (sécurité) */
  autoActivate?: boolean,
  /** sous-dossier ciblé (home, journal, kit, maison, rituel). Tous si omis */
  pageGroup?: string,
}
```

**Réponse 200** :
```json
{
  "imported": 50,
  "skipped": 0,
  "matched": 47,
  "unmatched": 3,
  "unmatchedFiles": ["docs/images/values/kit/ChatGPT Image 3 mai 2026.png"],
  "bindingsCreated": 47,
  "bindingsUpdated": 0
}
```

**Sécurité** : auth admin + rate-limit 1/minute (opération coûteuse).

---

### `POST /api/admin/components/[key]/preview`

(Optionnel V1) Renvoie un payload identique à celui que verrait le composant
en SSR — utile pour preview admin sans naviguer sur la page publique.

**Réponse** :
```json
{
  "resolved": {
    "kind": "image",
    "media": {...},
    "variants": [...],
    "loadingStrategy": "eager",
    "animation": { "key": "fade-in", "params": {} },
    "fallbackSvg": "/images/hero-home.svg"
  }
}
```

## Codes d'erreur communs

| Code             | HTTP | Quand                                     |
|------------------|------|-------------------------------------------|
| `unauthorized`   | 401  | Pas de session admin                      |
| `not_found`      | 404  | composant ou binding inconnu              |
| `invalid_input`  | 400  | Zod parsing échoue                        |
| `invalid_slot`   | 400  | slot pas dans `component.slots`           |
| `kind_mismatch`  | 400  | média `video` sur slot `image`            |
| `rate_limited`   | 429  | seed appelé > 1/min                       |
| `internal_error` | 500  | crash du pipeline d'optimisation          |
