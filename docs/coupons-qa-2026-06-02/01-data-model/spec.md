# CPN-01 — Modèle de données coupons + coupon_events

> Feature_id : **CPN-01** · Couche : **data** · Criticité : **P0**
> Risque principal (feature-inventory) : *Intégrité des données / contrainte unique manquante*.
> Source de vérité du schéma : `apps/web/src/lib/db/schema.ts` (bloc « COUPONS (migration 0080) »).
> Driver dual : `apps/web/src/lib/db/client.ts` (`db()` si `DATABASE_URL`, sinon `memoryStore()`).
> Génération d'ID : `createId(prefix)` dans `apps/web/src/lib/ids.ts`.

---

## (a) Fonctionnement optimal — comportement attendu détaillé

Le modèle de données coupons est le socle de tout le système. Il définit **deux tables** et **sept enums** Postgres, sous une migration Drizzle générée (`drizzle-kit`), réplicables à l'identique côté `memoryStore()` pour les tests Vitest et le dev local.

### Table `coupons` — définition de campagne (CRUD admin)
Une ligne = une campagne promotionnelle pilotée par l'admin. Sa résolution doit être **déterministe et identique** à l'affichage (`/kit`), au snapshot panier et au repricing commande (INVARIANT MAÎTRE : prix affiché == prix facturé).

