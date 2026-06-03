# CPN-15 — Porte « J'ai un code d'invitation » (disclosure)

> Périmètre : la porte discrète repliée, sous-élément de `CouponWelcomeNote`
> (`apps/web/src/components/sections/CouponWelcomeNote.tsx`), rendue via un
> `<details><summary>J'ai un code d'invitation</summary>…</details>`.
> Point de vue **visiteur**. Criticité **P1** (anti-friction + accessibilité).
> **INERTE en Phase 1** : la porte s'ouvre/se ferme, mais ne soumet rien — aucun
> coupon manuel n'est appliqué en Phase 1. Le but UX est d'offrir une **porte de
> sortie discrète** pour la minorité porteuse d'un code, **sans** interrompre la
> décision de la majorité (la copie « auto-appliqué » fait le travail).
> Cf. `docs/coupon-auto-appliqué.md` §« un module inline calme … garde une porte
> discrète pour les codes manuels ».

---

## (a) Fonctionnement optimal

### Rendu & état initial

- La porte est un `<details>` **fermé par défaut** : `summary` visible (« J'ai un code
  d'invitation »), contenu **non rendu visible** au chargement. **Jamais** de champ texte
  ouvert au premier paint (anti-friction : on n'invite pas à chercher un code).
- Le `summary` est stylé comme un **lien discret** (texte encre atténué, soulignement fin
  au survol/focus), **pas** comme un bouton criard, **pas** comme un CTA concurrent.
- La porte est **subordonnée** à la note : elle vit en bas du module, après les conditions,
  et **n'attire pas l'œil** plus que le prix final ou le CTA principal.

### Comportement (Phase 1)

- **Clic / activation clavier** sur le `summary` → le `<details>` s'ouvre (`open=true`),
  révélant le contenu replié. Re-clic → se referme.
- Le contenu révélé en Phase 1 est **INERTE** : il EXPLIQUE, il ne traite pas. Deux options
  acceptables (à figer à l'implémentation, l'**option A est recommandée**) :
  - **Option A (recommandée)** : pas de champ de saisie du tout — un court texte « Votre
    avantage est déjà appliqué automatiquement. » (aucune action, zéro promesse de
    soumission). C'est l'option la plus sobre et la plus sûre (rien à désactiver, rien à
    soumettre par erreur).
  - **Option B (si un champ doit préexister pour Phase 2)** : un champ + bouton **présents
    mais désactivés** (`disabled`, `aria-disabled="true"`), avec une note expliquant que la
    saisie manuelle ouvrira plus tard. Aucune soumission possible, aucune requête réseau.
- Dans **les deux** options : **aucune** soumission réelle, **aucun** appel réseau,
  **aucune** application de coupon en Phase 1.

### Indépendance vis-à-vis du CTA

- Ouvrir/fermer la porte **ne déplace pas** le CTA hors de l'écran de façon disruptive sur
  mobile au point de le rendre inaccessible, et **ne modifie pas** son état ni son libellé.
- La porte **n'est pas** dans l'ordre de tabulation **avant** la lecture de la note ; elle
  vient après les conditions, **avant** le CTA n'est pas perturbé dans son rôle dominant.

---

## (b) Contrats I/O

La porte n'a pas de props propres en Phase 1 (sous-composant interne de `CouponWelcomeNote`).
Comportement piloté par l'élément natif `<details>`. Constantes de copie :

```ts
const INVITATION_SUMMARY = "J'ai un code d'invitation";        // fr
// Option A
const INVITATION_BODY_PHASE1 = "Votre avantage est déjà appliqué automatiquement.";
// Option B (si champ présent)
const INVITATION_FIELD_DISABLED = true;  // toujours true en Phase 1
```

### Invariants

- **INV-15-1 (fermé par défaut)** : au premier rendu, `details.open === false` ; le contenu
  n'est pas visible ; **aucun** champ de saisie n'est focusable/ouvert au chargement.
- **INV-15-2 (ouverture sur activation)** : clic OU `Enter`/`Espace` sur le `summary` →
  `details.open === true` ; re-activation → `false`. Toggling natif fiable.
- **INV-15-3 (inerte)** : aucune soumission, aucun appel réseau, aucune application de coupon
  quelle que soit l'interaction Phase 1 (Option A : pas de champ ; Option B : champ `disabled`).
- **INV-15-4 (a11y disclosure)** : `summary` exposé comme contrôle de divulgation natif
  (relation summary↔contenu), `aria-expanded` reflète l'état (false fermé / true ouvert),
  focusable au clavier, indicateur de focus visible.
- **INV-15-5 (charte)** : `summary` rendu comme **lien discret** (encre atténué, pas de fond
  plein, pas de couleur criarde, pas d'emoji, pas de `!`), cohérent avec la note.
- **INV-15-6 (non-perturbation CTA)** : ouvrir/fermer la porte ne change ni l'état ni le
  libellé du CTA primaire et ne le retire pas du DOM.
- **INV-15-7 (i18n)** : `summary` et contenu proviennent du dictionnaire fr/ar ; en `/ar`,
  rendu RTL, texte arabe, chevron/indicateur du bon côté.

---

## (c) Points de vérification par axe

### Frontend (état & comportement)
- État initial **fermé** garanti (pas de `open` codé en dur, pas de `defaultOpen`).
- Toggle via clic ; toggle via clavier (`Enter`, `Espace`) sur le `summary` focalisé.
- Phase 1 : aucun handler de soumission actif ; pas de `<form onSubmit>` qui partirait ;
  Option B : `disabled` strict sur input + bouton (impossible de focus/soumettre).
- Le contenu n'est monté/visible **qu'après** ouverture (`<details>` natif).

### UI/UX
- La porte est **discrète** : taille de texte ≤ microcopy, pas en gras, pas de fond.
- Anti-friction : un visiteur sans code **ignore** naturellement la porte ; aucune incitation
  visuelle forte (pas de pastille « code ? », pas de flèche animée).
- Sur mobile, l'ouverture ne provoque pas de saut brutal masquant le contenu lu ; le CTA
  reste atteignable par scroll.

### Design / charte
- `summary` : `text-encre/65` ou `text-encre-soft`, soulignement fin au focus/hover, curseur
  pointer ; **pas** de `bg-*` plein, **pas** de bordure de bouton, **pas** de couleur d'accent
  saturée. Indicateur d'expansion (marqueur natif ou chevron) discret, monochrome.
- **INTERDITS** : rouge retail, jaune discount, emoji dans `summary`/contenu, point
  d'exclamation, angle arrondi massif, animation agressive sur l'ouverture (un éventuel
  fondu doit rester sobre et respecter `prefers-reduced-motion`).

### Accessibilité (DÉTAILLÉ)
- **Rôle / sémantique** : utiliser `<details>/<summary>` natifs (pattern disclosure accessible
  par défaut). `aria-expanded` présent et synchronisé (false→true). Le contenu révélé est
  associé au déclencheur (le `<details>` natif gère la relation).
- **Clavier** : le `summary` est focusable (tabindex natif), activable par `Enter` et `Espace` ;
  l'ouverture ne crée pas de piège de focus ; `Tab` continue logiquement vers le contenu puis
  vers la suite de la page (CTA).
- **Focus visible** : anneau/contour de focus visible sur le `summary` (jamais `outline:none`
  sans alternative).
- **Option B (champ désactivé)** : champ porte `disabled` + `aria-disabled="true"` ; il **n'est
  pas** dans l'ordre de tabulation (un `disabled` sort du tab order) → le visiteur ne tombe pas
  dans un champ inerte sans explication.
- **axe-core** : 0 violation `serious`/`critical`, porte fermée **et** ouverte.
- **Réduction de mouvement** : si transition d'ouverture, elle est neutralisée sous
  `prefers-reduced-motion: reduce`.

### i18n (fr / ar / RTL)
- fr : `summary` = « J'ai un code d'invitation ».
- ar : `summary` traduit (« لدي رمز دعوة »), rendu RTL, indicateur d'expansion du bon côté.
- Aucune chaîne en dur non traduite ; pas de troncature en arabe.

### Performance / SSR
- `<details>` natif : pas de JS requis pour le toggle (fonctionne même sans hydratation).
- État initial fermé rendu côté serveur ; pas de flash d'ouverture.

### Observabilité
- L'ouverture **peut** émettre un event discret (ex. `coupon_invitation_open`) sans PII et
  sans bloquer. Si émis : payload neutre `{ source: 'welcome_note' }`. Aucun event ne doit
  contenir de saisie utilisateur (il n'y en a pas en Phase 1).

---

## (d) Edge cases & matrice d'états

| # | Action | locale | device | Attendu |
|---|---|---|---|---|
| 1 | Chargement initial | fr | mobile | `details` **fermé** ; contenu non visible ; aucun champ ouvert |
| 2 | Clic sur summary | fr | mobile | `details` **ouvert** ; `aria-expanded=true` |
| 3 | Re-clic sur summary | fr | desktop | `details` **fermé** ; `aria-expanded=false` |
| 4 | `Enter` sur summary focalisé | fr | desktop | ouvre (toggle clavier) |
| 5 | `Espace` sur summary focalisé | fr | desktop | ouvre (toggle clavier) |
| 6 | Ouvert, Option A | fr | mobile | texte explicatif inerte ; **aucun** champ ; aucune soumission possible |
| 7 | Ouvert, Option B | fr | desktop | champ + bouton **disabled** ; non focusables ; aucune soumission |
| 8 | Ouvert puis tentative de soumission | fr | desktop | **aucun** appel réseau ; aucun coupon appliqué |
| 9 | Chargement initial | ar | mobile | fermé ; summary arabe RTL ; indicateur du bon côté |
| 10 | Ouverture | ar | desktop | contenu arabe RTL lisible, sans troncature |
| 11 | Ouvrir/fermer | fr | mobile | CTA primaire inchangé (état, libellé) et toujours présent |
| 12 | axe-core porte fermée | fr | desktop | 0 violation serious/critical |
| 13 | axe-core porte ouverte | fr | desktop | 0 violation serious/critical |
| 14 | `prefers-reduced-motion: reduce` | fr | desktop | aucune animation d'ouverture agressive |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-15-1 | Champ de code **ouvert par défaut** | Friction : invite à chercher un code, casse l'effet auto-appliqué | INV-15-1 + cas #1 (I) |
| R-15-2 | Soumission **réelle** en Phase 1 (champ actif) | Comportement non spécifié, requête morte, faux espoir | INV-15-3 + cas #6/#7/#8 (I) |
| R-15-3 | `summary` stylé comme **bouton criard** concurrent du CTA | Détourne de l'action principale, dérive charte | INV-15-5 + cas charte (I) |
| R-15-4 | Disclosure **inaccessible** (pas focusable, pas de clavier, pas d'`aria-expanded`) | Exclusion utilisateurs clavier/AT | INV-15-4 + cas #4/#5/#12/#13 (A) |
| R-15-5 | Ouverture **perturbe le CTA** (le retire / le modifie) | Perte de conversion | INV-15-6 + cas #11 (I) |
| R-15-6 | **i18n/RTL** cassé sur le summary ar | Illisible / non traduit | INV-15-7 + cas #9/#10 (I) |
| R-15-7 | Champ Option B **focusable** malgré `disabled` mal posé | Piège utilisateur dans un champ mort | INV-15-3 + cas #7 (A) |
| R-15-8 | **Animation** d'ouverture agressive / ignore reduced-motion | Dérive charte / inconfort | INV-15-5 + cas #14 (V/A) |

---

## (f) Critères d'acceptation testables

- **AC-15-1** : au montage, `getByText("J'ai un code d'invitation").closest('details').open === false` ; aucun `input` visible/focusable.
- **AC-15-2** : un clic sur le `summary` met `details.open === true` ; un second clic le remet à `false`.
- **AC-15-3** : `summary` focalisé + `Enter` ouvre ; `summary` focalisé + `Espace` ouvre (toggle clavier natif).
- **AC-15-4** : le `summary` est focusable (`document.activeElement` après `Tab`) et possède un indicateur de focus visible (style focus présent, pas `outline:none` nu).
- **AC-15-5** : `aria-expanded` (ou équivalent natif `<details open>`) reflète l'état : `false` fermé, `true` ouvert.
- **AC-15-6 (inerte)** : aucune requête réseau n'est émise lors de l'ouverture/fermeture/tentative d'interaction (spy `fetch`) ; aucun coupon n'est appliqué.
- **AC-15-7 (Option A)** : si pas de champ, le contenu ouvert est un texte explicatif et **ne contient aucun** `input`/`textarea`. **(Option B)** : si champ présent, il porte `disabled` ET `aria-disabled="true"` et **n'est pas** dans le tab order.
- **AC-15-8 (charte)** : le `summary` n'a **pas** de classe `bg-*` plein ni couleur rouge/jaune ; pas d'emoji ; pas de `!` ; pas de `rounded-(2xl|3xl|full)`.
- **AC-15-9 (CTA non perturbé)** : après ouverture puis fermeture de la porte, le CTA primaire (`CommanderAnchorButton`) est toujours présent, même libellé, même état désactivé/actif qu'avant.
- **AC-15-10 (i18n ar)** : sur `/ar`, le `summary` affiche le texte arabe attendu, dans un contexte `dir="rtl"`, sans troncature.
- **AC-15-11 (a11y axe)** : axe-core renvoie 0 violation `serious`/`critical` porte **fermée** et porte **ouverte**.
- **AC-15-12 (reduced-motion)** : sous `prefers-reduced-motion: reduce`, aucune animation d'ouverture (ou animation neutralisée).
- **AC-15-13 (event optionnel)** : si un event d'ouverture est émis, son payload est neutre (`{source:'welcome_note'}`) et ne contient aucune saisie.
