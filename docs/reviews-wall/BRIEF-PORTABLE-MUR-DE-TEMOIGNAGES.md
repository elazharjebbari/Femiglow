# Brief d'implémentation portable — Mur de témoignages éditorial (« Rituels partagés »)

> **Comment utiliser ce fichier.** Ce document est un brief autonome. Copiez‑le intégralement dans une nouvelle session de Claude (ou d'un autre assistant de code) avec la consigne : « Implémente ce composant sur ma landing page produit. » Tout ce qui est nécessaire pour concevoir, coder, peupler et modérer le composant est ici — aucune référence à un dépôt externe.
>
> Le composant a été conçu à l'origine pour **FemiGlow** (manucure japonaise, marché marocain). Il est ici **généralisé** pour n'importe quel produit de soin / cosmétique / bien‑être premium qui vend une transformation lente et veut afficher de la preuve sociale **sans le vocabulaire des avis‑étoiles**. Adaptez les variables de la section 2, gardez tout le reste.

---

## 0. TL;DR — ce qu'on construit

Un **mur de témoignages clients** intégré à une page produit, mais **réinventé contre la grammaire des avis e‑commerce** :

- **Pas d'étoiles 1‑5**, pas de note moyenne. Remplacé par un **signal ternaire** (« Oui, sans hésiter » / « J'hésite » / « Pas pour moi ») + des **tags qualitatifs**.
- **Pas d'emoji**, pas de visage de face dans les photos (filtrage automatique).
- Une **voix éditoriale de marque** assumée à chaque chaîne de texte (le client n'est pas un « avis », c'est une voix).
- **Quatre surfaces** : un module compact sur la page produit, un drawer plein écran consultable, un wizard de soumission, un back‑office de modération.
- Boucle de collecte : **e‑mail post‑achat** (J+45) qui invite à témoigner, **modération humaine** 24–48 h, publication.

L'objectif business : augmenter le taux d'ajout au panier / d'achat sur la page produit en remplaçant la preuve sociale générique par une preuve **incarnée et crédible**.

---

## 1. Philosophie — les 7 partis pris (ne pas les diluer)

Ces principes sont ce qui distingue ce composant d'un widget d'avis standard. Si on les retire, il ne reste qu'un carrousel d'avis banal.

1. **Le signal n'est pas une note.** Trois réponses possibles, jamais cinq étoiles. On mesure l'intention de re‑recommander, pas une satisfaction décimale. Aucune couleur sémantique (pas de rouge/vert) : l'absence de jugement visuel est un parti pris de luxe.
2. **Les tags remplacent les filtres par note.** Liste fermée de 8 à 12 bénéfices concrets choisis par le client (« plus lisses », « moins de casse »…). On filtre par bénéfice, pas par nombre d'étoiles.
3. **La voix de la marque parle partout.** Aucun « Champ obligatoire », aucun « Erreur ». À la place : invitations, suggestions. Le sujet grammatical est la marque (« La maison reçoit votre témoignage »), pas le système (« Votre soumission est enregistrée »).
4. **Le témoignage est un acte d'écriture lent.** Le wizard a la grammaire d'une lettre, pas d'un formulaire : friction minimale à l'étape 1, validation douce au blur (jamais à la frappe), brouillon local sauvegardé.
5. **Photos de gestes, jamais de visages.** Les photos publiées montrent des mains, des gestes, le produit en usage. Un contrôle de détection de visages (vision ML) écarte automatiquement les visages de face — par respect de l'intimité et pour rester cohérent avec l'identité de marque.
6. **Modération humaine, toujours.** Rien n'est publié automatiquement. Tout passe `PENDING` → relecture → `APPROVED`. Délai annoncé comme une promesse (« sous 24 à 48 heures »), pas comme une excuse.
7. **Curation manuelle de la vitrine.** 3 témoignages « mis en avant » (`featured`) sont choisis à la main pour le module compact de la page produit. Fallback automatique si moins de 3.

---

## 2. Variables à adapter (la seule section à éditer pour votre produit)

Remplacez ces jetons partout dans le code. Les valeurs entre parenthèses sont l'exemple FemiGlow d'origine.

