# HP-SEC-DEF-ALL-04 — Contenu du kit, vue plongeante (packshot en contexte)

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-DEF-ALL-04` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `default` / `_all` (crossLocale) / `04` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Aucune main |
| H1 affiché au-dessus | FR « Titre habituel de /kit (aucun texte d'angle) » · AR « العنوان المعتاد لـ /kit » |
| Sorties | `generated/kit-hero-produit/secondary/default/_all/04-contenu-du-kit-plongee.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/default/_all/04-contenu-du-kit-plongee.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/default/_all/04-contenu-du-kit-plongee.alt.json` |
| Copié aussi vers | `HP-SEC-C-ALL-04`, `HP-SEC-E-ALL-04` (voir manifest) |

## Objectif et principe

Slide « ce qu'il y a dans la boîte » : photo isolée qui aide à choisir, en vue plongeante (« facile »), avec un verre de thé comme repère d'échelle.

Principes (01-recherche-principes.md) : 01-A3 isolé + contextuel · 01-A13 échelle · 01-A16 vue plongeante · 01-B slide 4

Zone focale : Coffret ouvert + pots + polissoir entre 10 % et 62 % de la hauteur. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Références à joindre (dans cet ordre)

1. **REF-06** (`references/REF-06-ugc-composition-marbre.jpg`) — fidélité produit (coffret réel)
2. **REF-05** (`references/REF-05-ugc-main-foncee-kit.jpg`) — fidélité produit (coffret réel)
3. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
4. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic flat-lay photograph, straight top-down view, on a cream handmade paper sheet with a torn edge laid over ecru linen. Arrange the complete FemiGlow kit, reproduced exactly from images 1, 2 and 3: at the top, the open gift box (pale sage base with its cream insert) and its off-white lid with the sage and pink waves and the “FemiGlow” script lying beside it; below, the two square clear glass jars, open, jar 1 showing thick ivory cream and jar 2 showing fine pearly white powder, each clear lid placed next to its jar with its round label up (sage “1 paste”, pink “2 powder”); under them the sky-blue buffer lying horizontally with “Step ④ Polish & Shine” readable. At the right, a small Moroccan glass of mint tea, seen from above, as a size reference. Soft streaked morning window shadows across the paper, exactly the light of image 4. Neutral warm palette, no other props. 50 mm lens from directly above, f/5.6, everything sharp. Portrait framing, to be cropped to 4:5 and 3:4: all kit items sit between 10% and 62% of the frame height; lower 35% calm (plain paper and linen); 8% clear side margins. Mood: clean, honest, complete.
```

## Must include

- Exactement 2 pots + 1 polissoir + coffret (base + couvercle)
- Textures visibles : crème ivoire / poudre blanche nacrée
- Verre de thé comme échelle

## Must avoid

- Troisième pot, pot à feuille, « 3 shine », « fortifiant »
- Lime en céramique, pinceau, flacon
- Fleurs, pétales, accessoires en surplus
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.35.

```bash
python3 tools/hero_pack.py crop --id HP-SEC-DEF-ALL-04 --master generated/_work/HP-SEC-DEF-ALL-04/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Contenu du kit : coffret, pot de pâte n° 1, pot de poudre n° 2 et polissoir",
  "ar": "محتوى الكيت: العلبة، وعلبة المعجون رقم 1، وعلبة البودرة رقم 2، وأداة التلميع",
  "en": "What’s in the kit: box, paste jar no. 1, powder jar no. 2 and buffer"
}
```
