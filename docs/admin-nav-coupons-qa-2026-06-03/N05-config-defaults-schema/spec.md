# N05 — `navDefault` × `navSchema` (intégrité des defaults de navigation)

## Rôle & surface
Filet de sécurité structurel de toute la cascade nav : la constante `navDefault`
(`apps/web/src/lib/admin-config/defaults.ts`) sert à la fois de **valeur initiale** (DB absente),
de **failsafe** (DB corrompue, cf. N06) et de **référence du badge `isDefault`**. Si elle ne valide
pas `navSchema` (`apps/web/src/lib/admin-config/schemas.ts`), tout l'édifice s'écroule en silence : un
failsafe invalide ne se révèle qu'en prod. On verrouille donc, par test pur (couche **U**), que
`navDefault` est conforme au schéma, que ses clés sont uniques, que `coupons` est présent à la bonne
place, et que les positions sont monotones 0..n−1. Aucun mock, aucun réseau.
Fichier cible : `src/lib/admin-config/nav-config.test.ts` (nouveau).

## Fonctionnement optimal (ce qui DOIT se passer)
- `navSchema.safeParse(navDefault).success === true` : les 11 items passent `navItemSchema` strict.
- **Clés uniques** : aucune clé dupliquée (le `superRefine` de `navSchema` ajoute une issue
  `Clé "<k>" dupliquée.` sinon). `navDefault` doit avoir 11 clés distinctes.
- **`coupons` présent** : un item `{ key:'coupons', label:'Coupons', href:'/admin/coupons', icon:'tag',
  position:9 }` existe (NAV-INV-CONFIG / NAV-INV-PRESENCE côté config).
- **Positions monotones** : pour tout `i`, `items[i].position === i` (0,1,2,…,10) — strictement
  croissantes, sans trou ni doublon. C'est l'ordre rendu dans la sidebar.
- **Contraintes par champ** (constantes du schéma, à documenter dans les assertions) :
  - `key` : `KEY_REGEX = /^[a-z][a-z0-9-]*/` (kebab-case, commence par une lettre minuscule).
  - `label` : `min(1).max(40)`.
  - `href` : `/^\/[A-Za-z0-9/_-]*$/` (commence par `/`).
  - `icon` : `min(1)`.
  - `position` : `number().int().min(0)`.
  - `requiresRole?` : `enum(['editor','admin','superadmin'])` optionnel (seul `settings` le porte,
    valeur `admin`).
  - objets **`.strict()`** : toute clé inconnue dans un item OU dans le wrapper → échec.
  - tableau `items` : `.max(20)`.

## Contrat I/O
- **Entrées** : import direct de `navDefault`, `getDefault('nav')`, `navSchema`, `navItemSchema`.
- **Sortie observée** : booléen `.success` + `.error.issues` (pour les variantes négatives), longueurs,
  égalités d'index. Aucun effet de bord.

## Cas limites & non-happy-path
- **Doublon de clé** (fixture `dupKey`) : deux items `dashboard` → `safeParse` échoue avec une issue
  message `Clé "dashboard" dupliquée.` (vérifie que le `superRefine` est bien câblé).
- **Clé non kebab** (`Leads`, `lead_x`, `1lead`) → issue `Clé invalide (kebab-case).`.
- **href sans `/` initial** (`admin/x`) → issue `href doit commencer par /.`.
- **label vide** / **label > 40 car.** → échec `min`/`max`.
- **position non entière** (`1.5`) / **négative** (`-1`) → échec `int`/`min(0)`.
- **clé inconnue** dans un item (`{ …, extra:true }`) → échec `.strict()`.
- **`> 20` items** → échec `.max(20)`.
- **`requiresRole` hors enum** (`viewer`) → échec enum (NB : `viewer` n'est PAS une valeur valide ici,
  bien qu'il existe en RBAC — frontière à documenter).
- **positions non monotones** dans une variante (`[0,1,3]`) : le **schéma** l'accepte (positions
  arbitraires ≥0), mais l'**invariant N05** exige `position===index` sur `navDefault` réel ⇒ test
  d'invariant séparé du test de schéma.

## Invariants couverts
- **NAV-INV-CONFIG** : `navDefault` valide `navSchema` ; clés uniques ; `coupons` présent.
- **NAV-INV-PRESENCE** (côté config) : item `coupons` libellé « Coupons », href `/admin/coupons`.
- Pré-condition de **NAV-INV-FAILSAFE** (N06) : un failsafe invalide est impossible si N05 est vert.

## Critères d'acceptation (observables)
- `navSchema.safeParse(navDefault).success === true`.
- `new Set(navDefault.items.map(i=>i.key)).size === navDefault.items.length` (= 11).
- `navDefault.items.find(i=>i.key==='coupons')` matche `{label:'Coupons', href:'/admin/coupons',
  icon:'tag', position:9}`.
- `navDefault.items.every((i,idx)=>i.position===idx)` true ; positions = `[0..10]`.
- `getDefault('nav') === navDefault` (la fabrique retourne bien la même référence).
- Chaque fixture négative (`dupKey`, `badKey`, `badHref`, `emptyLabel`, `floatPos`, `extraField`,
  `tooMany`, `badRole`) → `safeParse(...).success === false`, avec le message d'issue attendu.

## Points à vérifier — tous points de vue
- Backend : `navSchema` est bien le schéma branché dans `sectionSchemas.nav` (même objet).
- Frontend : l'ordre `position` = ordre de rendu sidebar (cohérence avec `AdminShell`, dette N00).
- UI/UX : libellés FR exacts, `coupons` icône `tag`.
- Data : `getDefault('nav')` renvoie la constante (pas une copie altérée).
- A11y : N/A (test pur).
- i18n : labels FR figés ici ; AR/EN gérés ailleurs (pas dans les defaults TS).
