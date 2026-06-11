# CPN-14 — `CouponWelcomeNote` (note d'accueil landing `/kit`)

> Périmètre : composant **à créer** `apps/web/src/components/sections/CouponWelcomeNote.tsx`,
> inséré dans `PriceBlock.tsx` **après** le bandeau économie (`data-testid="pack-savings-badge"`)
> et **avant** `ValueBreakdownList` (bloc 4).
> Point de vue **visiteur**. Criticité **P1** (perception de marque + clarté du prix),
> avec deux exigences **P0** héritées : (1) **zéro flash** (rendu serveur, props, pas de fetch
> client) et (2) **respect strict de la charte** (jamais de signal « retail »).
> Le module **s'adosse à la preuve** déjà présente (note 4,8/5, avis, livraison offerte,
> retour 30 j) — il ne crée pas une seconde histoire de prix, il scénarise le -90 MAD existant
> en « geste d'accueil ». Cf. `docs/coupon-auto-appliqué.md` §« guidelines d'intégration ».

---

## (a) Fonctionnement optimal

### Rendu

`CouponWelcomeNote` est un **module éditorial calme** qui vit dans la zone prix/CTA de
la section « Le Pack ». Il ressemble à une **note de maison**, pas à un sticker promo :
fond crème, texte encre, un **filet fin** (hairline) sauge/champagne en marqueur discret,
pas de pastille colorée, pas d'icône criarde, pas d'animation.

Structure visuelle (de haut en bas) :

1. **Accroche** (1 ligne, ton encre) : « Votre geste d'accueil est appliqué. »
2. **Bénéfice** (1 ligne, ton encre/soft) : « 90 MAD offerts sur votre première commande du pack. »
3. **Prix final** (1 ligne, accent typographique sobre — poids medium, PAS de couleur retail) :
   « Prix final aujourd'hui : 199 MAD »
