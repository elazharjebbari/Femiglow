# Prototype C — Le Mur éditorial filtré (page complète + module fiche)

> Une page dédiée `/rituels-partages` au gabarit éditorial du journal, avec sidebar de filtres + grid de cartes, **et** un module compact intégré dans `/kit` (3 cartes + lien « lire les 26 »). Approche **hybride** type Glossier ou Sephora, adaptée à la voix maison.

## 1. Posture éditoriale

Ce prototype mise sur la **double accessibilité** :

- Page dédiée pour la lecture profonde et SEO.
- Module compact sur `/kit` pour la conversion immédiate.

Le wall devient un **chapitre du site**, au même rang que le journal. L'initiée peut y consacrer du temps (lecture longue) ou simplement glisser sur 3 cartes synthétiques avant d'acheter.

C'est **le prototype le plus performant en conversion attendue** sur le moyen terme, et **le plus normatif** par rapport aux conventions e-commerce. Il est aussi le plus exigeant en charge de mise en œuvre.

## 2. Surface d'entrée

### 2.1 Module sur `/kit` (compact)

Section dédiée entre « Témoignages photos-mains » et « CTA final ». 3 cartes en grid + en-tête de synthèse + lien :

```
LES VOIX DE LA MAISON

26 initiées ont partagé. 24 reprendraient le rituel.

┌──────────┐ ┌──────────┐ ┌──────────┐
│  Card 1  │ │  Card 2  │ │  Card 3  │
│ Cormorant│ │ ...      │ │ ...      │
│ ...      │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘

Lire les 26 rituels partagés →
```

