# HP-SEC-DEF-ALL-01 — Avant/après vertical : terne → brillant

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-DEF-ALL-01` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `default` / `_all` (crossLocale) / `01` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | assemblage vertical de 2 panneaux (2 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-ABSENT` |
| Main (casting) | Peau brun foncé (Fitzpatrick V–VI), ~34 ans, manche longue en lin sauge |
| H1 affiché au-dessus | FR « Titre habituel de /kit (aucun texte d'angle) » · AR « العنوان المعتاد لـ /kit » |
| Sorties | `generated/kit-hero-produit/secondary/default/_all/01-avant-apres-terne-brillant.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/default/_all/01-avant-apres-terne-brillant.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/default/_all/01-avant-apres-terne-brillant.alt.json` |
| Copié aussi vers | `HP-SEC-A-ALL-03` (voir manifest) |

## Objectif et principe

Slide 2 partagée : preuve du contraste, honnête (même main, même lumière, même cadrage). Verticale : avant en haut, après en bas, donc neutre FR/AR/EN.

Principes (01-recherche-principes.md) : 01-A9 avant/après honnête · 01-A10 / 01-D vertical = neutre LTR/RTL · 01-B slide 2 · 01-F anti-patterns 6 et 7

Zone focale : Haut : ongles entre 30 % et 70 % du panneau. Bas : ongles entre 10 % et 40 % du panneau (soit 55–70 % de l'image finale). Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Ordre de génération et panneaux

Générer les panneaux **dans l'ordre indiqué** : le premier panneau validé sert de référence « même main, même lumière » aux suivants. Format de chaque panneau : paysage 3:2 (ex. 1536×1024), qualité maximale. Enregistrer chaque panneau validé dans `generated/_work/HP-SEC-DEF-ALL-01/<panneau>.png`.

### Panneau 1 — `bas-apres` (position finale : bas, ancre de recadrage 0.3)

Références à joindre (dans cet ordre) :

1. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=bas-apres -->
```text
Photorealistic landscape photograph, top-down first-person view of a woman's right hand lying flat on crumpled cream linen. Use image 1 for skin and hand: deep brown skin (Fitzpatrick V–VI), about 34 years old, realistic skin texture. The hand enters from the lower right edge, fingers pointing toward the upper left, slightly apart, back of the hand up. Nails: short, bare and natural, softly rounded, pink-beige nail beds, thin natural white free edges, a clear natural shine with one crisp highlight per nail like image 2. No polish. A sage linen long sleeve covers the wrist at the bottom right corner. Soft diffused morning window light from the left like image 3, gentle shadow to the right. 50 mm lens, f/4, everything on the nails sharp. Composition for a 3:2 landscape panel that will be cropped slightly top and bottom: place the five nails in the upper part of the panel, between 10% and 40% of the panel height; the lower half shows the back of the hand and linen; keep 8% clear margins left and right. No product, no text.
```

### Panneau 2 — `haut-avant` (position finale : haut, ancre de recadrage 0.5)

Références à joindre (dans cet ordre) :

1. **Panneau `bas-apres` validé** (`generated/_work/HP-SEC-DEF-ALL-01/bas-apres.png`) — même main, même lumière (panneau déjà validé)
2. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=haut-avant -->
```text
Edit image 1. Keep exactly the same hand, the same pose, the same linen, the same framing, the same light and the same skin. Change only the nails to their state before the treatment: the same bare natural nails but dull and matte, no highlight at all, slightly uneven surface with faint vertical ridges, a little dryness at the cuticles and on the side folds, the free edges slightly irregular. Keep the nails clean and healthy-looking, natural colour, no polish, no stains, no damage beyond everyday dullness. Do not change the skin tone, the hand, the sleeve or the background; you may lower the saturation of the linen background by about 10%, never the nails or the skin. Reframe so that the five nails sit between 30% and 70% of the panel height, centred, with 8% clear margins left and right. Photorealistic, same 3:2 landscape format, no text, no product.
```

### Assemblage

Panneaux de haut en bas : `haut-avant` → `bas-apres`.

```bash
python3 tools/hero_pack.py stack --id HP-SEC-DEF-ALL-01 \
  --panels generated/_work/HP-SEC-DEF-ALL-01/haut-avant.png generated/_work/HP-SEC-DEF-ALL-01/bas-apres.png \
  --anchors 0.5 0.3
```

## Must include

- Même main, même pose, même lumière dans les deux panneaux
- Avant = terne (pas abîmé), après = brillant
- Avant en haut, après en bas

## Must avoid

- Flèches, mots « avant/après », chiffres incrustés
- Différence de peau/éclairage entre panneaux
- Retouche « beauté » qui change la main
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Assemblage `stack` : panneau haut = haut-avant (ancre 0.50), panneau bas = bas-apres (ancre 0.30), gouttière 12 px #FBF8F1.

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Avant, en haut : ongles naturels ternes. Après, en bas : les mêmes ongles brillants, sans vernis",
  "ar": "قبل، في الأعلى: أظافر طبيعية باهتة. بعد، في الأسفل: الأظافر نفسها لامعة دون طلاء",
  "en": "Before, top: dull natural nails. After, bottom: the same nails shining, no polish"
}
```