4. **Conditions** (microcopy fine, encre atténué) : « Valable jusqu'au [date civile]. Hors cumul. »
5. **Porte d'invitation** repliée (`<details>`) : « J'ai un code d'invitation » — **INERTE en Phase 1**
   (spécifiée et testée séparément dans **CPN-15**, le présent dossier vérifie seulement sa
   **présence repliée par défaut** et qu'elle ne perturbe pas la note).

> La date `[date civile]` est rendue depuis `coupon` (dérivée de `endsAt`) au **format civil
> localisé** (fr : « 30 juin 2026 » ; ar : « ٣٠ يونيو ٢٠٢٦ ») — **jamais** un compte à rebours,
> jamais une durée relative (« plus que 2 jours »).

### Conditions d'affichage (gate unique)

Le module est rendu **si et seulement si** :

```
coupon != null
&& coupon.bucket === 'treatment'
&& coupon.type === 'welcome_auto'
```

Dans **tous** les autres cas, le composant **ne rend RIEN** (`return null`) — il ne laisse
ni wrapper vide, ni espace réservé, ni filet orphelin :

- `coupon == null` (pas de coupon résolu) → masqué.
- `coupon.bucket === 'holdout'` → masqué (le groupe contrôle ne voit jamais la note).
- `coupon.type !== 'welcome_auto'` (ex. `rescue`, `manual_code`) → masqué en Phase 1.

> Le bucketing (`treatment`/`holdout`) est figé **en amont serveur** (CPN-04/CPN-19) ; le
> composant ne décide rien, il **lit** `coupon.bucket`. C'est ce qui garantit l'absence de flash.

### Provenance des données (SSR strict)

Le coupon résolu (`ResolvedPricing.coupon`) est **passé en props** depuis le rendu serveur de
`/kit` → `PriceBlock` → `CouponWelcomeNote`. Le composant **ne fait AUCUN fetch client**, n'a
**aucun `useEffect` de chargement**, **aucun état asynchrone**. Tout le contenu (textes, prix
final, date) est calculable au premier rendu serveur. Conséquence testable : le HTML envoyé par
le serveur contient déjà la note finale → **pas de hydration mismatch, pas de flash**.

---

## (b) Contrats I/O

### Props

```ts
/**
 * Sous-ensemble de ResolvedPricing.coupon nécessaire à l'affichage.
 * Tout est résolu serveur ; aucune valeur n'est calculée client-side.
 */
export interface ResolvedCouponView {
  id: string;
  type: 'welcome_auto' | 'rescue' | 'email_unlock' | 'manual_code' | 'post_purchase';
  mode: 'auto' | 'code';
  bucket: 'treatment' | 'holdout';
}

export interface CouponWelcomeNoteProps {
  /** Coupon résolu serveur (ResolvedPricing.coupon). `null` => composant masqué. */
  coupon: ResolvedCouponView | null;
  /** Remise en centimes (ex. 9000 = 90 MAD). Affichée dans la ligne bénéfice. */
  discountCents: number;
  /** Prix final TTC après coupon, en centimes (ex. 19900 = 199 MAD). */
  finalPriceCents: number;
  /** Devise ISO de la variante (ex. 'MAD'). Affichage adapté ar (درهم). */
  currency: string;
  /** Fin de validité (date civile). Formatée localisée, jamais un timer. `null` => ligne "Valable…" omise mais "Hors cumul." conservé. */
  endsAt: string | Date | null;
}
```

> `PriceBlock` reste un Client Component (IntersectionObserver), mais `CouponWelcomeNote`
> **ne dépend que de ses props** : pas de `usePathname` interne pour la donnée — il reçoit
> `currency` ; la locale active (fr/ar) est dérivée du contexte i18n déjà disponible (même
> source que le reste de `PriceBlock`). Le composant doit être **rendable côté serveur**
> (aucune API navigateur au montage).

### Invariants

- **INV-14-1 (gate exacte)** : rend du contenu ⇔ `coupon?.bucket==='treatment' && coupon?.type==='welcome_auto'`. Sinon `null`.
- **INV-14-2 (textes exacts)** : les 4 lignes reproduisent **mot pour mot** la copie de charte (voir fixtures), ponctuation comprise, **sans** point d'exclamation ajouté, **sans** emoji.
- **INV-14-3 (prix cohérent)** : le prix final affiché == `finalPriceCents/100` formaté selon la locale + devise ; aucune divergence avec le prix XXL du `PriceBlock`.
- **INV-14-4 (date civile)** : `endsAt` rendu au format date civil localisé ; **aucun** élément de compte à rebours, **aucune** durée relative.
- **INV-14-5 (no-flash)** : aucun fetch/`useEffect` de données ; le HTML serveur est déjà final ; pas de hydration mismatch.
- **INV-14-6 (charte)** : aucun token interdit (rouge retail, jaune discount), pas d'`animation`/`countdown`/`emoji`/`!` superflu ; tokens autorisés uniquement (crème/encre/sauge/champagne), filet fin.
- **INV-14-7 (a11y)** : structure sémantique cohérente (note groupée, hiérarchie de texte non trompeuse), contraste AA, 0 violation axe-core sérieuse/critique.

---

## (c) Points de vérification par axe

### Frontend (logique de rendu)
- Gate `treatment + welcome_auto` strictement appliquée (matrice §d) — tous les autres cas → `null`.
- Aucune valeur dérivée d'un appel réseau ; props → rendu pur.
- Insertion DANS `PriceBlock` au bon emplacement : DOM-après `pack-savings-badge`, DOM-avant le premier item de `ValueBreakdownList`.
- Idempotence visuelle : re-render avec mêmes props → DOM identique (pas de timestamp, pas d'aléa).

### UI/UX (visiteur)
- La note se lit comme une **invitation**, pas comme une alerte : densité faible, une idée par ligne.
- Le **prix final** est immédiatement lisible et concordant avec le prix XXL (pas de second prix contradictoire).
- Le module **n'écrase pas** le CTA : il reste subordonné au CTA primaire (hiérarchie visuelle, pas de bouton concurrent).
- Sur mobile, la note tient sans débordement ni troncature ; sur desktop, elle reste alignée au bloc prix (`max-w-md`).

### Design / charte (DÉTAILLÉ — non négociable)
Tokens de référence (`apps/web/src/styles/tokens.css`) :
`--color-creme:#FBF8F1`, `--color-creme-warm:#F5EFE3`, `--color-encre:#2C2A28`,
`--color-encre-soft:#4A4744`, `--color-sauge:#C5DBC4`, `--color-sauge-dark:#4F6D52`,
`--color-champagne:#C8A876`, `--color-champagne-dark:#7A5F38`.

- **Fond** : crème (`bg-creme` / `bg-creme-warm`) ou transparent sur fond crème de section — **jamais** de fond saturé.
- **Texte** : encre (`text-encre`) pour l'accroche/prix ; encre-soft / `text-encre/65` pour les conditions.
- **Accent** : sauge ou champagne **parcimonieux** (filet, soulignement discret du « 199 MAD » au plus). **Pas** d'aplat coloré plein largeur.
- **Filet fin** : bordure hairline (`border-t border-sauge/30` ou équivalent ≤ 1 px) ; **pas** d'ombre portée tape-à-l'œil.
- **Rayon** : angles **discrets** (`rounded-sm`/`rounded` max) — **interdit** : `rounded-2xl`/`rounded-3xl`/`rounded-full` sur le conteneur (pas de « pilule sticker »).
- **INTERDITS (assertions d'ABSENCE)** :
  - aucune couleur **rouge retail** (familles `text-red-*`/`bg-red-*`, `#FF0000`, `#E0245E`, hex à dominante rouge saturée) ;
  - aucun **jaune discount** (`bg-yellow-*`, `#FFEB3B`, `#FFD600`) ;
  - aucun **countdown / compte à rebours** (pas de `data-countdown`, pas de timer, pas de `setInterval`, pas de texte « plus que … », « expire dans … ») ;
  - aucun **emoji** (plage Unicode emoji) dans le texte rendu ;
  - **pas** de point d'exclamation (la copie de charte n'en contient aucun) ;
  - aucune **animation agressive** (`animate-bounce`, `animate-pulse`, `animate-ping`, blink) ;
  - aucun **angle arrondi massif** (cf. ci-dessus).

### Accessibilité (DÉTAILLÉ)
- **Structure sémantique** : la note est un groupe lisible de haut en bas par un lecteur d'écran ; pas de heading qui casserait l'outline de la page (au plus un `role`/`aria-label` descriptif neutre, ex. note d'information). Le « 199 MAD » ne doit pas être annoncé comme un titre.
- **Contraste** : encre `#2C2A28` sur crème `#FBF8F1` ⇒ ratio ≈ 12,8:1 (≥ AAA) ; encre-soft `#4A4744` sur crème ⇒ ≈ 8,9:1 (≥ AAA). La microcopy fine reste ≥ 4,5:1 (AA texte normal). Le champagne-dark `#7A5F38` sur crème ⇒ ≈ 4,9:1 (AA OK) — interdit d'utiliser `champagne` clair (`#C8A876`) comme couleur de texte porteuse d'information.
- **axe-core** : 0 violation `serious`/`critical` sur `/kit` avec la note affichée (et avec la note absente — pas de régression introduite).
- **Pas d'information portée par la couleur seule** : la nature « offre » est portée par le **texte**, pas par une couleur.
- **Ordre de lecture / focus** : la note n'introduit aucun piège de focus ; le seul élément focusable est le `<summary>` de la porte d'invitation (cf. CPN-15) et il vient **après** la lecture de la note, **avant** le CTA n'est pas perturbé.

### i18n (fr / ar / RTL)
- **fr** : devise rendue « MAD » ; prix « 199 MAD » ; date « 30 juin 2026 » ; textes français exacts.
- **ar** : devise rendue « درهم » (cohérent avec `PriceBlock` qui mappe MAD→درهم sur `/ar`) ; direction **RTL** (`dir="rtl"` sur l'arbre `/ar`) ; chiffres + date au format civil arabe ; textes arabes exacts (voir fixtures `ar`).
- **Pas de concaténation cassée** : le montant et la devise restent un groupe insécable ; en RTL, l'ordre visuel reste correct (devise du bon côté).
- Aucune chaîne en dur non traduite ; les 4 lignes proviennent du dictionnaire i18n.

### Performance / SSR (pas de flash)
- Le composant est **rendu serveur** ; le HTML initial contient déjà la note complète (texte + prix + date).
- **Aucun** `useEffect`/`fetch`/state asynchrone modifiant le contenu après hydratation → **pas** de saut de mise en page (CLS ≈ 0 pour ce bloc), **pas** de flash « note qui apparaît ».
- Coût négligeable : pur texte, aucune image, aucun JS au montage (hors `<details>` natif).

### Observabilité (tracking exposé)
- L'exposition de la note **peut** émettre un event d'affichage (ex. `coupon_welcome_note_view` avec `{ coupon_id, bucket, type }`) **sans** PII et **sans** bloquer le rendu. Le test vérifie que, **si** un event est exposé, il porte `bucket:'treatment'` et `type:'welcome_auto'` et **n'est jamais** émis quand la note est masquée (holdout / pas de coupon). La journalisation `exposed` côté serveur reste gérée par CPN-09 ; ici on vérifie seulement l'event UI **si présent**.

---

## (d) Edge cases & matrice d'états

| # | coupon | bucket | type | date `endsAt` | locale | device | Attendu |
|---|---|---|---|---|---|---|---|
| 1 | présent | treatment | welcome_auto | proche (futur) | fr | mobile | **Note affichée**, textes fr exacts, « 199 MAD », date civile fr |
| 2 | présent | treatment | welcome_auto | proche (futur) | ar | desktop | **Note affichée**, textes ar exacts, « درهم », RTL, date civile ar |
| 3 | présent | **holdout** | welcome_auto | — | fr | mobile | **Masquée** (`null`) |
| 4 | présent | treatment | **rescue** | — | fr | desktop | **Masquée** (`null`) |
| 5 | présent | treatment | **manual_code** | — | fr | mobile | **Masquée** (`null`) |
| 6 | **null** | — | — | — | fr | desktop | **Masquée** (`null`) |
| 7 | présent | treatment | welcome_auto | **lointaine** | fr | desktop | Note affichée ; date lointaine civile, **pas** de durée relative |
| 8 | présent | treatment | welcome_auto | **null** | fr | mobile | Note affichée ; ligne « Valable… » omise, « Hors cumul. » conservé |
| 9 | présent | treatment | welcome_auto | proche | ar | mobile | RTL + chiffres arabes ; pas de débordement |
| 10 | présent | treatment | welcome_auto | proche | fr | desktop | `discountCents=9000` → « 90 MAD offerts » ; cohérence prix XXL |
| 11 | présent | treatment | welcome_auto | proche | fr | mobile | **Charte** : 0 token interdit, filet fin présent, pas d'emoji/`!` |
| 12 | présent | treatment | welcome_auto | proche | fr | mobile | **SSR** : HTML serveur déjà final, pas de hydration mismatch |
| 13 | présent | treatment | welcome_auto | proche | fr | desktop | **a11y** : axe-core 0 violation serious/critical, contraste AA |
| 14 | présent | treatment | welcome_auto | borne aujourd'hui | fr | mobile | date == aujourd'hui rendue en civil (pas « expire maintenant ») |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-14-1 | Note affichée au groupe **holdout** | Biaise la mesure d'incrémentalité (CPN-12) + contamine le contrôle | INV-14-1 + cas #3 (I) |
| R-14-2 | Note affichée pour un type ≠ welcome_auto | Message « geste d'accueil » incohérent | INV-14-1 + cas #4/#5 (I) |
| R-14-3 | **Flash** (note qui apparaît après hydratation / fetch client) | Casse l'effet « maison », perçu comme pub injectée | INV-14-5 + cas #12 (I) + E (no-flash) |
| R-14-4 | Dérive de **charte** (rouge/jaune/countdown/emoji/sticker) | Déclasse la marque (signal retail) | INV-14-6 + cas #11 (I+V) + axe palette |
| R-14-5 | **Prix final divergent** du prix XXL | Confusion, perte de confiance, risque de doute prix | INV-14-3 + cas #10 (I) + E |
| R-14-6 | **Countdown / durée relative** au lieu de date civile | Urgence agressive interdite par charte | INV-14-4 + cas #7/#14 (I) |
| R-14-7 | Texte **inexact** (ponctuation, `!`, reformulation) | Voix maison cassée | INV-14-2 + oracle texte exact (I) |
| R-14-8 | **RTL cassé** / devise latine sur `/ar` | i18n défaillant, illisible en arabe | INV-14-2 + cas #2/#9 (I) + V ar |
| R-14-9 | **a11y** : prix annoncé comme heading / contraste insuffisant | Lecteur d'écran trompé, non-conformité | INV-14-7 + cas #13 (A) |
| R-14-10 | Wrapper **vide** rendu quand masqué (filet orphelin, espace) | Décalage visuel, CLS | INV-14-1 + assertion DOM vide (I) |

---

## (f) Critères d'acceptation testables

- **AC-14-1** : `coupon={bucket:'treatment',type:'welcome_auto'}` → la note est rendue avec les **4 lignes exactes** (fr) et le prix « 199 MAD ».
- **AC-14-2** : `coupon.bucket='holdout'` → `container.firstChild === null` (rien rendu, pas de wrapper).
- **AC-14-3** : `coupon.type='rescue'` (treatment) → rien rendu. Idem `manual_code`.
- **AC-14-4** : `coupon=null` → rien rendu.
- **AC-14-5** : le texte rendu **ne contient aucun** caractère emoji ni point d'exclamation.
- **AC-14-6** : le sous-arbre rendu **ne contient aucune** classe/inline-style rouge retail (`red-`, `#FF`, rgb rouge saturé) ni jaune discount (`yellow-`, `#FFEB3B`).
- **AC-14-7** : aucun élément de compte à rebours (pas de `setInterval`, pas de nœud `[data-countdown]`, pas de texte « plus que »/« expire dans »).
- **AC-14-8** : présence d'un **filet fin** (bordure ≤ 1 px, token sauge/champagne) et **absence** de `rounded-2xl|3xl|full` sur le conteneur.
- **AC-14-9** : le HTML produit par un rendu **serveur** (`renderToString`) contient déjà « Prix final aujourd'hui : 199 MAD » → no-flash ; aucun `useEffect` de chargement présent.
- **AC-14-10** : sur `/ar`, devise rendue « درهم », `dir` RTL effectif, et les 4 lignes correspondent aux textes arabes exacts (fixtures).
- **AC-14-11** : `endsAt` rendu au **format civil** localisé (fr « 30 juin 2026 », ar équivalent) ; jamais une durée relative.
- **AC-14-12** : `endsAt=null` → ligne « Valable jusqu'au … » omise, « Hors cumul. » toujours présent.
- **AC-14-13** : axe-core renvoie **0 violation** `serious`/`critical` sur `/kit` note affichée ; le « 199 MAD » n'est pas exposé en `role=heading`.
- **AC-14-14** : régression **visuelle** Playwright `toHaveScreenshot` stable pour 4 vues : mobile fr, desktop fr, mobile ar (RTL), desktop ar (RTL).
- **AC-14-15** : la note est rendue dans le DOM **après** `[data-testid="pack-savings-badge"]` et **avant** la `ValueBreakdownList`.
- **AC-14-16** : la porte « J'ai un code d'invitation » est présente et **repliée par défaut** (détail vérifié exhaustivement en CPN-15).
- **AC-14-17** : l'event d'affichage (si émis) porte `{bucket:'treatment',type:'welcome_auto'}` et **n'est jamais émis** en holdout / sans coupon.
