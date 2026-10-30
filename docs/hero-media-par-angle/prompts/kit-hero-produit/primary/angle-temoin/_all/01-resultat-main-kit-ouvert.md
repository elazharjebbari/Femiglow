# HP-PRI-TEMOIN-ALL-01 — Résultat générique : main au-dessus du kit ouvert

| Champ | Valeur |
|---|---|
| Identifiant | `HP-PRI-TEMOIN-ALL-01` |
| Composant / slot | `kit-hero-produit` / `primary` |
| Variante / langue / position | `angle-temoin` / `_all` (crossLocale) / `01` |
| Priorité | P1 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau claire-medium (Fitzpatrick III), ~29 ans, manche longue en lin crème |
| H1 affiché au-dessus | FR « La manucure japonaise à la maison — Kit de manucure japonaise, des ongles qui brillent en cinq minutes » · AR « المانيكور الياباني في البيت — كيت المانيكور الياباني، أظافر تلمع في خمس دقائق » |
| Sorties | `generated/kit-hero-produit/primary/angle-temoin/_all/01-resultat-main-kit-ouvert.png` (4:5, 1200×1500) · `generated/kit-hero-produit/primary/angle-temoin/_all/01-resultat-main-kit-ouvert.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/primary/angle-temoin/_all/01-resultat-main-kit-ouvert.alt.json` |
| Copié aussi vers | `HP-PRI-DEF-ALL-01` (voir manifest) |

## Objectif et principe

Slide 1 témoin « la manucure japonaise à la maison » (contrôle de l'A/B test) et slide 1 par défaut : main aux ongles brillants + kit ouvert, sans argument d'angle.

Principes (01-recherche-principes.md) : 01-A1 résultat + kit secondaire · 01-B slide 1 générique · 01-C témoin · 01-F anti-pattern 1 (pas de packshot seul)

Zone focale : Ongles entre 15 % et 45 % de la hauteur ; kit entre 40 % et 62 %. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

**Message match :** si le Reel de cet angle existe, comparer son premier (ou dernier) plan avec ce prompt avant de générer. Si le plan, la main ou la lumière diffèrent, joindre ce frame en dernière image de référence (rôle « composition / lumière ») et ajuster la scène pour reprendre le même plan (01-A11).

## Références à joindre (dans cet ordre)

1. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
2. **REF-06** (`references/REF-06-ugc-composition-marbre.jpg`) — fidélité produit (coffret réel)
3. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles
4. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic photograph, first-person point of view, gentle top-down angle: a woman's right hand hovers just above the open FemiGlow kit on a cream linen cloth laid over a pale marble table. The kit is reproduced exactly from images 1 and 2: both square jars open (ivory cream in jar 1, fine pearly white powder in jar 2), their lids with the round sage “1 paste” and pink “2 powder” labels leaning against them, the sky-blue buffer to the right with its long side horizontal, the box behind with its lid set aside. Hand: light-medium olive skin (Fitzpatrick III), about 29, like image 3; back of the hand toward the camera, fingers relaxed, entering from the lower right. Short bare natural nails with a crisp highlight on each nail, no polish. A cream linen long sleeve at the wrist. Soft streaked morning window light from the left, exactly the mood of image 4, warm cream palette. 50 mm lens, f/3.2, focus on the nails, the kit sharp enough to recognise. Portrait framing, to be cropped to 4:5 and 3:4: the nails sit between 15% and 45% of the frame height and the kit just below them, between 40% and 62%; lower 35% calm (linen cloth and marble); 8% clear side margins. Mood: simple, luminous, five-minute ritual at home.
```

## Must include

- Kit ouvert complet (2 pots, polissoir, coffret)
- Main au premier plan, ongles brillants
- Lumière striée du matin

## Must avoid

- Packshot sans main
- Troisième pot, couvercle métal
- Texte en dehors des labels
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40. Ce fichier est aussi copié en défaut (HP-PRI-DEF-ALL-01).

```bash
python3 tools/hero_pack.py crop --id HP-PRI-TEMOIN-ALL-01 --master generated/_work/HP-PRI-TEMOIN-ALL-01/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Ongles naturels brillants au-dessus du kit de manucure japonaise FemiGlow ouvert",
  "ar": "أظافر طبيعية لامعة فوق كيت المانيكير الياباني FemiGlow المفتوح",
  "en": "Shiny natural nails above the open FemiGlow Japanese manicure kit"
}
```
