# CHA-230 — Catalogue dynamique des villes de livraison

> Migration du dataset statique `MOROCCAN_CITIES` (constant côté front) vers
> un catalogue PostgreSQL administrable depuis `/admin/settings/delivery-cities`,
> servi via un endpoint public d'autocomplete.
>
> Statut : implémentation terminée. Kill-switch `NEXT_PUBLIC_USE_DB_CITIES`
> disponible pour rollback en < 5 min.

---

## TL;DR

| Avant | Après |
|---|---|
| Constante TS `MOROCCAN_CITIES` (~30 villes, hardcodée dans le bundle). | Table `delivery_cities` (PostgreSQL) admin-managée. |
| Wizard + Mode B utilisaient un `<select>` ou `<datalist>` figé. | Combobox dynamique `<CityAutocomplete>` (WAI-ARIA) qui interroge `/api/delivery-cities/search`. |
| `villeMarocEnum` (11 slugs) imposait une branche `city === 'autre'` + champ `cityOther` à part. | `city` est désormais une string libre côté schéma. Le combobox propose les villes du catalogue, l'utilisateur peut aussi saisir librement. |
| Tarifs livraison fixés côté front (`computeShippingCents`). | Prix + ETA portés par la ligne DB (`delivery_price_mad`, `delivery_eta`), affichés dans le bloc de réassurance dynamique. |
| Mise à jour du catalogue = release. | Mise à jour = quelques clics dans `/admin/settings/delivery-cities`. |

---

## Surface fonctionnelle

### Côté visiteur
- **Wizard 3-steps** (`/commander`, modes embed `/kit` + classique) : étape adresse
  utilise `<CityAutocomplete>`. Match préfixe FR, AR, et alias. Sélection
  d'une suggestion → persistance dans le wizard store (slug + nom AR + prix + ETA),
  utilisée pour le bloc shipping dynamique (« Livraison 19 MAD en 24h »).
- **Mode B (`CheckoutFlow.tsx`)** — depuis CHA-230 Phase 8 — utilise le **même**
  `<CityAutocomplete>` que le wizard. Plus de `<select>` rigide.

### Côté admin
- `/admin/settings/delivery-cities` : table paginée, recherche, filtres,
  toggle actif/inactif, drawer CRUD (create / edit / delete).
- Champs administrables : `slug`, `nameFr`, `nameAr`, `deliveryPriceMad`,
  `deliveryEta`, `aliases[]`, `position`, `isActive`, `source`.

### Côté API
- `GET /api/delivery-cities/search?q=<text>&limit=<1..50>&countryCode=MA`
  - Public, pas d'auth.
  - Match préfixe FR/AR + alias overlay (`searchDeliveryCities`).
  - `includeInactive=true` → ignoré (toujours forcé à false, sécurité).
  - `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`.
- `GET /api/admin/delivery-cities` + variants CRUD : nécessitent une session
  admin (middleware `/admin/...` + auth helper).

---

## Architecture

```
                       ┌─────────────────────────────────────────────┐
                       │  /admin/settings/delivery-cities (form CRUD) │
                       └─────────────────┬───────────────────────────┘
                                         │ POST/PATCH/DELETE
                                         ▼
                       ┌─────────────────────────────────────────────┐
                       │       Table PostgreSQL `delivery_cities`     │
                       │  (Drizzle ORM + memoryStore in test mode)    │
                       └─────────────────┬───────────────────────────┘
                                         │ searchDeliveryCities()
                                         ▼
                       ┌─────────────────────────────────────────────┐
                       │ GET /api/delivery-cities/search (public)     │
                       │   Cache-Control: s-maxage=300 + SWR 900      │
                       └────┬────────────────────────────────────────┘
                            │ fetch (debounced 200ms, mem-cache)
                            ▼
                       ┌─────────────────────────────────────────────┐
                       │ useDeliveryCities() ← <CityAutocomplete />   │
                       │   utilisé par : wizard, Mode B, /kit admin   │
                       └─────────────────────────────────────────────┘
```

### Fichiers-clé
- `src/lib/db/schema/delivery-cities.ts` — table Drizzle.
- `src/lib/db/queries/delivery-cities.ts` — CRUD + `searchDeliveryCities()`.
- `src/lib/checkout/delivery/schemas.ts` — Zod input schemas (admin + search).
- `src/lib/checkout/delivery/use-delivery-cities.ts` — hook React (debounce, cache mémoire, fallback statique).
- `src/components/checkout/wizard/components/CityAutocomplete.tsx` — combobox WAI-ARIA partagé.
- `src/app/api/delivery-cities/search/route.ts` — endpoint public.
- `src/app/api/admin/delivery-cities/route.ts` — endpoint admin (+ `[id]/route.ts`).
- `src/components/admin/settings/DeliveryCitiesEditor.tsx` — UI admin.
- `scripts/seed-delivery-cities.ts` — peuplement initial depuis `MOROCCAN_CITIES`.