| Jeton | Signification | Exemple FemiGlow |
| --- | --- | --- |
| `{{MARQUE}}` | Nom de la marque | FemiGlow |
| `{{SIGNATAIRE}}` | Personne qui signe les messages (fondatrice / SAV) | Souheila · FemiGlow |
| `{{PRODUIT_KEY}}` | Clé technique du produit lié | `pack-femiglow` |
| `{{PRIX}}` `{{DEVISE}}` | Prix affiché dans le CTA (toujours rond, sans décimales) | 199 dh |
| `{{LIVRAISON}}` | Argument livraison | Livraison offerte au Maroc |
| `{{MOT_INITIE}}` | Comment on nomme un client (l'identité de la communauté) | initiée |
| `{{MOT_TEMOIGNAGE}}` | Comment on nomme un témoignage | rituel partagé |
| `{{VILLES[]}}` | Liste fermée de villes pour l'autocomplete signature | Rabat, Casablanca, Salé, Tanger, Marrakech, Fès, Agadir, Oujda, Tétouan, Meknès, Kénitra, Autre |
| `{{TAGS[]}}` | 8–12 bénéfices concrets propres au produit | Ongles plus lisses, Plaque souple, Cuticules apaisées, Plus de casse, Éclat naturel, Rituel devenu habitude, Mains détendues, Fini brillant, Halal |
| `{{DELAI_EMAIL}}` | Délai avant l'e‑mail de sollicitation | 45 jours (J+45) |
| `{{EMAIL_CONTACT}}` | Contact RGPD / SAV | info@femiglow-maroc.com |
| `{{LANGUES[]}}` | Langues supportées | fr, ar |

**Palette & typo (à mapper sur votre charte).** Le design d'origine utilise : encre `#2C2A28` (texte), crème `#FFFFFF`/crème‑pure (fond), sauge `#C5DBC4` + sauge‑dark (accents/actifs), ligne `#E8E0D2` (bordures 1 px), brume (texte secondaire), champagne (fleuron décoratif). Typographie : un **serif élégant** pour les citations et titres (Cormorant, en italique pour les citations), un **sans‑serif** pour l'UI (Inter). Remplacez par vos tokens — gardez le principe : **bordures fines à radius 0, beaucoup de blanc, citations en serif italique**.

---

## 3. Vue d'ensemble — 4 surfaces et flux

```
┌───────────────── Page produit / landing ─────────────────┐
│  Hero · Bénéfices · Composition · Vidéo · …               │
│                                                          │
│  ┌──────── SURFACE A · Module compact (3 cartes) ──────┐ │
│  │  LES VOIX DE LA MAISON                              │ │
│  │  26 initiées ont partagé · 24 reprendraient         │ │
│  │  [carte] [carte] [carte]                            │ │
│  │  Lire les 26 témoignages →                          │ │
│  └─────────────────────────────────────────────────────┘ │
│  Comparatif · FAQ · CTA achat                            │
└──────────────────────────────────────────────────────────┘
              │ clic « Lire les 26 »
              ▼
┌──────── SURFACE B · Drawer « Rituels partagés » ─────────┐
│  Header (titre + fleuron)                                │
│  Synthèse (volume + signal + top tags)                   │
│  Filtres : Tous · Avec photos · Halal · Récents          │
│  Liste de cartes (12 puis +12) · Lightbox photo          │
│  Footer collant : Partager mon témoignage · [CTA achat]  │
└──────────────────────────────────────────────────────────┘
              │ clic « Partager » OU lien e‑mail J+45
              ▼
┌──────── SURFACE C · Wizard de soumission (3 étapes) ─────┐
│  1 · Votre témoignage (texte + signal)   ← seule obligat.│
│  2 · Détails (tags + photos)             ← sautable      │
│  3 · Vous (prénom, ville, depuis quand)  ← sautable      │
│  → Confirmation éditoriale                               │
└──────────────────────────────────────────────────────────┘
              │ status: PENDING
              ▼
┌──────── SURFACE D · Admin /admin/temoignages ────────────┐
│  Queue · Détail · Approve/Reject/Hide/Feature · Audit    │
└──────────────────────────────────────────────────────────┘
              │ status: APPROVED → visible sur le mur
```

| Surface | Où | Rôle |
| --- | --- | --- |
| **A — Module compact** | Page produit, entre deux sections de contenu | Preuve immédiate + porte d'entrée du drawer |
| **B — Drawer** | Ouvert à la demande | Consultation complète des témoignages |
| **C — Wizard** | Dans le drawer ou via lien e‑mail | Soumission d'un témoignage |
| **D — Admin** | Back‑office | Modération, curation, audit |

---

## 4. Stack technique recommandée

Conçu pour **Next.js (App Router) + React + TypeScript + Tailwind**, mais transposable.

- **UI** : React, Tailwind (ou CSS modules). Drawer et lightbox sur **Radix Dialog** ou **Headless UI Dialog** (focus trap + `aria-modal` gratuits).
- **Validation** : **Zod** (schémas partagés client/serveur).
- **DB** : Postgres via **Drizzle ORM** (ou Prisma). 4 tables + 1 vue matérialisée.
- **Images** : stockage blob (Vercel Blob / S3 / local en dev) + **Sharp** pour thumbnails et compression serveur.
- **Détection de visages** : **MediaPipe Face Detection** (modèle léger ~4 Mo, runtime Node serveur). Alternative : toute API de détection de visages.
- **Sessions / CSRF** : iron‑session (ou équivalent) pour le token de soumission.
- **E‑mail** : n'importe quel provider transactionnel (Resend, Postmark…). CRON quotidien.

Budget : ≤ 30 ko CSS, ≤ 50 ko JS gzip additionnels. Le drawer est chargé en **lazy** pour ne pas peser sur le LCP de la page produit.

---

## 5. Design system & tokens

Tokens CSS spécifiques au composant (en complément de vos tokens globaux). Adaptez les couleurs à votre charte.

```css
:root {
  /* Cartes */
  --tw-card-padding: 20px;
  --tw-card-border: 1px solid var(--color-ligne);   /* bordure fine */
  --tw-card-bg: var(--color-creme-pure);            /* fond clair */
  --tw-card-radius: 0;                              /* angles vifs = parti pris */

  /* Chips de filtre */
  --tw-chip-padding-y: 8px;
  --tw-chip-padding-x: 14px;
  --tw-chip-height: 32px;

  /* Drawer */
  --tw-drawer-width-desktop: 480px;
  --tw-drawer-width-tablet: 420px;
  --tw-bottom-sheet-height: 92vh;

  /* Photos */
  --tw-photo-thumb-size: 80px;       /* dans la liste du drawer */
  --tw-photo-module-ratio: 4 / 5;    /* dans les cartes du module compact */

  /* Overlays */
  --tw-overlay: rgba(44, 42, 40, 0.30);          /* drawer */
  --tw-lightbox-overlay: rgba(0, 0, 0, 0.95);    /* lightbox photo */
}
```

**Fleuron** : petit ornement typographique répété (`╌╌╌╌◆╌╌╌╌`) utilisé comme séparateur éditorial. Implémentez‑le en SVG ou en pseudo‑élément. C'est la signature visuelle qui remplace les rangées d'étoiles.

**Easings & durées (motion).** Définir des easings nommés et les respecter :

| Action | Durée | Easing |
| --- | --- | --- |
| Ouverture/fermeture drawer | 220 ms | `out-soft` (ease‑out doux) |
| Bascule entre étapes du wizard | 280 ms | `in-out-silk` (cross‑fade) |
| Hover carte (translateY ‑3 px) | 200 ms | `out-soft` |
| Ouverture lightbox (opacity + scale 0.96→1) | 240 ms | `in-out-silk` |
| Confirmation (fade + fleuron) | 400–600 ms | `out-soft` |

**Toutes** les animations sont désactivées sous `prefers-reduced-motion: reduce`.

---

## 6. SURFACE A — Module compact (page produit)

### 6.1 Position & rendu
- Inséré entre deux sections de contenu de la page produit (idéalement entre la composition/bénéfices et le comparatif), **au‑dessus du pli** sur desktop si possible.
- Données fetchées **côté serveur** (RSC) : les 3 cartes `featured = true` + la synthèse agrégée. Skeleton si lent.

### 6.2 Dimensions responsive
| Breakpoint | Layout |
| --- | --- |
| Mobile < 768 | 1 colonne, swipe horizontal (scroll‑snap‑x) sur 3 cartes, padding 24 px |
| Tablette 768–1279 | 2 colonnes, 3ᵉ carte pleine largeur dessous |
| Desktop ≥ 1280 | 3 colonnes égales, gap 24 px, max‑width 1200 px |

### 6.3 Structure (exemple JSX)
```tsx
<section aria-labelledby="tw-module-title" className="tw-module">
  <header className="tw-module__header">
    <span className="tw-module__kicker">LES VOIX DE LA MAISON</span>
    <h2 id="tw-module-title" className="tw-module__title">
      26 initiées ont partagé. 24 reprendraient le rituel.
    </h2>
    <Fleuron variant="point" />
  </header>

  <div className="tw-module__grid" role="list">
    {featured.map((card) => (
      <TestimonialCard
        key={card.publicSlug}
        variant="compact"
        data={card}
        role="listitem"
        onClick={() => openDrawer({ scrollTo: card.publicSlug })}
      />
    ))}
  </div>

  <a href="?wall=open" className="tw-module__link" onClick={onLinkClick}>
    Lire les 26 témoignages <span aria-hidden="true">→</span>
  </a>
</section>
```

### 6.4 Carte — variante `compact`
| Élément | Style |
| --- | --- |
| Photo | 100 % largeur, ratio 4:5, lazy AVIF/WebP, `object-position` selon focal‑point |
| Citation | Serif italique 16 pt, encre, max 3 lignes (ellipsis CSS), guillemet ouvrant `«` + espace fine |
| Signature | `— Prénom, Ville` sans‑serif 12 pt brume, puis `Initiée depuis [mois année]` 12 pt sur ligne suivante |
| Tags | 1 à 2 tags séparés par ` · `, sans‑serif 12 pt sauge‑dark |
| Bordure | 1 px ligne, radius 0 — fond crème pure, padding 20 px |
| Hover | translateY(‑3 px), 200 ms `out-soft` (off si reduced‑motion) |

### 6.5 Curation & fallback
- 3 cartes `featured = true`, choisies à la main dans l'admin (rotation manuelle).
- **Fallback** : si < 3 featured, compléter par les `APPROVED` les plus récents ayant ≥ 1 photo OK et signal `oui`. Si toujours < 3, **ne pas afficher le module** (dégradation gracieuse) — le lien autonome « Lire les N témoignages → » reste visible plus bas.

### 6.6 Interactions
- Clic sur une carte → ouvre le drawer et scroll jusqu'à la carte correspondante.
- Clic sur le lien → ouvre le drawer en liste complète.
- Clic sur la photo → ouvre directement la lightbox.

---

## 7. SURFACE B — Drawer du mur

### 7.1 Arbre de composants
```
TestimonialWallProvider              (contexte, état global)
├── TestimonialModule                (surface A)
├── TestimonialWallDrawer            (surface B)
│   ├── WallHeader                   (close + kicker + titre + fleuron)
│   ├── WallSummary                  (synthèse + top tags)
│   ├── WallFilters                  (chips)
│   ├── WallList
│   │   ├── TestimonialCard (×N)
│   │   ├── WallSkeleton (×4)
│   │   └── WallLoadMore
│   ├── WallEmptyState
│   └── WallFooter                   (lien partage + CTA achat + lien politique)
├── PolicyView                       (vue alternative dans le drawer)
└── PhotoLightbox                    (overlay plein écran)
```

### 7.2 Conteneur & dimensions
- Radix/Headless `Dialog`, `aria-modal="true"`, overlay `rgba(44,42,40,0.30)`, focus trap, **ESC ferme**, clic overlay ferme.
- Focus initial sur le **titre** au mount.

| Breakpoint | Largeur / hauteur |
| --- | --- |
| Mobile < 768 | bottom sheet 92 vh, drag handle 36×4 px en haut |
| Tablette 768–1279 | 420 px de large, 100 vh, ancré à droite |
| Desktop ≥ 1280 | 480 px de large (520 px max ≥ 1920) |

Animation : `translateX(100%→0)` (desktop droite) ou `translateY(100%→0)` (mobile bas), 220 ms `out-soft`.

### 7.3 Header
- Bouton fermer 48×48 px (focus initial), aria‑label « Fermer ».
- Kicker (sans‑serif SemiBold 9 pt, sauge‑dark, tracking) : `RITUELS PARTAGÉS`.
- Titre (serif Light 28 pt encre) : `Les voix de la maison.`
- Fleuron.
- Padding 32/32/16 px desktop, 24/24/16 px mobile.

### 7.4 Synthèse
```
26 initiées ont partagé.
24 reprendraient le rituel.

Ongles plus lisses · Plaque souple · Cuticules apaisées
```
- 2 lignes serif italique 18 pt encre. **Pas d'histogramme.**
- Top tags : sans‑serif 12 pt brume, séparés par ` · ` (champagne).

### 7.5 Filtres (chips)
```
●Tous   Avec photos   Halal   Récents
```
- Chip défaut : fond crème, bordure 1 px ligne, padding 8×14 px, radius 0, hauteur 32 px (touch target 44 px via zone de clic).
- Chip actif : fond sauge, bordure sauge‑dark, texte encre.
- Scroll‑snap horizontal sur mobile avec ombre droite suggérant le scroll.
- A11y : `<button aria-pressed>` (ou `role="checkbox" aria-checked`).

Filtres standards : **Tous**, **Avec photos**, **{{TAG spécifique mis en avant}}** (ex. Halal), **Récents**. L'ordre par défaut est « Recommandés » (signal `oui` d'abord), ce n'est pas un chip.

