# Analyse comparative des trois propositions de menu

> Évaluation des trois concepts (*Le Rail lent*, *Le Sceau*, *Le Sommaire
> saisonnier*) à l'aune de la charte FemiGlow, de la voix de marque et des
> contraintes techniques du repo (Next.js 14, Tailwind, Zustand, font-local).
> Score sur 20, justifié par six axes pondérés.

---

## 1. Rubrique de notation

| Axe | Pondération | Ce qu'on mesure |
|---|---|---|
| **Cohérence avec la marque** | 5 pts | Beauté lente, voix éditoriale, ancrage marocain, registre Pinyon/Cormorant, palette earthen |
| **Ergonomie / utilisabilité** | 5 pts | Découvrabilité des sections, charge cognitive, vitesse de parcours, prévisibilité |
| **Élégance et originalité** | 3 pts | Caractère mémorable, différenciation par rapport aux concurrents (Aesop, Rituals, Susanne Kaufmann) |
| **Performance / faisabilité technique** | 3 pts | Coût d'implémentation, risque LCP/CLS, maintenabilité, complexité animations |
| **Accessibilité** | 2 pts | WCAG AA/AAA, navigation clavier, lecteurs d'écran, `prefers-reduced-motion` |
| **Adaptation mobile** | 2 pts | Qualité du mobile vs desktop, fluidité tactile, parité d'expérience |
| **Total** | **20 pts** | |

---

## 2. Score synthétique

| Proposition | Marque | Ergo | Élégance | Perf | A11y | Mobile | **Total** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **n°1 — Le Rail lent** | 3.5 / 5 | 5 / 5 | 1.5 / 3 | 3 / 3 | 2 / 2 | 1.5 / 2 | **16.5 / 20** |
| **n°2 — Le Sceau** | 4.5 / 5 | 3 / 5 | 3 / 3 | 2.5 / 3 | 2 / 2 | 2 / 2 | **17 / 20** |
| **n°3 — Le Sommaire saisonnier** | 5 / 5 | 4 / 5 | 3 / 3 | 2 / 3 | 1.5 / 2 | 2 / 2 | **17.5 / 20** |

---

## 3. Analyse détaillée

### Proposition n°1 — *Le Rail lent*

**Forces**
- Référent éditorial maîtrisé (Aesop, & Daughter), zéro friction d'usage.
- Implémentable en une demi-journée, surface d'attaque minimale.
- Excellence performance & accessibilité « par construction ».
- Lien actif visible immédiatement, parcours rapide.

**Faiblesses**
- Pas mémorable. Un visiteur ne se souviendra pas de ce header en sortant.
- La voix « beauté lente » de la marque n'est pas matérialisée par un geste
  spécifique — elle existe dans la page, pas dans le menu.
- Le mobile retombe sur un burger banal — la signature `Casablanca, saison
  du printemps.` dans le drawer est belle, mais l'entrée s'appelle `☰`.
- Aucun lien fort avec la matière première de la marque (saison, lieu).

**Pertinence vis-à-vis de la marque**
- Compatible mais pas distinctif. Une dizaine de marques cosmétiques ont
  exactement ce header.

**Ce que penserait le client (FemiGlow)**
- *« C'est propre, c'est correct. Mais où est mon écriture ? Je voulais
  qu'on sente la maison dès le premier pixel. Là, on a un site générique
  bien fait — pas FemiGlow. »*
- Probable demande de remontée : ajouter un quelque chose. Et c'est exact-
  ement à ce moment-là que le projet dérive en bricolage.

**Score justifié — 16.5 / 20**
- Marque 3.5/5 : la palette/typo sont là, l'âme manque.
- Ergo 5/5 : c'est l'étalon-or de l'utilisabilité.
- Élégance 1.5/3 : élégant oui, original non.
- Perf 3/3 : irréprochable.
- A11y 2/2 : irréprochable.
- Mobile 1.5/2 : le burger casse la voix de marque.

---

### Proposition n°2 — *Le Sceau*

**Forces**
- **Geste de marque immédiat.** Cacher le menu = revendiquer la lenteur.
  Cohérent avec le manifeste « beauté lente ».
- Le mot *SOMMAIRE* (au lieu de *MENU*) emprunte au vocabulaire éditorial,
  pas commercial — alignement profond avec la voix de marque.
- L'overlay plein-écran en Cormorant italique est *spectaculaire* sans
  être tape-à-l'œil. Un visiteur s'en souviendra.
- Mobile et desktop ont **strictement la même expérience** — parité rare.
- Hero des pages débarrassé de chrome → respiration totale, l'image vit.

**Faiblesses**
- **Coût d'apprentissage.** Le visiteur pressé peut ne pas comprendre où
  cliquer. Il faut un onboarding implicite (ex: tooltip animé au premier
  scroll).
- SEO comportemental : moins de clics directs vers les sections depuis le
  header → impact possible sur le maillage interne perçu.
- Demande un héros home **très fort** pour compenser. Si la home n'est pas
  immédiatement parlante, on perd le visiteur.
- Le geste est binaire : on aime ou on déteste. Pas de demi-mesure.

**Pertinence vis-à-vis de la marque**
- Maximale. C'est la proposition la plus *éditoriale*, la plus *Margiela*,
  la plus *quiet luxury*.

**Ce que penserait le client (FemiGlow)**
- *« Ça, c'est moi. Personne ne fait ça dans la cosmétique marocaine. Ça
  dit "je ne crie pas, mais je tiens debout". J'adhère totalement. »*
- *« Mais est-ce que ma maman va comprendre où cliquer ? »*
- Réaction probable partagée : enthousiasme esthétique + inquiétude
  fonctionnelle.