---

## Schéma Zod (`order.ts`)

Avant CHA-230 :

```ts
export const villeMarocEnum = z.enum(['casablanca', 'rabat', ..., 'autre']);
city: villeMarocEnum,
cityOther: z.string().max(60).optional(),
// + superRefine : autre exige cityOther non vide
```

Après CHA-230 :

```ts
// Liste héritée gardée pour le formatage du recap + matching express, plus
// pour le scoring server-side. N'est PLUS l'autorité du schéma.
export const villeMarocEnum = z.enum([...]);

city: z.string().trim().min(2).max(80),
cityOther: z.string().max(60).optional(),  // legacy, plus collecté côté UI
// pas de superRefine — le combobox + le serveur logistique gèrent.
```

Les drafts localStorage pré-CHA-230 (où `city='autre'` + `cityOther` rempli)
restent acceptés par le schéma ; `OrderRecap` continue de les afficher
correctement via le fallback `?? cityOther`.

---

## Kill-switch — `NEXT_PUBLIC_USE_DB_CITIES`

Variable d'env publique qui contrôle l'utilisation du catalogue DB. Utile
en cas d'incident (catalogue corrompu, perf DB, schéma cassé) : permet de
revenir en quelques minutes à l'expérience pré-CHA-230 sans déployer de
revert code.

### Valeurs acceptées

| Valeur env | Comportement |
|---|---|
| `true` / `1` / `on` / `yes` / `TRUE` | DB activée (défaut). |
| _absent / chaîne vide_ | DB activée (défaut). |
| `false` / `False` / `0` / `off` / `no` / ` FALSE ` | DB désactivée → dataset statique. |

### Effets côté serveur (API route)
- `/api/delivery-cities/search` court-circuite Drizzle et sert
  `searchCities(q, limit)` du dataset statique. Cache-Control identique.

### Effets côté client (hook)
- `useDeliveryCities` ne fait **aucun** fetch quand le flag est off — il
  résout localement contre `MOROCCAN_CITIES`. Économise les appels réseau
  et garantit la cohérence si la rotation Vercel/Next sert un mix de pods
  pré/post toggle (jamais d'état intermédiaire).

### Procédure de rollback

1. Ouvrir le dashboard Vercel → projet `template-femiglow` → Settings → Environment Variables.
2. Set `NEXT_PUBLIC_USE_DB_CITIES=false` pour l'environnement concerné.
3. **Redéployer** (variable build-time, pas runtime).
4. Vérifier `/api/delivery-cities/search?q=casa` → renvoie les villes statiques.
5. Vérifier le wizard + Mode B : combobox fonctionne, suggestions présentes.

### Tests de non-régression
- `src/lib/checkout/delivery/use-delivery-cities.test.ts` :
  - parse de toutes les valeurs (`true/false/0/off/...`).
  - flag=false → pas de fetch, items statiques.
- `src/app/api/delivery-cities/search/route.test.ts` :
  - flag=false sans seed DB → renvoie ≥ 1 ville (preuve qu'on tape statique).
  - shape `PublicCity` préservé, Cache-Control présent.

---

## Tests d'acceptation manuels

1. **`/admin/settings/delivery-cities`** → la table est peuplée (au moins
   Casablanca, Rabat, Marrakech). Toggle actif/inactif fonctionne, le drawer
   CRUD enregistre les changements.
2. **`/kit` ou `/commander` étape adresse** :
   - Cliquer dans le champ ville → un listbox s'ouvre avec les top 8 actifs.
   - Taper « casa » → Casablanca remonte en premier.
   - Taper en arabe « الرباط » → Rabat remonte.
   - Sélectionner Casablanca → le bloc « Mode de livraison » montre le prix
     dynamique (et l'option Express devient cliquable).
3. **Désactiver une ville en admin** → recharger le wizard → la ville n'apparaît
   plus dans les suggestions.
4. **Kill-switch** : set `NEXT_PUBLIC_USE_DB_CITIES=false` localement, restart
   `pnpm dev`. Vérifier que `/api/delivery-cities/search?q=casa` renvoie un
   résultat même sans seed DB (preuve qu'on tape le dataset statique).

---

## Liens

- Plan d'action : `docs/checkout-funnel/05-plan-action.md`
- Architecture data : `docs/checkout-funnel/08-architecture-data.md`
- Spec UI wizard : `docs/checkout-funnel/06-wizard-ui-specification.md`
- Stratégie tests : `docs/checkout-funnel/10-tests-strategy.md`