### 7.6 Liste & carte — variante `default`
Cartes verticales empilées, gap 16 px.
```
┌─────────────────────────────────┐
│  ┌────────┐  « citation serif    │
│  │ photo  │    italique 17 pt »  │
│  │  80px  │                      │
│  └────────┘                      │
│  — Amal, Rabat                   │
│  Initiée depuis février 2026     │
│  ongles plus lisses · plus de    │
│  casse                           │
│                      [Reviendrait]│
└─────────────────────────────────┘
```
| Élément | Style | Position |
| --- | --- | --- |
| Photo | 80×80 px, AVIF, lazy, `cursor:pointer`, `aria-label="Voir la photo en grand"` | top‑left, float CSS |
| Photo absente | aucun placeholder, le texte occupe la carte | — |
| Citation | serif italique 17 pt encre, line‑height 1.6, wrap autour de la photo | — |
| Signature 1 | `— Prénom, Ville` sans‑serif 12 pt brume | sous citation |
| Signature 2 | `Initiée depuis [mois année]` 12 pt brume | sous sig. 1 |
| Tags | sans‑serif 12 pt sauge‑dark, séparés ` · ` | sous sig. 2 |
| Badge « Reviendrait » | sans‑serif SemiBold 9 pt sauge‑dark, kicker, sous‑bord 1 px | bottom‑right si signal `oui` |
| Carte | fond crème pure, bordure 1 px ligne, padding 20 px, radius 0 | — |

A11y carte : `<article aria-labelledby>`, signature lue **après** la citation (ordre DOM logique).

### 7.7 Load more
```
[ Afficher plus (12 / 26) ]
```
- Bouton pleine largeur, bordure 1 px, hauteur 48 px, sans‑serif 13 pt.
- Pendant le chargement : 4 skeletons + spinner discret. `aria-live="polite"` annonce le nouveau total.
- Fin de liste : texte centré « Vous avez lu toutes les voix de la maison. »
- Pagination **cursor‑based**, 12 cartes/page.

### 7.8 Empty state
```
La maison écoute.

Soyez la première à partager votre rituel.

[ Partager mon rituel → ]
```
S'affiche si `totalCount = 0`. Serif italique 18 pt centré, fleuron en haut, CTA secondaire dessous.