Colonnes et règles :
- `id text PK` — généré par `createId('cpn')` (jamais auto-incrément ; cohérent dual-driver).
- `label text NOT NULL` — libellé interne admin (ex. « Geste d'accueil »).
- `code text NULL` — `NULL` pour les coupons `auto` ; rempli + **unique partiel** pour le mode `code`.
- `type couponType NOT NULL` ∈ {`welcome_auto`,`rescue`,`email_unlock`,`manual_code`,`post_purchase`}.
- `mode couponMode NOT NULL` ∈ {`auto`,`code`}.
- `status couponStatus NOT NULL DEFAULT 'draft'` ∈ {`draft`,`active`,`paused`,`archived`}.
- `valueKind couponValueKind NOT NULL` ∈ {`fixed_amount`,`percent`}.
- `valueAmount integer NOT NULL` — centimes si `fixed_amount`, points de % (0..100) si `percent`.
- `target couponTarget NOT NULL DEFAULT 'product_price'` ∈ {`product_price`,`shipping`,`future_credit`}.
- `currency text NOT NULL DEFAULT 'MAD'` — garde-fou devise.
- `eligibility jsonb NOT NULL DEFAULT '{}'::jsonb` — règles d'éligibilité extensibles (`{}` = tout le trafic).
- `startsAt timestamptz NULL`, `endsAt timestamptz NULL` — fenêtre civile (jamais countdown).
- `stackable boolean NOT NULL DEFAULT false`.
- `usageScope couponUsageScope NOT NULL DEFAULT 'unlimited'` ∈ {`unlimited`,`once_per_visitor`,`global_cap`}.
- `usageCap integer NULL`, `usageCount integer NOT NULL DEFAULT 0`.
- `holdoutPct integer NOT NULL DEFAULT 0` — % d'éligibles en contrôle (0 en Phase 1).
- `priority integer NOT NULL DEFAULT 0` — départage les non-cumulables.
- `createdAt timestamptz NOT NULL DEFAULT now()`, `updatedAt timestamptz NOT NULL DEFAULT now()`.
- `createdBy text NULL REFERENCES admin_users(id) ON DELETE SET NULL`.

Index/contraintes :
- `coupons_code_unique` : **uniqueIndex partiel** `ON (code) WHERE code IS NOT NULL`. Autorise N coupons `auto` avec `code = NULL` ; interdit deux codes identiques.
- `coupons_status_type_idx` : index `ON (status, type)` — requête chaude « coupons actifs de type X » pour la résolution.

### Table `coupon_events` — log append-only d'incrémentalité
Une ligne = un événement (exposition / application / conversion). Sert à mesurer treatment vs holdout. **Append-only** ; aucune mise à jour métier attendue.

Colonnes :
- `id text PK` — `createId('cpe')`.
- `couponId text NULL REFERENCES coupons(id) ON DELETE SET NULL` — l'historique survit à l'archivage/suppression du coupon.
- `phase couponEventPhase NOT NULL` ∈ {`exposed`,`applied`,`converted`}.
- `bucket couponBucket NOT NULL` ∈ {`treatment`,`holdout`}.
- `visitorKey text NULL` — **hash anonyme** (PAS de PII).
- `orderId text NULL REFERENCES orders(id) ON DELETE SET NULL`.
- `amountCents integer NULL` — remise effective au moment de la conversion.
- `trafficSource text NULL`, `device text NULL`.
- `createdAt timestamptz NOT NULL DEFAULT now()`.

Index/contraintes :
- `coupon_events_coupon_phase_idx` : `ON (couponId, phase, createdAt)` — agrégats par campagne/phase/temps.
- `coupon_events_visitor_idx` : `ON (visitorKey)` — recherche par visiteur (cap usage, debug).
- `coupon_events_order_converted_unique` : **uniqueIndex partiel** `ON (orderId) WHERE phase='converted' AND orderId IS NOT NULL` → **idempotence** : une seule conversion comptée par commande, même si l'enregistrement est rejoué.

### Cohérence dual-driver
Drizzle (Postgres/PGlite) et `memoryStore()` doivent retourner la **même forme** de ligne (mêmes clés, mêmes types JS, mêmes valeurs par défaut appliquées). `resetMemoryStore()` purge l'état entre tests ; `__setTestDb(pglite)` permet d'exécuter les contraintes réelles sur PGlite.

---

## (b) Contrats I/O

### Types inférés (source : schema.ts)
```ts
type CouponRow       = typeof coupons.$inferSelect;
type CouponInsert    = typeof coupons.$inferInsert;
type CouponEventRow  = typeof couponEvents.$inferSelect;
type CouponEventInsert = typeof couponEvents.$inferInsert;
```

Invariants de forme `CouponRow` :
- `id`, `label`, `type`, `mode`, `status`, `valueKind`, `valueAmount`, `target`, `currency`, `stackable`, `usageScope`, `usageCount`, `holdoutPct`, `priority`, `createdAt`, `updatedAt` → **jamais `null`** en lecture.
- `code`, `eligibility` (objet, défaut `{}`), `startsAt`, `endsAt`, `usageCap`, `createdBy` → nullable.
- `valueAmount` ∈ ℤ ≥ 0 (validation métier amont ; la DB n'impose pas le signe → testé en V).

Invariants de forme `CouponEventRow` :
- `id`, `phase`, `bucket`, `createdAt` → jamais `null`.
- `couponId`, `visitorKey`, `orderId`, `amountCents`, `trafficSource`, `device` → nullable.

### Entrées d'insertion (`CouponInsert`)
- Obligatoires sans défaut : `id`, `label`, `type`, `mode`, `valueKind`, `valueAmount`.
- Optionnelles avec défaut DB : `status`(`draft`), `target`(`product_price`), `currency`(`MAD`), `eligibility`(`{}`), `stackable`(`false`), `usageScope`(`unlimited`), `usageCount`(`0`), `holdoutPct`(`0`), `priority`(`0`), `createdAt`/`updatedAt`(`now()`).

### Sorties d'erreur DB (oracles)
- Violation enum → erreur Postgres `22P02 invalid input value for enum`.
- Violation `coupons_code_unique` → `23505 unique_violation`.
- Violation `coupon_events_order_converted_unique` → `23505 unique_violation`.
- Violation NOT NULL → `23502 not_null_violation`.
- FK orpheline `createdBy`/`couponId`/`orderId` → `23503 foreign_key_violation` à l'insert ; à la suppression du parent → `SET NULL` (pas d'erreur).

---

## (c) Points de vérification PAR AXE

### Backend
- Migration `0080` applique proprement les 2 tables + 7 enums + 4 index/contraintes.
- `createId('cpn')` / `createId('cpe')` produisent des PK uniques, jamais collision.
- Insert/Select round-trip conserve types (entier, booléen, jsonb objet, timestamptz).
- `ON DELETE SET NULL` effectif sur `createdBy`, `coupon_events.couponId`, `coupon_events.orderId`.

### Frontend
- N/A direct (couche data). Vérifier indirectement que les types `$inferSelect` consommés en aval (PriceBlock, admin) compilent sans `any`.

### UI/UX
- N/A (pas de surface UI à ce niveau).

### Design / charte
- N/A visuel. Sémantique : pas de champ « countdown » ; `endsAt` est une date civile (charte : pas d'urgence).

### Data
- `eligibility` par défaut = objet vide `{}` (pas `null`, pas `[]`).
- `usageCount` démarre à `0`, jamais `null`.
- `holdoutPct` défaut `0` (Phase 1 : holdout=0).
- Idempotence converted : 2e insert même `orderId` rejeté.
- Code unique uniquement quand non-null : N coupons `auto` cohabitent.

### Sécurité / RBAC
- `visitorKey` est un **hash** — vérifier qu'aucune PII (email/téléphone) n'est jamais stockée en clair (test : pattern email/MSISDN absent).
- Pas d'exposition de `createdBy` PII hors admin (data-level : c'est un id admin, pas une PII client).

### Performance
- Index `coupons_status_type_idx` couvre la requête de résolution (statut=active, type).
- Index `coupon_events_coupon_phase_idx` couvre les agrégats stats (CPN-12).
- Insert d'event ne doit pas nécessiter de scan (append O(1) + maj index).

### Accessibilité
- N/A (data).

### i18n (fr/ar, درهم, RTL)
- `currency='MAD'` stocké comme code ISO neutre ; le formatage (درهم / DH) est fait en présentation, pas en DB.
- `label`/`code` peuvent contenir de l'UTF-8 arabe sans corruption (collation/encoding UTF-8).

### Observabilité / logs
- L'écriture d'un `coupon_event` est fire-and-forget (CPN-09) ; au niveau data, vérifier que l'échec d'insert event n'a aucune contrainte qui bloquerait une transaction commande.

---

## (d) Edge cases & matrice d'états

| État | Cas | Attendu |
|---|---|---|
| Nominal | Insert coupon `welcome_auto` complet | Ligne créée, défauts appliqués |
| Vide | `eligibility` omis | Défaut `{}` |
| Vide | `code` omis (auto) | `NULL`, accepté |
| Limite | `holdoutPct = 0` et `= 100` | Acceptés (bornes business hors DB) |
| Limite | `valueAmount = 0` | Accepté par DB (rejet métier en amont) |
| Invalide | `type='flash'` (hors enum) | `22P02` |
| Invalide | `status` omis | Défaut `draft` (pas d'erreur) |
| Invalide | `label` NULL | `23502` |
| Invalide | 2 coupons même `code='WELCOME'` | 2e → `23505` |
| Invalide | 2 coupons `code=NULL` | Tous acceptés (partiel) |
| Concurrence | 2 inserts converted concurrents même `orderId` | 1 gagne, l'autre `23505` |
| Concurrence | `usageCount` incrémenté en parallèle | Hors DB-constraint (géré applicatif CPN-09) — documenté |
| Cache | N/A | — |
| i18n | `label` arabe « هدية الترحيب » | Stocké/relu identique |
| a11y | N/A | — |
| Erreur réseau | N/A (data layer) | — |
| Suppression | `admin_users` supprimé | `createdBy → NULL` |
| Suppression | `coupons` supprimé | `coupon_events.couponId → NULL`, events conservés |
| Suppression | `orders` supprimé | `coupon_events.orderId → NULL` |

---

## (e) Risques

- **R-CPN-01-1** (rattaché au risque feature « contrainte unique manquante ») : absence/régression de `coupons_code_unique` partiel → doublons de codes → ambiguïté de résolution. Couvert par C001/U004.
- **R-CPN-01-2** : régression de l'idempotence converted → double comptage incrémentalité → décision business faussée (lien CPN-12). Couvert par C002/I001.
- **R-CPN-01-3** : divergence de forme dual-driver (memoryStore vs Drizzle) → tests verts en mémoire mais bug en prod. Couvert par U010/I004.
- **R-CPN-01-4** : `ON DELETE` mal câblé (CASCADE au lieu de SET NULL) → perte d'historique d'incrémentalité. Couvert par I002/I003.
- **R-CPN-01-5** : défaut `eligibility` `null` au lieu de `{}` → NPE dans le moteur de résolution (CPN-03). Couvert par U006.

---

## (f) Critères d'acceptation testables

- [ ] La migration `0080` s'applique sur base vierge sans erreur et crée `coupons`, `coupon_events`, les 7 enums et les 4 index/contraintes.
- [ ] Réappliquer la migration (état déjà migré) est un no-op (forward idempotent) — pas de double création.
- [ ] Insert valide d'un `welcome_auto` complet renvoie une `CouponRow` avec `status='draft'`, `target='product_price'`, `currency='MAD'`, `eligibility={}`, `usageCount=0`, `holdoutPct=0`, `stackable=false`, `priority=0` quand omis.
- [ ] Insert avec `type` hors enum est rejeté (`22P02`).
- [ ] Insert avec `label=null` est rejeté (`23502`).
- [ ] Deux coupons avec le même `code` non-null → 2e rejeté (`23505`).
- [ ] Deux (ou plus) coupons avec `code=null` → tous acceptés.
- [ ] Deux events `phase='converted'` même `orderId` → 2e rejeté (`23505`).
- [ ] Plusieurs events `phase='exposed'`/`'applied'` même `orderId` → tous acceptés.
- [ ] Suppression d'un coupon référencé met `coupon_events.couponId` à `NULL` et conserve l'event.
- [ ] Suppression d'un `admin_users` référencé met `coupons.createdBy` à `NULL`.
- [ ] `CouponRow.eligibility` est un objet (`typeof === 'object'`, non-null) après round-trip.
- [ ] La forme retournée par `memoryStore()` est structurellement identique (mêmes clés et types) à celle de Drizzle/PGlite pour `coupons` et `coupon_events`.
- [ ] Aucun champ ne stocke de PII en clair (email/téléphone) dans `coupon_events`.
- [ ] Les types `$inferSelect`/`$inferInsert` compilent et exposent la nullabilité attendue (test de typage `expectTypeOf`).
