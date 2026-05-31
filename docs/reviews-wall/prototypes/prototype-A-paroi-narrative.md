# Prototype A — La Paroi narrative (drawer éditorial)

> Un drawer latéral / bottom-sheet ouvert depuis la fiche `/kit`, organisé comme un cahier ouvert : un en-tête de synthèse, des cartes-témoignages serrées, un CTA discret pour partager le sien.

## 1. Posture éditoriale

Le mur s'ouvre par-dessus la page sans changer d'URL. La cliente est en train de lire `/kit` ; elle veut entendre d'autres initiées sans perdre le fil de la fiche. Le drawer est **un cahier que l'on ouvre, pas une page que l'on quitte**.

C'est l'approche **la plus minimaliste** des trois. Elle privilégie la confiance et la conversion sans introduire de surcharge visuelle.

## 2. Surface d'entrée

### 2.1 Sur `/kit`

Une mention sobre, sous le sous-titre du hero, sous forme de **lien texte avec filet sauge fin** :

```
   ╌╌╌╌╌╌
   Lire les rituels partagés — 26 initiées
```

(Inter Medium 13 pt, sauge dark `#A8C4A6`, filet supérieur 1 px sauge-pale, hover : translateY(-2 px)).

Cliquer ouvre le drawer.

### 2.2 Sur les autres pages

Mêmes patterns d'entrée que `/kit` :

- `/rituel` — en fin de section « Témoignage initiée » : « D'autres voix : lire les rituels partagés. »
- `/maison` — en pied de page : pas de lien (la page Maison est un don).
- `/journal/[slug]` — en pied de tout article : « Les rituels partagés des initiées. »

## 3. Anatomie du drawer

### 3.1 Layout desktop

- **Largeur** : 480 px (≈ 33 % de la viewport 1440 px).
- **Position** : ancré à droite.
- **Overlay** : `rgba(44, 42, 40, 0.30)` derrière, qui assombrit légèrement la page.
- **Animation d'ouverture** : `translateX(100% → 0)` + opacité overlay `0 → 1`, 220 ms, easing `out-soft`.
- **Fermeture** : clic overlay, ESC, ou bouton croix en haut à droite.

### 3.2 Layout mobile

- **Hauteur** : 92 vh, bottom-sheet avec drag handle.
- **Snap points** : compact (60 % hauteur, ne montre que résumé + 2 cartes) et étendu (92 %, plein écran).
- **Drag-to-close** : descendre la poignée ferme.
- **Animation** : `translateY(100% → 0)`, 280 ms.

### 3.3 Structure intérieure (verticale, du haut vers le bas)

```
┌─────────────────────────────────────┐
│  [×]                                │  ← bouton fermer (48×48 px)
│                                     │
│  RITUELS PARTAGÉS                   │  ← kicker Inter 9pt
│  Les voix de la maison              │  ← Cormorant 28 pt
│                                     │
│  ╌╌╌╌◆╌╌╌╌                          │  ← fleuron champagne
│                                     │
│  26 initiées ont partagé.           │  ← Cormorant 17 pt italic
│  24 reprendraient le rituel.        │
│                                     │
│  Ongles plus lisses · Plaque        │  ← Tags insights agrégés
│  souple · Cuticules apaisées        │     (Inter 13 pt, brume)
│                                     │
├─────────────────────────────────────┤
│  Tous · Avec photos · Halal         │  ← Chips filtres (scroll horiz mobile)
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [photo carrée 80×80]        │    │
│  │                             │    │
│  │ « Trois mois et l'ongle a   │    │  ← Citation Cormorant 17 pt italic
│  │   retrouvé sa nervure. »    │    │
│  │                             │    │
│  │ — Amal, Rabat               │    │
│  │   Initiée depuis fév. 2026  │    │
│  │                             │    │
│  │ ongles plus lisses ·        │    │  ← Tags choisis par l'initiée
│  │ plus de casse               │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [pas de photo]              │    │
│  │ « Cinq minutes le soir, …   │    │
│  │ ...                         │    │
│  └─────────────────────────────┘    │
│                                     │
│  · · ·                              │
│                                     │
│  ┌───────────────────────────┐      │
│  │  Afficher plus (12 / 26)  │      │  ← bouton Inter Medium 13 pt
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│  Partager mon rituel  →             │  ← lien texte
│                                     │
│  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌      │
│  Recevoir le pack — 199 dh          │  ← CTA primaire encre, sticky
│  Livraison offerte au Maroc         │
└─────────────────────────────────────┘
```