Les 3 cartes sont **curées par la maison** (rotation manuelle dans l'admin) — pas chronologique, pas algorithmique.

### 2.2 Page `/rituels-partages`

URL dédiée, layout type journal. Indexée dans le sitemap. Lien dans le footer colonne « Le Rituel ».

### 2.3 Cross-links

Cf. prototype B.

## 3. Anatomie de la page `/rituels-partages`

### 3.1 Hero

```
                  RITUELS PARTAGÉS
                  ───────────────

                  Le carnet des initiées.

   ╌╌╌╌◆╌╌╌╌

   Trois ans que la maison écoute. 26 voix
   recueillies, lentement, comme on lit
   une lettre.
```

- Fond crème, texte centré.
- Cormorant 64 pt titre, 28 pt italic intro.
- Aucun CTA dans le hero (la cliente vient lire, pas acheter).

### 3.2 Bandeau synthèse

```
26 initiées · 24 reprendraient · 18 avec photos
```

- Inter Medium 13 pt, brume.
- Séparateurs `·` champagne.

### 3.3 Layout principal (desktop : 2 colonnes)

```
┌──────────────────┬──────────────────────────────────┐
│  FILTRES         │  Grid 3 colonnes de cartes       │
│  (sidebar 280px) │                                  │
│                  │  ┌─────┐ ┌─────┐ ┌─────┐         │
│  Trier par       │  │card │ │card │ │card │         │
│  • Recommandés   │  └─────┘ └─────┘ └─────┘         │
│  • Plus récents  │                                  │
│  • Plus utiles   │  ┌─────┐ ┌─────┐ ┌─────┐         │
│                  │  │card │ │card │ │card │         │
│  Crédibilité     │  └─────┘ └─────┘ └─────┘         │
│  ☐ Avec photos   │                                  │
│  ☐ Initiée       │  · · ·                           │
│    vérifiée      │                                  │
│                  │  [ Afficher plus (12 / 26) ]    │
│  Tags rituel     │                                  │
│  ☐ Ongles plus   │                                  │
│    lisses        │                                  │
│  ☐ Plaque souple │                                  │
│  ☐ ...           │                                  │
│                  │                                  │
│  Signal          │                                  │
│  ○ Reviendraient │                                  │
│  ○ Hésitent      │                                  │
│  ○ Pas pour elles│                                  │
│                  │                                  │
│  Période         │                                  │
│  ○ Tous          │                                  │
│  ○ 3 derniers    │                                  │
│    mois          │                                  │
└──────────────────┴──────────────────────────────────┘
```

### 3.4 Layout mobile

- Sidebar transformée en **bouton « Filtrer » sticky** en haut.
- Click sur le bouton → bottom-sheet avec tous les filtres.
- Grid 1 colonne.

### 3.5 Carte de témoignage (full version)

Sur la page dédiée, la carte est plus généreuse que dans le drawer du prototype A :

```
┌──────────────────────────────────┐
│  [photo carrée 240×240]          │
│                                  │
│  ongles plus lisses ·            │  ← Tags haut de carte
│  plus de casse                   │
│                                  │
│  « Trois mois et l'ongle a       │  ← Citation Cormorant 17 pt
│    retrouvé sa nervure. J'ai     │     italic, 4-6 lignes
│    cessé de le forcer.           │
│    Je remarque que les           │
│    cuticules ont apaisé. »       │
│                                  │
│  ── Amal, Rabat                  │
│  Initiée depuis février 2026     │
│                                  │
│  Reviendrait                     │  ← Petit badge sauge-dark
└──────────────────────────────────┘
```

### 3.6 Pied de page

```
╌╌╌╌◆╌╌╌╌

Vous aussi, partager votre rituel →

╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

Maintenant que vous savez.

[ Recevoir le pack — 199 dh ]
  Livraison offerte au Maroc

Comment ces rituels partagés sont vérifiés →
```

## 4. Module compact `/kit` (3 cartes)

Détail du composant :

- **3 cartes curées** sélectionnées par la maison dans l'admin (champ `featured: boolean` sur les témoignages, max 3 actifs simultanément).
- **Pas de filtre** dans ce module (intention : conversion rapide).
- **Lien sortant** vers `/rituels-partages` (et non vers un drawer).
- Le lien est `Inter Medium 13 pt` sauge-dark, surmonté d'un filet 1 px sauge-pale.

## 5. Filtres sidebar (page dédiée)

| Famille | Options | Comportement |
| --- | --- | --- |
| **Trier par** | Recommandés (défaut) / Plus récents / Plus utiles | Radio buttons |
| **Crédibilité** | Avec photos / Initiée vérifiée | Cases à cocher (combinables) |
| **Tags rituel** | Ongles plus lisses / Plaque souple / Cuticules apaisées / Plus de casse / Éclat naturel / Rituel devenu habitude / Halal | Cases à cocher (combinables) |
| **Signal** | Reviendraient / Hésitent / Pas pour elles | Radio buttons (un seul actif) |
| **Période** | Tous / 3 derniers mois / 6 derniers mois | Radio buttons |

URL params : `?sort=recent&with_photos=1&tags=ongles-plus-lisses,plaque-souple&signal=oui` — partageables, bookmarkables, indexables.

Filtre actif = highlight sauge. Tous les filtres ont un état effacé (« Tout désactiver »).

## 6. Pagination

- 12 cartes initiales.
- Bouton « Afficher plus » charge 12 de plus à chaque clic.
- Compteur visible : `12 / 26 affichés`.
- Plafond DOM 60 cartes ; au-delà, un « Voir les plus anciens » réinitialise la liste.

## 7. SEO

- **Sitemap** : `/rituels-partages` indexé.
- **JSON-LD** : schema.org `Review` agrégés en `aggregateRating` substitué par `ItemList`. Pas de `ratingValue` (cohérent avec absence de note).
- **OG image** : `og:image` dédiée au mur, format 1200 × 630, motif fleuron + 3 mini-cartes.
- **Title** : `Rituels partagés — FemiGlow`.
- **Description** : `Les voix des initiées qui pratiquent le rituel FemiGlow à Rabat. 26 témoignages, lentement recueillis.`
- **Pages filtrées indexables** : `/rituels-partages?tags=halal` pourrait avoir sa propre title — à arbitrer (canonical sur `/rituels-partages` pour éviter le duplicate content).

## 8. Wizard de soumission

Identique aux prototypes A et B. Accessible depuis :

1. Lien en pied de `/rituels-partages`.
2. Lien en pied du module compact `/kit`.
3. E-mail J+45.

## 9. Tracking

| Événement | Quand | Payload |
| --- | --- | --- |
| `ritual_page_view` | Arrivée sur `/rituels-partages` | `from_page` |
| `ritual_module_view` | Module compact `/kit` en viewport | `featured_ids` |
| `ritual_card_impression` | Card en viewport (page ou module) | `testimonial_id`, `surface` |
| `ritual_filter_change` | Filtre sidebar | `filter_key`, `filter_value` |
| `ritual_sort_change` | Tri changé | `sort_key` |
| `ritual_load_more` | Bouton chargé | `current_count` |
| `ritual_module_link_click` | Lien « Lire les 26 » cliqué | `surface = kit_module` |
| `ritual_share_click` | Partager mon rituel | `surface` |
| `ritual_cta_buy_click` | CTA pack cliqué | `surface` |
| `ritual_submit_*` | Wizard | cf. tracking doc |

Analyse fine : on peut comparer la **conversion via module compact** vs **via page dédiée**. Important pour l'A/B.

## 10. Animations

| Action | Durée | Easing |
| --- | --- | --- |
| Filtre actif | 150 ms (toggle bg) | `default` |
| Apparition cartes | 400 ms, stagger 60 ms | `out-soft` |
| Hover carte | 200 ms (translateY -3 px + shadow subtle) | `out-soft` |
| Lightbox photo | 240 ms | `in-out-silk` |
| Bottom-sheet mobile (filtres) | 280 ms | `out-soft` |

`prefers-reduced-motion: reduce` désactive translateY et stagger.

## 11. Forces du prototype C

1. **Double couverture** — module compact pour la conversion, page dédiée pour la lecture profonde.
2. **SEO actif** — chaque tag, chaque filtre est une page indexable. Trafic organique long-tail attendu.
3. **Modèle mental connu** — proche de Sephora, Glossier, Aesop. Aucune friction d'apprentissage.
4. **Scalabilité optimale** — sidebar filtres + pagination supportent des milliers de témoignages.
5. **Curation possible** — `featured: boolean` permet de mettre en avant 3 témoignages choisis par la maison.
6. **Analytics riches** — comparaison surface module vs page, filtres les plus utilisés, chemins de conversion.
7. **Partageable** — URL avec params, bookmarkable, OG image dédiée.

## 12. Faiblesses du prototype C

1. **Lourdeur d'implémentation** — la plus longue des trois.
2. **Densité visuelle vs voix maison** — un mur avec sidebar et filtres ressemble à un site e-commerce standard. Risque de **banaliser la marque** si la palette / typo ne portent pas le distinctif.
3. **Curation manuelle** — le champ `featured` demande de la discipline éditoriale. À défaut, le module compact se vide ou se rabat sur les derniers témoignages.
4. **Mobile plus complexe** — bottom-sheet de filtres, état actif visible, retour à la liste.
5. **Page « vide » au lancement** — avec 5 ou 10 témoignages, la page dédiée a l'air sous-utilisée. Demande un seuil de lancement (≥ 15).

## 13. Persona cible

| Persona | Cas d'usage |
| --- | --- |
| Salma, en hésitation sur `/kit` | Voit le module compact (3 cartes), lit, clique « Lire les 26 ». Arrive sur la page, filtre par « plus de casse », trouve son cas, clique « Recevoir le pack ». **Persona principale servie.** |
| Yasmine, qui découvre via Instagram | Atterrit directement sur `/rituels-partages?tags=halal`. Lit 8 témoignages. Va sur `/kit`. Conversion attribuable au SEO. |
| Initiée déjà conquise | Reçoit l'e-mail J+45, soumet son rituel via le wizard. Pas changé. |
| Journaliste / partenaire | Lit la page complète, comprend la profondeur de la communauté. **Effet halo marque + B2B.** |

## 14. Estimation de mise en œuvre

| Phase | Charge |
| --- | --- |
| Schéma BDD + API | 3 j |
| Page `/rituels-partages` (layout 2 cols) | 4 j |
| Sidebar filtres + URL params + persistance | 3 j |
| Grid cartes + pagination | 2 j |
| Module compact `/kit` | 2 j |
| Mobile (bottom-sheet filtres + grid 1 col) | 2 j |
| Wizard de soumission | 3 j |
| Admin (queue + détail + actions + featured) | 5 j |
| Vision ML faces detection | 2 j |
| E-mail J+45 + lien pré-rempli | 1 j |
| SEO (sitemap, JSON-LD, OG images, canonicals) | 2 j |
| Tracking + tests | 3 j |
| **Total** | **~32 j** |
