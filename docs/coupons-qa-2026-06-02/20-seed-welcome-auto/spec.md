# CPN-20 — Seed du coupon `welcome_auto`

> Feature_id : **CPN-20** · Couche : **data** · Criticité : **P1**
> Risque principal (feature-inventory) : *Seed non idempotent / valeurs incohérentes*.
> Patterns de référence : registry des seeders `apps/web/src/lib/seeders/registry.ts` (+ `items/*.ts`, `types.ts`), scripts CLI `apps/web/scripts/seed-*.ts`, dual-driver `apps/web/src/lib/db/client.ts`, `createId('cpn')`.
> Aval direct : la résolution CPN-17 doit produire **199 MAD** une fois le seed appliqué.

---

## (a) Fonctionnement optimal — comportement attendu détaillé

Le seed `coupons-welcome-auto` insère (ou met à jour) **un unique** coupon `welcome_auto` qui sert de source à la promo `/kit` (Phase 1). Il suit le pattern Seeders Runner : un `SeederDescriptor` (`id`, `group: 'commerce'`, `label`, `description`, `estimatedDurationMs`, `idempotent: true`, `run`) enregistré dans `SEEDERS_REGISTRY`, déléguant à un script `runWelcomeCouponSeed(actorId)` exposé dans `apps/web/scripts/`.

### Valeurs exactes du coupon seedé
| Champ | Valeur | Justification |
|---|---|---|
| `type` | `welcome_auto` | source promo Phase 1 |
| `mode` | `auto` | auto-appliqué, pas de code |
| `code` | `null` | mode auto → pas de code |
| `valueKind` | `fixed_amount` | montant fixe |
| `valueAmount` | `9000` | -90 MAD (289 → 199) |
| `target` | `product_price` | remise sur le prix produit |
| `currency` | `MAD` | devise boutique |
| `status` | `active` | actif pour tout le trafic |
| `holdoutPct` | `0` | Phase 1 : pas de contrôle |
| `eligibility` | `{}` | tout le trafic |
| `stackable` | `false` | non cumulable |
| `usageScope` | `unlimited` | pas de plafond |
| `label` | « Geste d'accueil » | voix FemiGlow (rituel/accueil) |
| `priority` | (élevé, ex. `100`) | prime sur d'éventuels futurs coupons |

Cohérence avec la promo : `priceCents − valueAmount = 28900 − 9000 = 19900` → **199 MAD**, savings **90 MAD**.

### Idempotence (exigence centrale)
Le seed est **ré-entrant**. Clé d'idempotence : une **clé interne stable** (par convention `type='welcome_auto'` + `mode='auto'`, ou un `label`/identifiant interne dédié) — PAS le `id` aléatoire de `createId`, qui changerait à chaque run.

- **Store vide** → 1 INSERT (`inserted: 1, updated: 0`).
- **Re-run** (coupon déjà présent) → 0 INSERT, UPSERT des valeurs vers la référence (`inserted: 0, updated: 0|1`). **Jamais** un second coupon `welcome_auto`.
- **Coupon dérivé manuellement** (ex. admin a changé `valueAmount`) → le seed **remet** les valeurs de référence (reproductibilité), ou les préserve selon la politique documentée. Politique retenue : **remettre la référence** (le seed est la source de vérité Phase 1) tout en **préservant le `status`** si l'admin l'a explicitement mis en pause (ne pas réactiver de force un coupon mis en pause). [À confirmer en revue ; testé dans les deux variantes.]

### Reproductibilité
Pour un même état de départ, deux exécutions produisent le **même état final** (mêmes valeurs métier). Le `id` peut différer entre deux bases neuves (createId), mais la **forme métier** et l'**unicité** sont garanties.

---

## (b) Contrats I/O

### Entrée
```ts
runWelcomeCouponSeed(actorId: string | null): Promise<{ inserted: number; updated: number; couponId: string }>
// + adaptateur SeederDescriptor.run(ctx: SeederContext): Promise<SeederResult>
```

### Sortie `SeederResult` (via descriptor)
```ts
{ stats: { inserted: number; updated: number }, summary: string }
// ex. summary: "Geste d'accueil (welcome_auto) prêt — -90 MAD"
```

### Invariants
- Après seed : **exactement un** coupon `type='welcome_auto' AND mode='auto'` en base.
- `count(coupons WHERE type='welcome_auto') === 1` après N runs (N ≥ 1).
- Le coupon seedé satisfait toutes les valeurs exactes du tableau (a).
- `idempotent === true` dans le descriptor → pas de modale de confirmation côté UI.
- `actorId` est tracé dans `createdBy` (FK admin, nullable si seed via boot).

---

## (c) Points de vérification PAR AXE

### Backend
- `run()` enregistré dans `SEEDERS_REGISTRY` (groupe `commerce`), id stable (`coupons-welcome-auto`).
- Détection d'existant par clé interne (pas par `id` aléatoire).
- Round-trip dual-driver : seed via `memoryStore()` et via Drizzle/PGlite produit le même état.
- `createId('cpn')` utilisé pour le PK au premier insert uniquement.