### 7.9 Footer collant
```
Partager mon rituel →

[ Recevoir le pack — 199 dh ]
 Livraison offerte au Maroc

Comment ces rituels partagés sont vérifiés →
```
- `position: sticky` bas, padding 24 px, fond crème, ombre supérieure `0 -1px 8px rgba(44,42,40,0.06)`.
- Lien partage : sans‑serif 13 pt encre.
- CTA achat : bouton pleine largeur fond encre, hauteur 56 px, hover encre‑claire.
- Sous‑CTA : sans‑serif 12 pt brume.
- Lien politique : 12 pt brume + flèche.

### 7.10 Lightbox photo
```
[×]        Photo 1 / 3        [→]
[←]
            [ Image plein cadre ]
   Mains d'Amal, six semaines après le début du rituel.
   — Amal, Rabat
```
- Fond noir 95 %, image max 90 vh / 90 vw, centrée.
- Flèches desktop 48×48 px (`rgba(255,255,255,0.15)`), swipe horizontal mobile.
- Header : compteur « Photo X / Y », close.
- Légende serif italique 15 pt + signature 12 pt brume sur fond noir transparent.
- Clavier : `Esc` ferme, `←`/`→` navigue, `Tab` cycle. `role="dialog"` + focus trap.

### 7.11 Vue politique (PolicyView)
Déclenchée par le lien « Comment vérifiés → » du footer. **Vue interne au drawer** (pas une modale empilée) : la liste disparaît, remplacée par le texte de politique, avec un bouton `← Revenir aux rituels` en haut. 4 paragraphes : qui peut partager · comment on relit · ce qu'on publie/ne publie pas · RGPD & droit à l'oubli. Texte stocké en BDD (`app_config`), éditable depuis l'admin.

### 7.12 États du drawer
`closed` · `opening` · `open` · `closing` · `loading` (skeleton) · `loaded` · `error` (message + retry) · `empty` · `loading_more` · `share_mode` (wizard monté) · `policy_mode`.

### 7.13 URL state (deep‑linking)
| URL | Comportement |
| --- | --- |
| `/produit` | Module visible, drawer fermé |
| `/produit?wall=open` | Drawer ouvert au mount, liste complète |
| `/produit?wall=open&filter=halal` | Drawer ouvert, filtre pré‑sélectionné |
| `/produit?wall=card-XXXXXXXX` | Drawer ouvert, scroll auto vers la carte + surbrillance 2 s |
| `/produit?wall=share` | Drawer ouvert directement en wizard (étape 1) |
| `/produit?wall=share&order=...&hash=...` | Wizard pré‑rempli (lien e‑mail) |

Push history non bloquant : si JS désactivé, le module reste visible mais le drawer ne s'ouvre pas (fallback acceptable).

---

## 8. SURFACE C — Wizard de soumission

### 8.1 Points d'entrée
1. Drawer → clic « Partager mon témoignage → » (le drawer bascule en `share_mode`).
2. E‑mail post‑achat → ouvre le drawer directement en wizard, avec `productKey`, prénom, ville pré‑remplis (via `emailToken` HMAC validé serveur).

### 8.2 Posture éditoriale (5 règles)
1. **Friction minimale à l'étape 1** : soumettre possible avec seulement texte + signal.
2. **Validation inline non agressive** : aucun message d'erreur tant que le champ n'a pas perdu le focus (`onBlur`).
3. **Pas de progress bar criante** : un discret « 1 sur 3 » en haut à droite suffit.
4. **Voix de marque partout** : jamais « Champ obligatoire ».
5. **Sortie sans perte** : brouillon local 7 jours (localStorage).

### 8.3 Étape 1 — Votre témoignage (obligatoire)
```
[← Revenir]                      1 sur 3
PARTAGER MON RITUEL
Étape 1 — Votre voix
╌╌╌╌◆╌╌╌╌

Qu'est-ce que le rituel a changé pour vous ?
┌─────────────────────────────────────────┐
│ Décrivez ce que vous avez remarqué.       │
│ Cinquante mots suffisent.                 │
└─────────────────────────────────────────┘
157 / 50 mots

Recommanderiez-vous ce rituel à une amie ?
○ Oui, sans hésiter   ○ J'hésite   ○ Pas pour moi

[ Continuer → ]
Vous pouvez partager dès maintenant. Les détails sont facultatifs.
```

**Champ texte (`body`)** : `<textarea>` serif 17 pt, line‑height 1.6.
- Placeholder : « Décrivez ce que vous avez remarqué. Cinquante mots suffisent. »
- Bornes : 50–250 mots indicatifs ; **validation serveur Zod : 50–600 caractères** (les caractères font foi).
- Compteur live `X / 50 mots` (sans‑serif 12 pt) : neutre < 50, sauge‑dark ≥ 50 (« suffisamment dense pour être lue »), rouge‑feutre > 250 (« plus court invite à plus de lecture »).
- **Sanitization à la frappe** : tout emoji tapé est retiré immédiatement, avec un toast doux 2 s « Les émoticônes ne sont pas dans notre grammaire. »
- Auto‑save brouillon toutes les 15 s (`localStorage` clé `tw-draft-v1`).

**Champ signal (`would_recommend`)** : `<fieldset>` + 3 `<label>` portant un `<input type="radio">` caché.
- Valeurs : `oui` / `hesite` / `non`.
- Label cliquable pleine largeur, fond crème, bordure 1 px ; état `:checked` (via `:has(input:checked)`) → bordure sauge‑dark 2 px, fond sauge‑pale.
- **Aucune icône, aucune couleur sémantique.** Touch target ≥ 44 px. Obligatoire pour continuer.

**CTA bas d'étape** : `[ Continuer → ]` (encre, pleine largeur, 56 px) visible si validation OK. Lien discret au‑dessus : `Soumettre tel quel →` qui saute directement à la confirmation.

### 8.4 Étape 2 — Détails (recommandée, sautable)
**Tags** : grid de checkboxes (2 col. desktop / 1 col. mobile), liste fermée `{{TAGS[]}}`. Max 3 ; au‑delà, les autres passent `disabled` (opacité 40 %, tooltip « Trois suffisent »). État coché : bordure sauge‑dark + fond sauge‑pale, sans icône check. Optionnel.

**Photos** : zone drag & drop + bouton « + Glisser ou choisir jusqu'à 3 photos ».
- Validation client : max 3, formats JPEG/PNG/HEIC/WebP, ≤ 5 Mo (sinon **compression Canvas** qualité 0.85 avant upload), dimensions min 600×600.
- Aperçu : vignettes 100×100 px + bouton `×`.
- Serveur : upload blob → job async de détection de visages.
- Si visage détecté au check immédiat : **alerte non bloquante** « La photo contient un visage. Pour préserver l'intimité de la maison, voudriez‑vous la remplacer ? » → choix `Choisir une autre photo` / `Conserver pour relecture humaine`.
- Microcopy sous la zone : « Mains, gestes, table de soin. » + « Pour préserver l'intimité de la maison, nous ne publions pas de visage de face. »