## 4. Synthèse en tête (zone résumé)

Trois lignes Cormorant + une ligne tags. Ce sont les **insights agrégés** :

| Élément | Calcul | Exemple |
| --- | --- | --- |
| Volume total | `count(testimonials where status = approved)` | « 26 initiées ont partagé. » |
| Signal de retour positif | `count(would_recommend = oui) of total` | « 24 reprendraient le rituel. » |
| Top 3 tags | `top 3 tags by frequency` | « Ongles plus lisses · Plaque souple · Cuticules apaisées » |

Pas d'histogramme. Pas de note. Pas de pourcentage criant (on ne dit pas « 92 % satisfait » — on dit « 24 sur 26 reprendraient »). Le rapport en valeur absolue est plus narratif et moins commercial.

## 5. Filtres

Une seule ligne de chips, scroll horizontal sur mobile :

| Chip | Comportement |
| --- | --- |
| **Tous** | Défaut, surligné sauge |
| **Avec photos** | Filtre `has_photos = true` |
| **Halal** | Filtre `tags contains "halal"` (à n'afficher que si le tag est présent) |
| **Récents** | Tri par `created_at desc` |

Pas de chip « 5★ » — il n'y a pas d'étoiles. Pas de chip « 1★ » — les témoignages avec signal `pas pour moi` sont peu nombreux et apparaissent dans la liste naturellement.

## 6. Carte de témoignage

### 6.1 Anatomie de la carte

| Zone | Contenu | Style |
| --- | --- | --- |
| Photo (optionnelle) | 80 × 80 px, AVIF, lazy load, focal point centré sur les mains | Bordure 1 px ligne, rayon 0 (angles vifs) |
| Citation | 30 à 80 mots, Cormorant Italic 17 pt, encre | Pas de guillemets graphiques décoratifs ; juste « » |
| Signature | `Prénom, Ville` / `Initiée depuis [mois année]` | Inter Regular 12 pt, brume |
| Tags choisis | 1 à 3 tags séparés par ` · ` | Inter Regular 12 pt, sauge-dark |
| Signal de retour (badge discret) | Petite mention si `would_recommend = oui` : « Reviendrait » | Inter SemiBold 9 pt, kicker style, sauge-dark |

### 6.2 États

- **Default** : fond crème pure, bordure 1 px ligne.
- **Hover** (desktop) : translateY(-2 px), transition 200 ms.
- **Photo clickable** : ouvre lightbox plein écran avec curseur précédent / suivant.
- **Empty state** : « Soyez la première à partager votre rituel. »

## 7. CTA primaire

Le bouton sticky en pied de drawer reprend la **mécanique conversion** :

```
[Recevoir le pack — 199 dh]
 Livraison offerte au Maroc
```

- Bouton plein largeur, fond encre `#2C2A28`, texte crème, hauteur 56 px.
- Hover : fond encre-claire `#4A4844`.
- Click : ferme le drawer et redirige vers `/kit#hero` avec scroll smooth.
- Sous-bouton : Inter Regular 12 pt, brume.

À côté, en lien texte discret au-dessus du bouton : `Partager mon rituel →` ouvre le wizard (cf. `11-wizard-soumission.md`).

## 8. Wizard de soumission (résumé — détail dans `11`)

Quand l'initiée clique sur « Partager mon rituel », le drawer **bascule en mode wizard** (la liste disparaît, l'en-tête change) plutôt que d'ouvrir une modale empilée. Trois étapes :

1. **Votre rituel** — texte (50 à 300 mots) + question signal de retour (Oui / Hésite / Pas pour moi).
2. **Détails** — choix de 1 à 3 tags qualitatifs + photo optionnelle (max 3).
3. **Vous** — prénom (obligatoire), ville (autocomplete Maroc), initiée depuis (datepicker mois / année).

Confirmation : « La maison reçoit votre rituel. Nous l'ouvrirons sous 24 à 48 heures. »

Le formulaire est aussi accessible depuis l'e-mail J+45 envoyé après achat, avec `productKey` et `customerHash` pré-remplis.

## 9. Politique « Comment vérifiés »

Lien discret en bas du drawer, sous le CTA :

```
Comment nos rituels partagés sont reçus →
```

Ouvre une vue qui remplace la liste : 4 paragraphes Cormorant 15 pt expliquant :