### Frontend
- Le seeder apparaît dans l'UI `/admin/settings/seeders` avec label/description en voix FemiGlow ; `idempotent:true` → pas d'alerte destructive.

### UI/UX
- `summary` lisible, sans jargon, sans « promo/deal ».

### Design / charte
- `label` « Geste d'accueil » et `summary` respectent la voix (rituel/maison/accueil), pas de « -90 % flash », pas d'emoji.

### Data
- `valueAmount=9000`, `currency='MAD'`, `eligibility={}`, `holdoutPct=0`, `status='active'`.
- Pas de doublon après re-run (invariant unicité).
- `code` reste `null` (sinon collision avec la contrainte unique partielle CPN-01).

### Sécurité / RBAC
- Exécution réservée aux rôles autorisés à lancer les seeders (cohérent avec la route admin existante).
- `actorId` audité.

### Performance
- `estimatedDurationMs` ~600 ms (1 upsert + revalidate éventuel). O(1).

### Accessibilité
- N/A (data/admin) ; hérite de l'accessibilité de l'écran seeders.

### i18n (fr/ar, درهم, RTL)
- `label`/`summary` en français (interne admin) ; la valeur 9000 → savings « 90 درهم » / « 90 DH » est calculée en présentation, pas stockée.

### Observabilité / logs
- Émission des events seeder (`seeder.start/complete`) ; `stats` distingue inserted vs updated pour diagnostiquer la (non-)idempotence.

---

## (d) Edge cases & matrice d'états

| État | Cas | Attendu |
|---|---|---|
| Nominal | store vide | 1 coupon créé, valeurs exactes, status=active |
| Nominal | re-run après 1er seed | 0 nouveau coupon, count reste 1 |
| Limite | 3 runs consécutifs | count(welcome_auto)===1 |
| Vide | actorId=null (boot) | seed OK, createdBy=null |
| Invalide | coupon welcome_auto pré-existant avec valueAmount altéré (8000) | seed remet 9000 (référence) |
| Invalide | coupon pré-existant status=paused (admin) | politique : status préservé (pas réactivé de force) — testé |
| Concurrence | 2 seeds en parallèle store vide | un seul coupon final (upsert/clé interne) |
| Cache | N/A | — |
| i18n | label arabe non requis | label FR interne |
| a11y | N/A | — |
| Erreur réseau | N/A (local) | — |
| Aval | après seed, resolveProductPricing | 19900 (199 MAD), source=coupon |

---

## (e) Risques

- **R-CPN-20-1** (= risque feature « non idempotent ») : re-run crée un 2e `welcome_auto` → deux coupons candidats → résolution ambiguë → mismatch prix. Couvert par U002/U003/I001.
- **R-CPN-20-2** (« valeurs incohérentes ») : seed avec `valueAmount` ≠ 9000 → prix ≠ 199 → écart caisse. Couvert par U001/I002.
- **R-CPN-20-3** : seed pose un `code` non-null → collision unique CPN-01 / coupon traité comme code. Couvert par U005.
- **R-CPN-20-4** : détection d'existant par `id` aléatoire → idempotence impossible. Couvert par U002.
- **R-CPN-20-5** : seed réactive de force un coupon mis en pause par l'admin → rollback admin annulé. Couvert par U007.

---

## (f) Critères d'acceptation testables

- [ ] Sur store vide, le seed insère exactement 1 coupon `welcome_auto` (`stats.inserted===1`).
- [ ] Le coupon seedé a `type='welcome_auto'`, `mode='auto'`, `code=null`, `valueKind='fixed_amount'`, `valueAmount=9000`, `target='product_price'`, `currency='MAD'`, `status='active'`, `holdoutPct=0`, `eligibility={}`, `stackable=false`, `usageScope='unlimited'`.
- [ ] Re-run du seed ne crée aucun nouveau coupon (`stats.inserted===0`) et `count(welcome_auto)===1`.
- [ ] Trois runs consécutifs laissent `count(welcome_auto)===1`.
- [ ] La détection d'existant repose sur une clé interne stable (type+mode ou label), pas sur le `id` aléatoire.
- [ ] Si un `welcome_auto` pré-existe avec `valueAmount=8000`, le seed le remet à `9000` (référence).
- [ ] Le seed ne pose jamais de `code` non-null sur le coupon auto.
- [ ] Politique pause : si l'admin a mis le coupon en `paused`, un re-run ne le réactive pas de force (status préservé).
- [ ] Après seed, `resolveProductPricing(variant, ctx)` renvoie `effectivePriceCents=19900` avec `source='coupon'` (savings 9000).
- [ ] Le seeder est enregistré dans `SEEDERS_REGISTRY` avec `idempotent:true` et un `id` stable.
- [ ] Le seed fonctionne identiquement via `memoryStore()` et via Drizzle/PGlite (même état final).
- [ ] `actorId` fourni est tracé dans `createdBy` ; `null` accepté (seed boot).
