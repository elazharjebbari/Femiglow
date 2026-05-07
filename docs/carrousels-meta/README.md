# Carrousels Meta — FemiGlow

> *Deux campagnes Instagram / Facebook autour de la **manucure
> japonaise** (Kit Rituel d'Éclat), conçues pour deux angles
> d'attaque distincts.*

---

## Sommaire

| Dossier              | Angle                                            | Promesse en 1 phrase                                                                                       |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [`a-sante/`](a-sante/) | **Régénération** — santé de l'ongle, sans vernis | « Tes ongles ne se cachent plus, ils se réparent. »                                                       |
| [`b-halal/`](b-halal/) | **Halal** — compatible woudou et prière           | « La beauté qui n'interrompt rien — ni l'eau, ni la prière. »                                               |

Les deux carrousels partagent :

- la même **charte visuelle FemiGlow** (`docs/images/01-charte-visuelle.md`,
  `docs/pages/FemiGlow_Charte_Graphique.md`),
- le même **format Meta** (cf. §2),
- les mêmes **principes de neuromarketing** (cf. §3 et §4),
- le même **ton éditorial** (cf. §5).

Chaque dossier contient :

```
<dossier>/
├── carrousel.md          # spécification complète : structure, copywriting,
│                          #   neuromarketing, métriques, A/B, plan de prod
└── prompts/
    ├── slide-01-cover.txt
    ├── slide-02-...txt
    ├── ...
    └── slide-08-cta.txt
```

---

## 1. Pourquoi deux carrousels distincts (et pas un seul)

| Raison                                | Conséquence                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Audiences cognitivement différentes   | La cliente santé pense bénéfice fonctionnel ; la cliente halal pense conformité religieuse — deux entrées. |
| Émotion d'amorce différente           | Curiosité (santé) vs soulagement (halal) — deux hooks.                                                    |
| Test de signal Meta                   | Deux angles = deux ad sets, attribution propre, optimisation séparée.                                      |
| Risque de dilution                    | Mélanger les deux angles dans un même carrousel saigne l'attention et brouille le pixel.                   |
| Personnalisation des audiences        | Lookalike santé ≠ lookalike halal. Chaque carrousel nourrit un signal différent.                           |

> **Recommandation Meta** : lancer les deux en simultané, audiences
> distinctes, budget équivalent (50/50) pendant **7 jours** ; puis
> réallouer 70/30 vers le gagnant tout en gardant le perdant pour
> nourrir le pixel.

## 2. Format Meta technique

| Paramètre                       | Valeur                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| **Plate-forme principale**      | Instagram Feed + Facebook Feed (placement combinés)                     |
| **Type d'annonce**              | Carrousel (Carousel Ads)                                                |
| **Nombre de slides**            | 8                                                                       |
| **Ratio**                       | **4:5 (1080 × 1350 px)** — préférence Instagram, full vertical          |
| **Format export**               | JPG ou PNG, < 30 Mo / slide, sRGB, 72-150 dpi                            |
| **Marges sûres**                | 80 px en haut et 80 px en bas (le bouton « En savoir plus » couvre le bas) |
| **Texte sur l'image**           | < 20 % de la surface (politique Meta, ancienne contrainte mais bonne hygiène lisibilité) |
| **Lien associé**                | Chaque slide pointe vers `https://femiglow.ma/kit?utm=…`                 |
| **CTA par slide**               | « En savoir plus » (le plus neutre — la maison ne crie pas)              |
| **Durée min de campagne**       | 7 jours d'apprentissage Meta (≥ 50 conversions cible recommandées)       |
| **Audience principale**         | Femmes 25-45 ans, Maroc (Casablanca, Rabat, Marrakech, Tanger), centres d'intérêt soin / beauté / spiritualité (carrousel B) |
| **Stories adaptation**          | Recroppage 9:16 (1080 × 1920) à partir de la frame centrale, livré séparément (Phase 2) |
| **Reels adaptation**            | Hors scope V1 (vidéo, dossier dédié à venir)                            |

### 2.1 Charte technique export

- **Couleurs sRGB**, jamais Adobe RGB (Meta dégrade les profils).
- **Texte intégré au layout** (pas une couche superposable) : un
  même fichier final = une seule slide.
- **Fichier nommé** `slide-XX-<slug>.png` côté production, avec le
  même slug que le prompt `.txt` correspondant.
- **Logo FemiGlow** (wordmark Pinyon Script) **uniquement** sur la
  slide 1 (top-center, 60 px de haut) et la slide 8 (centré bas).
  Les slides intermédiaires sont **sans logo** (charte « la maison
  ne se signe pas à chaque ligne »).

## 3. Architecture narrative d'un carrousel FemiGlow

Les deux carrousels suivent la même grammaire en **8 actes**,
inspirée du protocole « hook → tension → preuve → résolution →
appel ». Chaque slide est conçue pour **provoquer le swipe** vers
la suivante, en laissant une boucle ouverte (Loewenstein 1994 —
*curiosity gap*).

| # | Rôle narratif                              | Mécanique cognitive                                                                                  |
| - | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1 | **Cover / Hook**                           | Pattern interrupt + promesse en ≤ 5 mots. Contraste visuel maximal sur la palette FemiGlow.          |
| 2 | **Constat / Tension**                      | Reflète une douleur ou un doute non-formulé. Active le système 1 (Kahneman).                         |
| 3 | **Origine / Promesse**                     | Introduit le rituel comme réponse — sans encore le nommer. Crée l'anticipation.                      |
| 4 | **Démonstration mécanique**                | Visualise les 4 gestes japonais (paste / powder / shine / polish). Charge sensorielle (Krishna).     |
| 5 | **Preuve concrète**                        | Avant / après ou ingrédients. Authority by transparency (Slovic).                                    |
| 6 | **Validation sociale ou autorité**         | Témoignage / fait factuel cité. Mimétisme (Cialdini).                                                |
| 7 | **Réassurance — risque levé**              | Adresse le frein dominant (« et si je ne sais pas faire » / « et si ce n'est pas valide »).         |
| 8 | **CTA / Appel**                            | Signature maison + invitation. Pas d'urgence, pas d'exclamation. Goal gradient (Kivetz) honoré.      |

### 3.1 Boucles ouvertes par slide

Chaque slide se termine par un **micro-cliffhanger** (graphique,
typographique ou textuel) pour pousser au swipe :

- une phrase qui amorce sans terminer,
- un détail visuel coupé au bord (la slide suivante poursuit),
- un chiffre orphelin qui sera expliqué slide d'après.

## 4. Principes de neuromarketing appliqués

Synthèse des PDFs de Nick Kolenda (`docs/kolenda/Attention.pdf`,
`Color.pdf`, `Copywriting.pdf`, `Fonts.pdf`, `Luxury.pdf`,
`Pricing.pdf`, `UX.pdf`) **filtrés et adaptés** à la voix
FemiGlow.

| Principe                             | Application FemiGlow                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Picture superiority** (Paivio)     | Image > texte : 70 % de la surface est visuelle, le texte ne fait que **nommer** ce qu'on voit.           |
| **Sensory imagery** (Krishna 2012)   | Verbes tactiles (« lisser », « polir », « préparer ») et noms de matières (paste, powder, shine, polish). |
| **Curiosity gap** (Loewenstein 1994) | Slide 1 promet, slide 4 livre. Entre les deux, on retient l'information clé pour générer le swipe.         |
| **Goal gradient** (Kivetz)           | Numérotation discrète des slides (`1—8` en bas), fait monter l'engagement à mesure qu'on avance.           |
| **Authority by transparency** (Slovic 1995) | Composition listée brute (santé) ; argumentation explicite sans détour (halal).                          |
| **Loss aversion** (Kahneman & Tversky) | Slide 5 (santé) montre ce que les autres méthodes abîment, sans agressivité.                              |
| **Numerical fluency** (Wadhwa & Zhang) | Chiffres précis pour la rationalité (santé : « 5 minutes », « 4 gestes ») ; chiffres ronds pour l'émotion (320 MAD). |
| **Mere exposure** (Zajonc)           | Répétition typographique des 4 verbes (préparer · lisser · polir · révéler) à travers le carrousel.        |
| **Endowment effect** (Thaler)        | Tutoiement et possessif (« tes ongles », « ton rituel »).                                                   |
| **Cognitive ease** (Kahneman)        | Une seule idée par slide. Phrase courte. Une seule typographie corps (Inter). Une seule typographie titre (Cormorant). |
| **Color psychology** (Kolenda *Color*) | Sauge = vie, équilibre (carrousel santé) ; ciel + champagne = pureté, transcendance (carrousel halal).    |
| **Luxury restraint** (Kolenda *Luxury*) | Espace négatif > 50 %, pas d'urgence, pas d'exclamation, pas de pictos commerciaux.                        |
| **Typeface congruence** (Kolenda *Fonts*) | Cormorant Garamond (faces serif élégants) congruent avec « lent / précieux » ; Inter neutre pour le factuel. |
| **Anchoring de prix** (Kolenda *Pricing*) | Le prix (320 MAD) apparaît **après** la valeur, jamais avant — slide 7 ou 8.                              |
| **Reciprocity** (Cialdini)           | Carrousel halal : la maison **donne** une information utile (ablutions valides) avant de demander.         |
| **Social proof local** (Cialdini)    | Témoignage marocain (prénom, ville), pas de modèle générique.                                              |

## 5. Voix éditoriale (rappel)

Issue de `docs/preparation/01-marque-vision-voix.md` et de la
charte FemiGlow.

### À faire

- Tutoyer (jamais vouvoyer).
- Phrases courtes. Verbes au présent.
- Lexique imposé : « la maison », « initiée », « rituel »,
  « gestes », « éclat », « lent », « doux ».
- Espaces fines insécables avant `?` `!` `:`. Apostrophes courbes.
- Em-dashes `—` (jamais `--`).
- Numérotation arabe (1, 2, 3) pas romaine.

### À éviter

- Pas d'emojis.
- Pas de point d'exclamation.
- Pas d'urgence (« vite », « profite », « dépêche »).
- Pas de réduction (la maison n'en fait pas).
- Pas de superlatifs (« meilleur », « unique », « révolutionnaire »).
- Pas d'anglicismes commerciaux (« game changer », « must have »).
- Pas de mots agressifs (« maintenant », « ne tarde pas »).

## 6. Charte typographique des slides

| Usage                              | Police                  | Taille   | Couleur          |
| ---------------------------------- | ----------------------- | -------- | ---------------- |
| Titre slide (1 ligne max)          | Cormorant Garamond Light | 56-72 pt | Encre `#2C2A28`  |
| Sous-titre / phrase d'amorce       | Cormorant Garamond Italic | 26-32 pt | Encre 80 %        |
| Corps de slide (max 2 lignes)      | Inter Regular            | 18-22 pt | Encre 80 %        |
| Étiquettes (geste, ingrédient)     | Inter Italic 11-13 pt    | tracking 0.04 em | Brume `#6B6863` |
| Numéro de slide (`1 — 8`)          | Inter Regular 12 pt      | tracking 0.18 em | Brume 70 %       |
| Wordmark FemiGlow (slides 1 & 8)   | Pinyon Script           | 38 pt    | Encre            |
| CTA verbal (slide 8)               | Inter Medium             | 18 pt    | Encre sur sauge  |

> Le poids visuel principal est porté par **Cormorant Garamond
> Light**, jamais Bold. La maison ne crie jamais.

## 7. Charte chromatique des slides

Issue de `docs/pages/FemiGlow_Charte_Graphique.md`.

| Couleur            | Hex         | Usage carrousel A (santé) | Usage carrousel B (halal) |
| ------------------ | ----------- | ------------------------- | ------------------------- |
| Crème              | `#FBF8F1`   | fond dominant            | fond dominant             |
| Encre              | `#2C2A28`   | typographie principale   | typographie principale    |
| Sauge              | `#C5DBC4`   | accent dominant (santé)  | accent secondaire         |
| Sauge profond      | `#A8C4A6`   | détail / filets           | détail / filets            |
| Pétale (rosée)     | `#F2CECC`   | accent humain rare       | accent humain rare        |
| Ciel               | `#C5DBE5`   | accent rare              | **accent dominant** (halal) |
| Champagne          | `#C8A876`   | détail noble (filet)      | **accent rare** (filet)   |
| Brume              | `#6B6863`   | textes secondaires        | textes secondaires         |
| Sable              | `#E8E0D2`   | filets, séparations       | filets, séparations        |

> **Règle 60-30-10** : 60 % crème, 30 % accent dominant (sauge ou
> ciel selon le carrousel), 10 % encre + détails.

## 8. Métriques cibles (par campagne, 7 jours)

| Métrique                            | Cible (Meta benchmark beauté Maroc 2026 ajusté luxe) |
| ----------------------------------- | ----------------------------------------------------- |
| CTR (link click / impression)       | ≥ 1.4 %                                               |
| Swipe-through rate (slide 8 vue)    | ≥ 28 %                                                |
| Save rate                           | ≥ 0.6 %                                               |
| CPM                                 | 25-45 MAD                                             |
| CPC                                 | ≤ 4.5 MAD                                             |
| ROAS J7 (purchase / spend)          | ≥ 1.6                                                 |
| ROAS J28                            | ≥ 2.4                                                 |
| Add-to-cart rate (post-clic)        | ≥ 8 %                                                 |
| Conversion rate (post-clic)         | ≥ 3 %                                                 |

> Les benchmarks sont **indicatifs** : la maison ne court pas
> derrière un CTR, elle protège la voix. Une campagne qui sous-
> performe sur le CTR mais maintient un ROAS 28j sain est
> préférée.

## 9. Production (workflow recommandé)

```
1. Validation copywriting (carrousel.md)        → Édito
2. Génération images via prompts/*.txt          → ChatGPT image (cf. docs/images/02-guide-prompting.md)
3. Composition (texte sur image)                → Figma sur gabarit 1080×1350 fourni
4. Export sRGB PNG                              → Production
5. Upload Meta Business Manager                 → Médias
6. Configuration ad sets (audiences, budget)    → Acquisition
7. Lancement A/B 7 jours                        → Acquisition
8. Lecture KPIs J7 + ajustement                 → Acquisition + Édito
9. Itération slide 1 (hook) si CTR < 1 %         → Édito + Production
```

## 10. Itération

Les hooks (slide 1) sont les variables les plus
performantes : prévoir **3 variantes hook** pour chaque carrousel
dès la prod V1. Si la slide 1 perd, on swappe la cover sans
toucher au reste — économie et vitesse.

## 11. Conformité Meta

- Pas de promesse santé non sourcée (« régénère » → préférer
  « préserve »  ou « fortifie »).
- Pas de revendication religieuse exclusive (pas de fatwa nominale
  sans accord de l'autorité émettrice). Le carrousel halal pose
  un fait technique (« pas de barrière sur l'ongle ») sans
  revendiquer de juridiction religieuse.
- Pas de `before/after` médical-style avec flèches rouges.
- Texte < 20 % de l'image (vérifier avec `Meta Text Overlay Tool`).

## 12. Lecture suivante

- [a-sante/carrousel.md](a-sante/carrousel.md)
- [b-halal/carrousel.md](b-halal/carrousel.md)
- `docs/images/02-guide-prompting.md` pour la mécanique des prompts.
- `docs/pages/FemiGlow_Charte_Graphique.md` pour la charte source.