**Score justifié — 17 / 20**
- Marque 4.5/5 : presque idéal, mais le menu s'efface peut-être *trop*.
- Ergo 3/5 : risque réel de désorientation au premier contact.
- Élégance 3/3 : le concept le plus distinctif.
- Perf 2.5/3 : overlay JS + animations cubic-bezier = 80 lignes en plus.
- A11y 2/2 : `<dialog>` natif règle le focus trap proprement.
- Mobile 2/2 : meilleure parité mobile/desktop des trois.

---

### Proposition n°3 — *Le Sommaire saisonnier*

**Forces**
- **Profondeur éditoriale**. Chaque section est introduite, illustrée,
  donnée à voir. Le menu devient une mini-couverture de magazine.
- Le contexte saisonnier en strate haute (`SAISON DU PRINTEMPS —
  CASABLANCA`) est un **crochet de fidélisation** : qui revient au site
  voit la saison changer, c'est vivant.
- Réutilise l'investissement photo (vignettes = mini-versions des images
  hero des pages) — pas de chantier image en plus.
- Sous-liens raccourcissent les parcours stratégiques (`Acheter le kit`
  accessible depuis n'importe quelle page sans passer par `/kit`).
- Le mobile est **réellement pensé** comme un mini-sommaire, pas comme un
  drawer-fallback.

**Faiblesses**
- **Densité.** C'est la proposition qui en dit le plus, donc qui contredit
  le plus la promesse de lenteur. Risque de surcharge.
- **Gouvernance.** La saison/le lieu en haut imposent une mise à jour
  trimestrielle. Si oubliée, le menu ment sur la marque (pire qu'un
  affichage neutre).
- **Coût d'implémentation le plus élevé** : hover intention, mega-panel,
  vignettes lazy, accordéon mobile, gestion focus clavier sur deux étages.
- Le breakpoint hover/touch (à `lg:` 1024 px) est délicat — les tablettes
  iPad portrait sont à la frontière, expérience floue à `~1024 px`.
- Risque LCP : 5 vignettes images supplémentaires en `<head>`. Doivent
  être lazy au-delà du premier hover, sinon CLS.

**Pertinence vis-à-vis de la marque**
- Maximale sur le plan *éditorial* (la marque s'écrit elle-même).
- Discutable sur le plan *quiet*. C'est plus *The Gentlewoman* que
  *Margiela*.

**Ce que penserait le client (FemiGlow)**
- *« C'est exactement ce que je veux dire — une revue, une maison, un
  rythme. Et la saison ! Personne ne le fait, et c'est tellement *moi*. »*
- *« Mais qui va mettre à jour la saison ? Et est-ce que mes images
  vignettes vont être prêtes pour chaque section ? »*
- Réaction probable très enthousiaste, mais en réalisant le coût opéra-
  tionnel.

**Score justifié — 17.5 / 20**
- Marque 5/5 : c'est le plus éditorial, le plus saisonnier, le plus ancré.
- Ergo 4/5 : sous-liens raccourcissent les parcours, mais densité à gérer.
- Élégance 3/3 : la *Vogue Living* du nail-care marocain.
- Perf 2/3 : 5 images supplémentaires + JS hover intention = surcoût.
- A11y 1.5/2 : hover-pattern à doubler en clavier ; faisable mais pas gratuit.
- Mobile 2/2 : le bottom-sheet accordéon est le meilleur design mobile des
  trois.

---

## 4. Lecture transversale — qu'est-ce que chaque proposition apporte ?

| Dimension | Le Rail lent | Le Sceau | Le Sommaire saisonnier |
|---|---|---|---|
| **Geste de marque** | discret | radical | éditorial |
| **Charge cognitive** | nulle | moyenne (apprentissage) | élevée (densité) |
| **Mémorabilité** | faible | très forte | forte |
| **Profondeur d'info** | nulle | nulle | élevée (descriptions, vignettes) |
| **Ancrage saisonnier** | absent | suggéré (signature drawer) | central |
| **Coût technique** | bas | moyen | élevé |
| **Coût éditorial / gouvernance** | nul | nul | élevé (saisons à tenir) |
| **Risque principal** | sembler générique | sembler hermétique | sembler chargé |

## 5. Convergences à retenir

Trois choses font consensus entre les trois propositions :

1. **La signature `Casablanca, saison du printemps.`** revient dans 1, 2 et
   3 — c'est un acquis fort, à conserver.
2. Le **logo Pinyon Script** est le sceau identitaire — toujours en haut à
   gauche, toujours non-uppercase.
3. Les **liens en Cormorant italique** (overlay 2, mega-panel 3) ou Cormorant
   small caps (3 strate principale) sont systématiquement plus *signature*
   que l'Inter uppercase de la prop 1. La voix typographique de la marque
   est la voix éditoriale, pas la voix institutionnelle.

## 6. Recommandation

Aucune des trois ne « gagne » seule. La proposition gagnante est celle qui :

- **Garde le geste radical de la 2** (un acte d'élégance, un overlay qui
  laisse les pages respirer), pour la mémorabilité et l'âme.
- **Reprend la profondeur éditoriale de la 3** (descriptions courtes,
  vignette saisonnière, signature de saison), pour le crochet et l'ancrage.
- **Évite le coût technique excessif de la 3** (pas de hover-mega-panel,
  pas de gouvernance trimestrielle obligatoire) en intégrant le saisonnier
  *à l'intérieur* de l'overlay, pas dans une strate permanente.
- **Garde l'ergonomie irréprochable de la 1** en ajoutant des indices de
  découverte (tooltip au premier scroll, libellé `SOMMAIRE` au lieu de
  `☰`/`MENU`) pour que la mère du fondateur sache où cliquer.

→ Voir [`proposition-finale.md`](proposition-finale.md).
