# API Contracts — Locale Switcher V2

> **Source de vérité** : [`../CONTRACT.md`](../CONTRACT.md) §2 (noms d'endpoints), §3 (config), §6 (INV-12).
> **Précédents de style à mirrorer** :
> - public caché : `apps/web/src/app/api/track/banner-config/route.ts` (`Cache-Control` + no-auth)
> - admin écriture : `apps/web/src/app/api/admin/settings/[section]/route.ts` (`If-Match`, Zod 422, `upsert` 409, `revalidateTag`, `logAuditEvent`)
> - erreurs : `apps/web/src/lib/errors/http-error.ts` (`formatErrorResponse`)
> Contrat machine : [`endpoints.openapi.yaml`](./endpoints.openapi.yaml).

Forme d'erreur **canonique** (identique à `formatErrorResponse`) :

```json
{ "error": { "code": "<ErrorCode>", "message": "<human>", "details": <optional> } }
```

`ErrorCode` ∈ `unauthorized|forbidden|not_found|invalid_input|validation_failed|version_conflict|conflict|internal_error` (cf. `http-error.ts`). Validation Zod ⇒ **422** `validation_failed` avec `details = issues[]` (chaque issue porte le `rule` code de `config-schema.yaml`, ex. `V-AR-RTL`).

---

## 1. `GET /api/i18n/config` — config publique (no-auth, cachée)

### (a) Fonctionnement optimal
- **Auth** : aucune. Lisible par tout client (CONTRACT §3 « lisible sans auth »).
- **Corps** : la config **validée** (forme = [`../03-data/config-schema.yaml`](../03-data/config-schema.yaml)). En cas d'invalidité DB / DB down ⇒ **defaults** servis (INV-12), `meta.isDefault: true`.
- **Cache HTTP** : `Cache-Control: public, max-age=30, s-maxage=300, stale-while-revalidate=86400` (mirror banner-config, TTL plus long car change rarement ; SWR sert la dernière bonne valeur même DB down).
- **ETag** : faible, dérivé de `version` → `ETag: W/"ilc-<version>"`. Sur `If-None-Match` correspondant ⇒ **304** sans corps. Defaults ⇒ `W/"ilc-default"`.
- **Cache applicatif** : `unstable_cache(..., { tags: ['i18n-locale-config'] })` ; invalidé par le write path (`revalidateTag`).
- **Idempotence** : GET pur, safe & idempotent.
- **NB no-flash** : le rendu RSC du `LocaleSwitcher` n'appelle PAS cet endpoint en fetch — il appelle directement `getPublicLocaleConfig()` côté serveur (la config arrive en prop). Cet endpoint sert les clients **non-RSC** (hydratation, A/B côté client, outils).

### Réponses
| Statut | Quand | Corps |
|---|---|---|
| 200 | OK (DB valide ou defaults) | `{ payload, meta:{ version, updatedAt, isDefault } }` |
| 304 | `If-None-Match` == ETag courant | (vide) |
| 500 | Erreur interne **inattendue** | `{ error:{ code:'internal_error' } }` — ne doit jamais arriver pour cause de config invalide (INV-12 attrape avant). |

### (b) À vérifier / tester
- [ ] 200 **sans** cookie de session (jamais 401).
- [ ] `Cache-Control` + `ETag` présents ; `If-None-Match` ⇒ 304.
- [ ] DB invalide ⇒ 200 + defaults + `isDefault:true` (INV-12), **pas** de 500.
- [ ] DB down ⇒ 200 + defaults (SWR au edge si applicable).
- [ ] Aucun champ sensible (pas d'`updated_by`/PII dans le payload public — uniquement `version`/`updatedAt`/`isDefault` dans `meta`).
- [ ] ETag change après un PUT admin accepté.

---

## 2. `GET /api/admin/i18n/config` — config admin (auth)

### (a) Fonctionnement optimal
- **Auth** : `getAdminSession()` sinon **401**. RBAC `read` sur resource `app-config`/`i18n` sinon **403**.
- **Corps** : `{ payload, meta:{ version, updatedAt, updatedBy, isDefault } }` — inclut `updatedBy` (acteur), contrairement au public.
- **Pas de cache HTTP** (`dynamic = 'force-dynamic'`, mirror settings route) — l'admin voit toujours l'état frais pour éditer.
- Sert à hydrater le formulaire `/admin/i18n` **avec la `version` courante** (nécessaire au `If-Match` du PUT).

### (b) À vérifier / tester
- [ ] Sans session ⇒ 401 ; session sans droit `read` ⇒ 403.
- [ ] `meta.version` renvoyé = version DB courante (pivot du PUT).
- [ ] Pas de header `Cache-Control` public (réponse non cachée).

---

## 3. `PUT /api/admin/i18n/config` — écriture admin (auth + audit + concurrence)

### (a) Fonctionnement optimal
Mirror exact du PATCH `settings/[section]` :

1. **Authz** : `getAdminSession()` sinon 401 ; RBAC `write` sinon 403.
2. **Optimistic concurrency** : header `If-Match: <version>` **requis** ; absent/NaN ⇒ 400 `invalid_input`.
3. **Body** : `{ payload, note? }` (ou payload direct). `note` = commentaire d'audit optionnel.
4. **Validation** : `localeConfigSchema.safeParse(payload)` ; échec ⇒ **422** `validation_failed`, `details = issues[]` (avec `rule`).
5. **Upsert conditionnel** : `WHERE id='singleton' AND version = expectedVersion` ; 0 row ⇒ **409** `version_conflict` + `details.currentVersion`.
6. **Effets** (transaction) : `version+1`, `updated_at/by`, **insert snapshot** (état après).
7. **Cache** : `revalidateTag('i18n-locale-config')` ⇒ invalide le GET public.
8. **Audit** : `logAuditEvent({ action:'i18n-config.update', resourceType:'i18n_locale_config', resourceId:'singleton', meta:{ version, snapshotId, note, before, after } })`.
9. **200** : `{ payload, meta:{ version, updatedAt, updatedBy, isDefault:false }, snapshotId }`.

- **Idempotence** : PUT est idempotent *par état* mais **protégé par version** : rejouer le même PUT avec un `If-Match` périmé ⇒ 409 (pas d'écrasement aveugle). Deux PUT concurrents : le 2e reçoit 409.
- **Atomicité** : validation + upsert + snapshot dans une transaction ; **aucun** effet partiel en cas d'échec (pas de snapshot/audit/revalidate si la mutation échoue — comme la route settings : effets **après** `result.ok`).

### Codes d'erreur
| Statut | code | Cause |
|---|---|---|
| 400 | `invalid_input` | `If-Match` manquant/NaN, JSON malformé |
| 401 | `unauthorized` | pas de session |
| 403 | `forbidden` | RBAC `write` refusé / tentative de désactiver le default (garde-fou, cf. admin-permissions.md) |
| 409 | `version_conflict` | `If-Match` ≠ version courante |
| 422 | `validation_failed` | Zod / validationRules (`details[].rule`) |
| 500 | `internal_error` | inattendu |

### (b) À vérifier / tester
- [ ] Sans session ⇒ 401, **aucune** mutation/snapshot/audit.
- [ ] RBAC `write` refusé ⇒ 403, aucun effet.
- [ ] `If-Match` absent ⇒ 400 ; périmé ⇒ 409 + `currentVersion`.
- [ ] Payload invalide (chaque fixture invalide de `fixtures.json`) ⇒ 422 + `rule` attendu ; **aucune** mutation.
- [ ] PUT valide : `version+1`, snapshot créé, `revalidateTag` appelé, audit avec `before/after`.
- [ ] Concurrence : deux PUT // → un 200, un 409 (pas de lost update).
- [ ] Garde-fou : tenter de désactiver le default ⇒ 422/403 (selon implémentation : V-DEFAULT-ENABLED échoue au schéma → 422).
- [ ] Après PUT, `GET /api/i18n/config` reflète la nouvelle valeur (cache invalidé) et l'ETag change.
- [ ] `.strict()` : clé inconnue ⇒ 422 (anti-injection).

---

## 4. `resolveSuggestedLocale()` — exposition

`resolveSuggestedLocale()` (cf. CONTRACT §2, détail dans [`server-detection.md`](./server-detection.md)) **n'est PAS un endpoint HTTP**. C'est un **helper serveur pur** (`apps/web/src/lib/i18n/suggested-locale.ts`) :

```ts
function resolveSuggestedLocale(input: {
  acceptLanguage: string | null;
  cookieLocale: Locale | null;     // NEXT_LOCALE
  servedLocale: Locale;
  enabledLocales: readonly Locale[];
}): Locale | null
```

- **Appel** : depuis le **layout/RSC** (`headers()` + `cookies()`), résultat **passé en prop** au `LocaleNudge` → **pas de flash** client (INV : no-flash). Jamais appelé via fetch côté client.
- **Retour** : la locale suggérée, ou `null` (pas de nudge). `null` si cookie présent (choix explicite), si suggested == served, si non supportée, ou si suggested désactivée.
- **Privacy** : lit **uniquement** `Accept-Language` + cookie ; **aucune** géoloc IP (cf. server-detection.md).
- **Exposition de test** : pure fonction testable unitairement avec les `acceptLanguageFixtures` de `fixtures.json` (pas besoin de réseau).

### (b) À vérifier / tester
- [ ] Tous les `acceptLanguageFixtures` mappent au `expectedSuggested` attendu.
- [ ] Cookie présent ⇒ toujours `null` (précédence cookie).
- [ ] Suggested désactivée en config ⇒ `null` (ne jamais suggérer une locale non servable).
- [ ] Aucune lecture d'IP / header de géoloc.
- [ ] Fonction pure : même entrée ⇒ même sortie, pas d'accès réseau/DB.