1. Qui peut partager (chaque initiée ayant reçu le pack).
2. Comment on modère (lecture humaine sous 24 à 48 h).
3. Ce qu'on accepte et refuse (pas d'emoji, pas de visages).
4. Comment on conserve les données (RGPD, droit à l'oubli).

## 10. Animations

| Action | Durée | Easing |
| --- | --- | --- |
| Ouverture drawer | 220 ms desktop / 280 ms mobile | `out-soft` |
| Fermeture drawer | 180 ms | `in-quiet` |
| Filtre actif | 150 ms (couleur de fond) | `default` |
| Hover carte | 200 ms (translateY) | `out-soft` |
| Apparition cartes (load-more) | 300 ms, stagger 50 ms par carte | `out-soft` |
| Lightbox photo | 240 ms | `in-out-silk` |

`prefers-reduced-motion: reduce` : toutes les transitions à 80 ms maximum, pas de translateY, pas de stagger.

## 11. Tracking

| Événement | Quand | Payload |
| --- | --- | --- |
| `ritual_wall_open` | Drawer ouvert | `from_page`, `entry_point` |
| `ritual_wall_close` | Drawer fermé | `duration_ms`, `cards_seen` |
| `ritual_wall_filter_change` | Chip cliqué | `filter_key`, `filter_value` |
| `ritual_wall_card_impression` | Card en viewport | `testimonial_id` |
| `ritual_wall_photo_open` | Photo cliquée | `testimonial_id` |
| `ritual_wall_load_more` | Bouton chargé | `current_count` |
| `ritual_wall_cta_buy_click` | CTA pack cliqué | (aucun) |
| `ritual_wall_share_click` | Partager mon rituel cliqué | (aucun) |
| `ritual_submit_*` | Wizard | cf. `16-tracking-analytics.md` |

## 12. Forces du prototype A

1. **Préservation du flow d'achat** — le drawer reste contextuel à `/kit` ; la cliente ne s'éloigne pas du moment de décision.
2. **Conversion à proximité** — le CTA `Recevoir le pack` est toujours visible. Le wall agit comme un **levier de réassurance immédiate**.
3. **Charge cognitive minimale** — pas d'URL changée, pas de stack de modales, pas de tri ni de pagination compliqués.
4. **Voix maison parfaite** — l'éditorial respire ; chaque carte est un fragment lu, pas une fiche d'évaluation.
5. **Mobile-first** — bottom-sheet idiomatique pour le scroll au pouce.
6. **Implémentation rapide** — le drawer est un primitif UI déjà présent dans la stack (Headless UI / Radix Dialog).
7. **A/B testable** — facilement comparé à une variante « sans wall » sur le KPI add-to-cart.

## 13. Faiblesses du prototype A

1. **Pas d'URL partageable** — un témoignage particulièrement marquant ne peut être pointé par lien.
2. **SEO marginal** — le contenu des témoignages n'est pas indexé puisque chargé en client-side via API.
3. **Plafond de croissance** — au-delà de 100 témoignages, scroller verticalement devient long. Il faudra une pagination plus avancée ou une recherche.
4. **Densité limitée** — sur desktop, 480 px de large suffisent à 1 carte par ligne, pas à un grid. Si le volume devient massif, on perd en survol.
5. **Découverte passive** — l'initiée doit faire l'effort d'ouvrir le drawer. Pas de mise en avant proactive.

## 14. Persona cible et cas d'usage

| Persona | Cas d'usage |
| --- | --- |
| Salma, 34 ans, Casablanca, en hésitation sur `/kit` | Ouvre le drawer, lit 4 cartes, voit que 24 sur 26 reprendraient, clique sur le CTA pack. Conversion. |
| Amal, déjà initiée depuis 6 semaines, qui revient sur le site | Reçoit l'e-mail J+45, clique, arrive sur le wizard pré-rempli, soumet en 2 min. |
| Yasmine, qui découvre le site via Instagram | Atterrit sur `/maison` — ne voit pas le wall. Bascule sur `/kit` plus tard, le découvre. |

## 15. Estimation de mise en œuvre

| Phase | Charge |
| --- | --- |
| Schéma BDD + API | 3 j |
| Drawer + filtres + cartes | 4 j |
| Wizard de soumission | 3 j |
| Admin (queue + détail + actions) | 4 j |
| Vision ML faces detection | 2 j |
| E-mail J+45 + lien pré-rempli | 1 j |
| Tracking + tests | 2 j |
| **Total** | **~19 j** |