CTAs : `Continuer →`, `Passer cette étape →`, `← Retour` (sans perte).

### 8.5 Étape 3 — Vous (recommandée, sautable)
| Champ | Composant | Validation |
| --- | --- | --- |
| Prénom | `<input type="text">` 15 pt | 1–30 car., lettres + espaces + apostrophes + traits d'union |
| Ville | `<select>` autocomplete | liste `{{VILLES[]}}` |
| Initié depuis | 2 `<select>` (mois + année) | mois 1–12, année 2024→courante |
| Anonymat | `<input type="checkbox">` | si coché → `is_anonymous=true`, signature « Une initiée, [Ville] » |

**Tous optionnels.** Si rien n'est rempli, la carte affichera « Une initiée » (anonymat par défaut). Pré‑remplissage depuis e‑mail (prénom, ville, mois du paiement) si `emailToken` validé — modifiable.

CTAs : `Partager mon rituel →` (déclenche le POST), `Passer cette étape →` (soumission immédiate anonyme), `← Retour`.

### 8.6 Confirmation
```
╌╌╌╌◆╌╌╌╌
La maison reçoit votre rituel.
Nous l'ouvrirons sous 24 à 48 heures.
Vous recevrez un mot quand il sera publié.

Avec soin,
Souheila · FemiGlow
╌╌╌╌╌╌╌╌╌╌
[ Continuer la lecture ]
```
Centré, serif italique 22 pt, fleurons haut/bas. `role="status" aria-live="polite"`. Auto‑close 8 s. **Pas de checkmark vert, pas de toast** — une vraie page de remerciement éditoriale. Au succès : `localStorage.removeItem('tw-draft-v1')`.

### 8.7 Brouillon local
Sauvegarde JSON (body, signal, tags, prénom, ville, initiatedSince, isAnonymous, **photoBlobKeys** déjà uploadées, timestamp). Au mount, si brouillon < 7 jours : modale « La maison a gardé votre rituel en mémoire. Voulez‑vous le reprendre ou recommencer ? » `[Reprendre] [Recommencer]`. Si > 7 jours : ignoré + supprimé.

### 8.8 États du wizard
`step_1_idle` · `step_1_typing` · `step_1_valid` · `step_2_uploading` · `step_2_face_warning` · `step_3_submitting` · `submit_success` · `submit_error`.

### 8.9 Erreurs (codes → message éditorial doux)
| Code | HTTP | Message |
| --- | --- | --- |
| `RATE_LIMIT` | 429 | « La maison a déjà reçu votre voix récemment. Si vous voulez nous écrire, {{EMAIL_CONTACT}} reste ouverte. » |
| `VALIDATION_ERROR` (court) | 400 | « Quelques mots de plus aideront d'autres initiées. » |
| `VALIDATION_ERROR` (long) | 400 | « Plus court invite à plus de lecture. » |
| `VALIDATION_ERROR` (signal) | 400 | « Auriez‑vous l'amitié de nous dire si vous reprendriez ce rituel ? » |
| `PHOTO_TOO_LARGE` | 400 | « Votre photo est généreuse — pourriez‑vous nous la donner sous 5 Mo ? » |
| `INVALID_EMAIL_TOKEN` | 401 | « Le lien depuis votre boîte mail n'est plus valide. Vous pouvez toujours partager depuis la page des témoignages. » |
| `INTERNAL` | 500 | « La maison n'a pas pu recevoir votre rituel. Essayez à nouveau dans quelques minutes, ou écrivez‑nous à {{EMAIL_CONTACT}}. » |

**Jamais d'alerte rouge agressive** : bannière sauge‑pale + icône ⓘ + texte encre.

### 8.10 A11y wizard
`<fieldset><legend>` pour radios et checkboxes ; textarea avec label + `aria-describedby` vers le compteur ; `<select>` natifs pour mois/année (a11y gratuite) ; `<input type="file" accept="image/*" multiple>` natif ; au retour d'étape, focus sur le premier champ ; confirmation en `role="status"`.

---

## 9. SURFACE D — Admin / modération

Route ex. `/admin/temoignages`. Toutes les routes protégées par auth admin, toutes les actions tracées dans un audit immuable.

### 9.1 Onglets
- **Queue de modération** : `PENDING`, triés par auto‑flags (visages, emoji, mots interdits, longueur anormale, lien externe).
- **Publiés** : tous les `APPROVED`, filtres + tri.
- **Masqués / Rejetés** : archive.
- **Insights** : agrégation (tags les plus mentionnés, signal global, % avec photos, fréquence de soumission).
- **Politique** : éditeur du texte « Comment vérifiés ».

### 9.2 Actions sur un témoignage
| Action | Status final | Note interne obligatoire |
| --- | --- | --- |
| Approuver | `APPROVED` (+ `published_at`) | Non |
| Rejeter | `REJECTED` | **Oui** (raison) |
| Masquer | `HIDDEN` | **Oui** |
| Mettre en avant | `featured = true` | Non |
| Retirer la mise en avant | `featured = false` | Non |
| Corriger une coquille | édition de `body` (original conservé dans `body_original`) | **Oui** |
| Restaurer | retour `APPROVED` | Non |

