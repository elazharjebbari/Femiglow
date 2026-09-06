# 01 — Recherche : stories shoppables & conversion e-commerce

## 1. Pourquoi le format Stories convertit

Le format « Stories » (Instagram/TikTok/Snap) est devenu un **langage d'interface universel** :
tap-à-droite pour avancer, tap-à-gauche pour revenir, maintien pour mettre en pause,
swipe-bas pour fermer. Aucune courbe d'apprentissage → friction quasi nulle. Transposé sur une
fiche produit, il réunit trois moteurs de conversion :

1. **Preuve sociale & authenticité** — des clips « vrais » (usage réel, avant/après, témoignages
   filmés) déclenchent la confiance mieux qu'un visuel studio. Le format « éphémère/vertical »
   signale l'authenticité (codes UGC).
2. **Pédagogie produit** — montrer *comment* on utilise le produit (les 4 gestes FemiGlow) lève
   les objections d'usage et projette la cliente dans le résultat.
3. **CTA shoppable au bon moment** — un bouton « Commander » présent à chaque segment capte
   l'intention **au pic d'engagement** (juste après la démonstration/preuve), au lieu de renvoyer
   la personne chercher le CTA plus bas.

Le rythme **contrôlé par l'utilisateur** (tap pour avancer) donne un sentiment de maîtrise et
augmente le temps d'attention actif — supérieur à une vidéo linéaire passive.

## 2. Ce que disent les bonnes pratiques (benchmarks)

- **Bulles/Highlights** : cercles ~64–80 px, libellés courts, rail scrollable horizontalement,
  anneau « vu/non-vu » (état de progression). 5–7 bulles visibles max ; au-delà, on dilue.
- **Ouverture** : la bulle ouvre un viewer **plein écran 9:16**. Barres de progression segmentées
  en haut (une barre par segment), remplissage synchronisé à la lecture.
- **Contenu court** : 5–15 s par segment, 3–6 segments par story. Les premières secondes portent
  le hook (règle des ~2 s pour retenir l'attention).
- **Son** : autoplay **muet** par défaut (contraintes navigateurs + contexte public), toggle
  « activer le son » visible. Sous-titres brûlés ou piste `captions` recommandés (la majorité
  regarde sans son).
- **CTA** : persistant, en bas, contextualisé (« Commander le pack », « Voir la composition »).
  Un seul CTA primaire par segment.
- **Sortie/retour** : fermeture instantanée (X, swipe-bas, Échap) qui **restaure la position de
  scroll** de la page. Marquer la story « vue » (persistance locale) pour l'anneau.
- **Navigation inter-stories** : swipe latéral pour passer d'une bulle à la suivante sans revenir
  au rail (fluidité « une story après l'autre »).
- **Performance** : ne charger que le poster des bulles ; côté viewer, ne monter que le segment
  courant et **précharger uniquement le segment suivant**. Jamais tout le feed.
- **Accessibilité** : navigation clavier (←/→/Espace/Échap), focus trap dans le viewer,
  `aria-*`, respect de `prefers-reduced-motion` (pas d'auto-advance agressif, contrôles visibles).
- **RTL (arabe)** : inverser le sens — tap-droite = précédent, ordre des bulles et des barres de
  progression miroir. FemiGlow sert `ar` en `rtl` (`LOCALES_CONFIG`), c'est non négociable ici.

## 3. Positionnement sur la page `/kit`

Ordre actuel des sections (codé en dur dans `KitPageLayoutV2.tsx`) :
`Hero → Composition → Video4Gestes → ProductFeed → Commander(wizard) → Testimonials → Ingrédients
→ Rituels → FAQ → Journal`.

**Contrainte clé** : ne pas repousser le CTA primaire (le wizard `#commander-femiglow`) ni le
Hero. Or **le rail de bulles est peu haut et quasi sans payload**, et **le viewer est un overlay
(0 coût de layout)**. On peut donc placer les bulles tôt sans nuire au-dessus de la ligne de
flottaison.

**Recommandation** :
- **Placement primaire** : rail de bulles **juste après le Hero** (position 2), en bandeau
  « preuve & démonstration » qui accroche avant même la composition. Hauteur ~120–140 px.
- **Placement secondaire (option)** : un second rail **juste avant/au-dessus de la section
  Commander**, pour re-stimuler l'intention au moment de décider (rappel preuve sociale).
- **Absorption possible** : le contenu « 4 gestes » (aujourd'hui `Video4Gestes`) peut devenir
  **une story** parmi d'autres, évitant la redondance vidéo. À décider en P1.
- **A/B** : tester position 2 vs juste-avant-Commander via feature flag `STORIES_PLACEMENT`
  (aligné au playbook Kolenda — cf. `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`, toujours la référence
  des optimisations conversion).

## 4. Stratégie de contenu (mapping FemiGlow)

Bulles proposées (chacune = 1 story de 3–6 segments), à alimenter depuis `media/videos` :

| Bulle | Angle conversion | Contenu | CTA |
|---|---|---|---|
| **Les 4 gestes** | Pédagogie / lève l'objection d'usage | démonstration du rituel | Commander le pack |
| **Avant / Après** | Preuve du résultat | mains avant/après, gros plans | Voir la composition |
| **Témoignages** | Preuve sociale | clientes filmées, verbatims | Commander |
| **Le pack** | Désir / unboxing | déballage, textures, packaging | Commander le pack |
| **Ingrédients** | Réassurance / éducation | zoom actifs, naturalité | Voir la composition |
| **Rituel du soir** | Projection / lifestyle | ambiance, routine | Commander |

Principes : hook dans les 2 premières secondes, sous-titres systématiques, 1 CTA par segment,
cohérence de la voix de marque (douce, sensorielle — cf. mémoire projet FemiGlow), et un ordre
éditorial pensé « du désir vers la preuve vers l'achat ».

## 5. KPI & mesure

Funnel à instrumenter (cf. §03 tracking) :
`impression bulle → story_open → story_view (par segment) → story_complete → story_cta_click →
add_to_cart → purchase`, segmenté par `story_id`.

Indicateurs : **taux d'ouverture** (open/impression), **taux de complétion**, **tap-forward
rate**, **CTR CTA depuis story**, **add_to_cart attribué story**, et in fine **conversion
attribuée**. Ces métriques alimentent l'onglet analytics (cf. audit analytics existant) et
justifient le placement A/B.