### 9.3 Détection de visages (vision ML)
À l'upload, job async (MediaPipe) :
- 0 visage → photo `OK`.
- Visage de profil / partiel → `MANUAL_REVIEW` (badge orange dans la queue).
- Visage frontal → `REJECTED_FACE` (e‑mail doux à l'auteur proposant de remplacer).

### 9.4 Bulk (optionnel, listes admin)
Barre d'actions collante : approuver / rejeter / masquer / restaurer / mettre en avant / supprimer (RGPD avec confirmation par saisie). Modales de confirmation, audit double, **limite stricte 1 000** par lot. Limite featured = 3 simultanés.

### 9.5 Import administratif (optionnel)
Wizard 6 étapes (Source → Upload → Mapping → Preview → Commit → Rapport) pour importer des témoignages historiques (CSV/JSON/JSONL/TSV/ZIP+photos), preview obligatoire, rollback 24 h, vision ML systématique. **Jamais d'`APPROVED` automatique** : tout passe en `PENDING`.

---

## 10. Modèle de données

4 tables + 1 vue matérialisée. (Exemple Postgres/Drizzle ; transposez le nommage à votre produit.)

### 10.1 `testimonials`
| Colonne | Type | Contrainte / note |
| --- | --- | --- |
| `id` | uuid | PK `gen_random_uuid()` |
| `public_slug` | text | unique, 8 car. base32 — pour `?card=xxxxxxxx` |
| `product_key` | text | not null (FK soft vers le produit) |
| `body` | text | not null, **CHECK 50–600 car.** |
| `would_recommend` | enum(`oui`,`hesite`,`non`) | not null |
| `ritual_tags` | text[] | défaut `{}`, **CHECK ≤ 3** |
| `author_first_name` | text | nullable, 1–30 |
| `author_city` | text | nullable (liste fixée) |
| `initiated_since` | text | nullable, format `YYYY-MM` |
| `is_anonymous` | boolean | défaut false |
| `language` | enum(`fr`,`ar`) | défaut `fr` |
| `status` | enum(`PENDING`,`APPROVED`,`REJECTED`,`HIDDEN`) | défaut `PENDING` |
| `source` | enum(`web`,`email_j45`,`manual`) | not null |
| `customer_hash` | text | nullable, HMAC de l'e‑mail (anti‑doublon, RGPD) |
| `order_id` | uuid | nullable, FK soft vers commande |
| `verified_purchase` | boolean | défaut false (true si `order_id` lié à une commande payée) |
| `featured` | boolean | défaut false |
| `moderation_note` | text | nullable |
| `auto_flags` | text[] | `emoji`,`short`,`long`,`link_external`,`forbidden_word`,`face_detected` |
| `body_original` | text | nullable (texte avant sanitization, audit) |
| `created_at` / `published_at` / `updated_at` | timestamptz | |

Index clés : `(status, product_key)` ; partiel `(featured) where featured` ; partiel `(published_at desc) where status='APPROVED'` ; `(customer_hash)` ; gin `(ritual_tags)` ; unique `(public_slug)`.

### 10.2 `testimonial_photos`
`id`, `testimonial_id` (FK ON DELETE CASCADE), `url`, `thumb_url` (240×240), `focal_x`/`focal_y` (0–1), `width`, `height`, `byte_size`, `mime`, `faces_status` enum(`PENDING_CHECK`,`OK`,`MANUAL_REVIEW`,`REJECTED_FACE`), `faces_count`, `faces_check_at`, `position` (CHECK 0–2), `created_at`. Index : `(testimonial_id)` ; partiel `(faces_status) where in ('PENDING_CHECK','MANUAL_REVIEW')`.

### 10.3 `testimonial_audit_log` (append‑only)
`id`, `testimonial_id`, `actor_id` (null si système), `action` (`created`/`approved`/`rejected`/`hidden`/`featured_on`/`featured_off`/`corrected`/`restored`), `note`, `payload` (jsonb snapshot avant/après), `created_at`. **Aucune mise à jour.**

### 10.4 Vue matérialisée `testimonial_aggregate` (clé `product_key`)
Refresh toutes les 5 min ou à chaque publication (`REFRESH MATERIALIZED VIEW CONCURRENTLY`). Agrège : `total_count`, `oui_count`/`hesite_count`/`non_count`, `with_photos_count` (photos `OK`), `top_tags` (jsonb, top 6 par fréquence), `last_published_at`. Filtre `status = 'APPROVED'`.

### 10.5 Schémas Zod (extrait)
```ts
export const SignalSchema = z.enum(['oui', 'hesite', 'non']);

// Liste fermée — REMPLACER par vos {{TAGS[]}}
export const TagSchema = z.enum([
  'ongles-plus-lisses', 'plaque-souple', 'cuticules-apaisees',
  'plus-de-casse', 'eclat-naturel', 'rituel-devenu-habitude',
  'mains-detendues', 'fini-brillant', 'halal',
]);

export const TestimonialPublic = z.object({
  publicSlug: z.string().length(8),
  body: z.string().min(50).max(600),
  wouldRecommend: SignalSchema,
  ritualTags: z.array(TagSchema).max(3),
  signature: z.object({
    firstName: z.string().min(1).max(30).nullable(),
    city: z.string().nullable(),
    initiatedSince: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
    isAnonymous: z.boolean(),
    verifiedPurchase: z.boolean(),
  }),
  language: z.enum(['fr', 'ar']),
  photos: z.array(z.object({
    url: z.string().url(), thumbUrl: z.string().url(),
    width: z.number().int().positive(), height: z.number().int().positive(),
    focalX: z.number().min(0).max(1), focalY: z.number().min(0).max(1),
    position: z.number().int().min(0).max(2),
  })).max(3),
  publishedAt: z.string().datetime(),
});

export const TestimonialSubmit = z.object({
  productKey: z.string(),
  body: z.string().min(50).max(600),
  wouldRecommend: SignalSchema,
  ritualTags: z.array(TagSchema).max(3).default([]),
  authorFirstName: z.string().min(1).max(30).nullable().default(null),
  authorCity: z.string().nullable().default(null),
  initiatedSince: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().default(null),
  isAnonymous: z.boolean().default(false),
  language: z.enum(['fr', 'ar']).default('fr'),
  photos: z.array(z.object({
    blobKey: z.string(),
    width: z.number().int().positive(), height: z.number().int().positive(),
    byteSize: z.number().int().max(5 * 1024 * 1024),
    mime: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  })).max(3).default([]),
  emailToken: z.string().nullable().default(null), // HMAC du lien post‑achat
  consentMarketing: z.boolean().default(false),
});
```

### 10.6 Sanitization du `body` (avant insert)
1. Normalize Unicode NFC. 2. Strip emojis (plage `U+1F300–U+1FAFF` + variation selectors). 3. Normaliser apostrophes droites → courbes, guillemets → « ». 4. Espaces fines insécables (`U+202F`) avant `: ; ? !`. 5. Trim. 6. Collapse espaces multiples. 7. Détecter auto‑flags (lien externe, longueur, mots interdits). Conserver l'original dans `body_original`.

### 10.7 Sécurité des liens & doublons
- **`customer_hash` = sha256(email + PEPPER)** : détection de doublons (rate‑limit 30 j par client), liaison à une commande sans stocker l'e‑mail en clair (RGPD).
- **`emailToken` = base64url(hmac_sha256(secret, { order_id, customer_hash, issued_at, expires_at }))** pour le lien post‑achat. Validation serveur : signature OK + non expiré + commande payée.

---

## 11. API (8 endpoints publics/admin + CRON)

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/testimonials/summary?product_key=` | GET | Synthèse agrégée. **Cache** `public, max-age=300, s-maxage=300, stale-while-revalidate=600`. |
| `/api/testimonials/list` | GET | Liste paginée filtrée (voir params) |
| `/api/testimonials/submit` | POST | Soumission → `202 Accepted` |
| `/api/testimonials/policy` | GET | Texte « Comment vérifiés » (markdown → HTML safe) |
| `/api/admin/testimonials/queue` | GET | Queue de modération |
| `/api/admin/testimonials/[id]` | GET / PATCH | Détail + actions (approve/reject/hide/restore/feature/unfeature/correct) |
| `/api/admin/testimonials/[id]/photos/[photoId]/recheck` | POST | Re‑run vision ML |
| `/api/admin/testimonials/insights` | GET | Agrégation détaillée |

**Params de `list`** : `product_key` (requis), `with_photos` (0/1), `tags` (comma‑list, intersection), `signal` (oui/hesite/non), `sort` (recommended/recent/helpful, défaut recommended), `cursor` (base64), `limit` (1–24, défaut 12). Réponse `{ data: [...], meta: { nextCursor, hasMore, total } }`.

**`POST /submit` — pipeline serveur** : (1) vérif CSRF, (2) rate‑limit 1/IP/24 h et 1/`customer_hash`/30 j, (3) Zod, (4) sanitization, (5) auto‑flags, (6) si `emailToken` : valider HMAC + extraire `order_id`/`customer_hash`, (7) insert `PENDING`, (8) enqueue jobs vision‑ML + auto‑flags, (9) webhook admin optionnel. Doublon < 30 j → `409`.

**CRON** (header `Authorization: Bearer <CRON_SECRET>`) :
- `/api/cron/testimonials-refresh-aggregate` — refresh vue (toutes les 5 min).
- `/api/cron/testimonials-email-j45` — sollicitation post‑achat (1×/jour).
- `/api/cron/testimonials-faces-recheck-stale` — re‑check photos `PENDING_CHECK` > 1 h (1×/h).

---

## 12. E‑mail post‑achat (J+45)

CRON quotidien : commandes `paid` âgées de **{{DELAI_EMAIL}}** pleins → e‑mail.

```
Objet : Comment se porte votre rituel ?

Bonjour [Prénom],

Quarante-cinq jours sont passés depuis votre première manucure
japonaise. Cinq minutes par soir, deux gestes, un polissoir.

Auriez-vous quelques mots à partager — sur ce que vous avez
remarqué, sur ce qui a changé, sur ce qui vous a peut-être
manqué ? D'autres initiées vous lisent.

[ Partager mon rituel ]

Avec soin,
Souheila · FemiGlow
```
Le bouton pointe vers `…/?wall=share&order={orderId}&hash={hmac}`. Le hash valide serveur et pré‑remplit prénom/ville/produit : l'auteur n'a plus qu'à écrire.

Repères de perf attendus : ouverture ~30 %, CTR ~15 %, soumission après clic ~40 %. Objectif de départ : ~1 témoignage pour 100 commandes.

**Autres e‑mails** : approbation (« Votre rituel est publié »), rejet visage détecté (doux, propose de remplacer), rejet autre raison.

---

## 13. Tracking / analytics

Émettre vers votre dataLayer / outil d'analytics. Catalogue minimal :

| Événement | Surface | Payload |
| --- | --- | --- |
| `tw_module_view` | module | `featured_ids[]` |
| `tw_module_card_click` | module | `testimonial_id` |
| `tw_wall_open` | drawer | `entry_point` |
| `tw_wall_close` | drawer | `duration_ms`, `cards_seen` |
| `tw_wall_filter_change` | drawer | `filter_key`, `filter_value` |
| `tw_wall_card_impression` | drawer | `testimonial_id` |
| `tw_wall_photo_open` | drawer | `testimonial_id` |
| `tw_wall_load_more` | drawer | `current_count` |
| `tw_wall_cta_buy_click` | drawer | — |
| `tw_submit_start` | wizard | `entry_point`, `prefilled` |
| `tw_submit_step_view` / `_complete` / `_skip` | wizard | `step`, `time_spent_ms` |
| `tw_submit_emoji_stripped` | wizard | `emoji_count` |
| `tw_submit_photo_face_detected` | wizard | `faces_count` |
| `tw_submit_success` | wizard | `has_photos`, `tag_count`, `signal`, `is_anonymous` |
| `tw_submit_error` | wizard | `error_code` |
| `tw_submit_abandoned` | wizard | `last_step`, `time_spent_ms` |
| `tw_submit_draft_resumed` | wizard | `draft_age_hours` |

---

## 14. Voix & microcopy — catalogue

> Le microcopy **est** le produit. Le coller tel quel donne un widget d'avis ; le réécrire dans votre voix donne le composant. Adaptez à `{{MARQUE}}` / `{{SIGNATAIRE}}` / `{{MOT_INITIE}}` / `{{MOT_TEMOIGNAGE}}`.

### 14.1 Principes
- **Sensoriel** > descriptif. **Complice** > commercial. **Lent** > urgent. **Suggestif** > injonctif.
- Le **sujet est la marque**, pas le site (« La maison reçoit » et non « Soumission enregistrée »).
- Le **verbe est sensoriel** (« écouter », « lire », « accueillir » — jamais « valider », « traiter »).
- **Le signataire signe** quand il apparaît (jamais la marque seule dans les e‑mails / confirmation).
- **Délai nommé sans excuse** (« sous 24 à 48 heures » = promesse).
- **Prix rond** dans le CTA (`199 dh`, pas `199,00 dh`).
- **Mot « gratuit » interdit** (seul « offerte » admis : « livraison offerte »).

### 14.2 Mots préférés / interdits
- **Préférés** : rituel · voix · initiée · geste · lent · lecture · partager · écouter · accueillir · recevoir · révéler · patience.
- **Interdits** : avis · cliente · note · étoile · commenter · acheter · réduction · promo · solde · gratuit · vite · dernier · **tout point d'exclamation** · **tout emoji**.

### 14.3 Typographie
Apostrophes courbes `'` (U+2019). Guillemets « » + espace fine insécable (U+202F). Em‑dash `—` littéral. Points de suspension `…`.

### 14.4 Chaînes clés (modèles)
| Surface | Chaîne |
| --- | --- |
| Module — kicker | `LES VOIX DE LA MAISON` |
| Module — titre | `{count} initiées ont partagé. {oui_count} reprendraient le rituel.` |
| Module — lien | `Lire les {count} rituels partagés →` |
| Drawer — kicker / titre | `RITUELS PARTAGÉS` / `Les voix de la maison.` |
| Filtres | `Tous` · `Avec photos` · `Halal` · `Récents` |
| Carte — signature | `— {firstName}, {city}` / anonyme `— Une initiée, {city}` |
| Carte — depuis | `Initiée depuis {month} {year}` |
| Carte — badge | `Reviendrait` |
| Carte — alt photo | `Mains de {firstName}, {weeks} semaines après le début du rituel` |
| Load more | `Afficher plus ({current} / {total})` · fin `Vous avez lu toutes les voix de la maison.` |
| Empty | `La maison écoute.` / `Soyez la première à partager votre rituel.` |
| Footer | `Partager mon rituel →` · `Recevoir le pack — {price} dh` · `Livraison offerte au Maroc` · `Comment ces rituels partagés sont vérifiés →` |
| Wizard step 1 | question `Qu'est-ce que le rituel a changé pour vous ?` · placeholder `Décrivez ce que vous avez remarqué. Cinquante mots suffisent.` · signal `Recommanderiez-vous ce rituel à une amie ?` (`Oui, sans hésiter` / `J'hésite` / `Pas pour moi`) · helper `Vous pouvez partager dès maintenant. Les détails sont facultatifs.` |
| Wizard step 2 | `Que diriez-vous en trois mots ?` `(jusqu'à trois)` · photo `Une photo de vos mains ?` · `Mains, gestes, table de soin.` · `Pour préserver l'intimité de la maison, nous ne publions pas de visage de face.` |
| Wizard step 3 | `Comment souhaitez-vous signer ?` · `Prénom` `(apparaîtra publiquement)` · `Ville` · `Initiée depuis` · `Signer anonymement` |
| Confirmation | `La maison reçoit votre rituel.` / `Nous l'ouvrirons sous 24 à 48 heures.` / `Vous recevrez un mot quand il sera publié.` / `Avec soin,` / `Souheila · FemiGlow` |
| Brouillon | `La maison a gardé votre rituel en mémoire.` / `Voulez-vous le reprendre ou recommencer ?` `[Reprendre] [Recommencer]` |

### 14.5 Texte « Comment vérifiés » (politique)
```
Comment ces rituels partagés sont vérifiés.

Chaque rituel publié sur cette page vient d'une initiée
qui a reçu le pack {{MARQUE}} et l'a pratiqué chez elle.

Nous le lisons à la main, dans nos heures de calme, sous
48 heures. Nous ne réécrivons pas. Nous corrigeons parfois
une apostrophe, jamais une intention.

Pour préserver l'intimité de notre maison, nous publions
des mains, des gestes, des tables de soin — jamais de
visage de face. Les émoticônes n'entrent pas non plus dans
notre grammaire ; nous les retirons à la lecture.

Si vous souhaitez retirer votre voix, écrivez-nous à
{{EMAIL_CONTACT}}. Nous l'archiverons sous trois jours.

Avec soin,
Souheila · {{MARQUE}}
```

---

## 15. Accessibilité (WCAG 2.2 AA)

| Élément | Pratique |
| --- | --- |
| Drawer | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, ESC ferme, focus initial sur le titre |
| Carte | `<article aria-labelledby>`, citation lue avant la signature (ordre DOM) |
| Photo | `<img>` avec `alt` éditorial réel (jamais `alt=""` muet) |
| Chips | `<button aria-pressed>` (ou `role="checkbox" aria-checked`) |
| Lightbox | `role="dialog"`, focus trap, clavier (`Esc`/`←`/`→`) + swipe |
| Load more | `<button>` + `aria-live="polite"` annonçant le nouveau total |
| Wizard | `<fieldset><legend>`, label + `aria-describedby`, `<select>` natifs, confirmation `role="status"` |
| Motion | `prefers-reduced-motion: reduce` désactive toutes les animations |
| Contraste | valider encre/sauge/crème en AA (axe‑core en CI) |

---

## 16. Performance

- Drawer **lazy** → impact LCP négligeable sur la page produit.
- Pagination **cursor‑based**, 12 cartes/page.
- Images **AVIF/WebP**, thumbnails 80 px (liste) et 240 px (module), `lazy`, focal‑point via `object-position`.
- Cache 5 min sur `/summary` (+ `stale-while-revalidate`).
- Budget : ≤ 30 ko CSS, ≤ 50 ko JS gzip. Objectif page : LCP < 2,5 s, CLS < 0,1 avec le module ajouté.

---

## 17. Roadmap & Definition of Done

| Jalon | Contenu | Charge indicative |
| --- | --- | --- |
| **J1 — Lecture** | Drawer + module compact + cartes + filtres + admin (queue + détail) | ~12 j |
| **J2 — Soumission** | Wizard 3 étapes + e‑mail post‑achat + vision ML visages | ~7 j |
| **J3 — Mesure** | Tracking complet + agrégation insights | ~4 j |
| **J4 — Admin avancé (opt.)** | Import en masse + bulk management | ~9 j (parallélisable) |

**Prêt pour la prod quand** :
- ≥ 3 témoignages rédigés en interne **avant** ouverture (jamais de page vide), marqués `source=manual`.
- E‑mail post‑achat envoyé à un échantillon test, ≥ 2 témoignages spontanés rentrés.
- Audit a11y (axe‑core) vert.
- Smoke test e2e : ouvrir le mur → filtrer → cliquer une carte → ouvrir la lightbox → soumettre un témoignage test → admin approuve → visible sur le mur.
- Page produit toujours sous LCP < 2,5 s / CLS < 0,1.

---

## 18. Ce que ce composant ne fait PAS (anti‑patterns à respecter)

- **Pas de note étoile**, pas de moyenne numérique → signal ternaire + tags.
- **Pas d'emoji** publié (sanitization systématique).
- **Pas de visage de face** dans les photos (vision ML).
- **Pas de publication automatique** : modération humaine obligatoire, y compris pour les imports.
- **Pas de couleur sémantique** (rouge/vert) sur le signal.
- **Pas d'erreur rouge agressive** ni de « Champ obligatoire » : messages doux au blur.
- **Pas d'intégration tierce** (Trustpilot, Stamped.io…) : tout est natif, possédé.
- **Pas de réponse publique de la marque** aux témoignages (au lancement).

---

## 19. Checklist de portage (à cocher dans la nouvelle session)

- [ ] Remplacer toutes les variables de la **section 2** (`{{…}}`).
- [ ] Mapper la palette/typo sur la charte du nouveau produit (section 5).
- [ ] Définir la liste fermée `{{TAGS[]}}` propre au produit (8–12 bénéfices concrets).
- [ ] Définir `{{VILLES[]}}` / zones de livraison.
- [ ] Créer les 4 tables + la vue matérialisée (section 10).
- [ ] Implémenter les 8 endpoints + 3 CRON (section 11).
- [ ] Construire les 4 surfaces dans l'ordre J1→J3 (section 17).
- [ ] Brancher la détection de visages + la sanitization du `body`.
- [ ] Rédiger ≥ 3 témoignages internes avant ouverture.
- [ ] Brancher le tracking (section 13) et l'e‑mail post‑achat (section 12).
- [ ] Passer la checklist DoD (section 17) avant mise en ligne.

---

*Fin du brief. Ce document est volontairement exhaustif : il contient tout le nécessaire pour reconstruire le composant de zéro sur une autre page produit, sans accès au dépôt d'origine.*
