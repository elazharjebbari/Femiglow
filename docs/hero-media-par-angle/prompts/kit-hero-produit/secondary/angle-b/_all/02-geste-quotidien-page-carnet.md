# HP-SEC-B-ALL-02 — Geste du quotidien : tourner la page d'un carnet

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-B-ALL-02` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `angle-b` / `_all` (crossLocale) / `02` |
| Priorité | P2 |
| Version du prompt | v1 |
| Composition | image unique (1 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-ABSENT` |
| Main (casting) | Peau brun foncé (Fitzpatrick V–VI), ~29 ans, manche longue en lin sauge |
| H1 affiché au-dessus | FR « Kit de manucure japonaise, zéro vernis, et vos ongles brillent » · AR « كيت المانيكور الياباني، بلا أيّ طلاء، وأظافركِ تلمع » |
| Sorties | `generated/kit-hero-produit/secondary/angle-b/_all/02-geste-quotidien-page-carnet.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/angle-b/_all/02-geste-quotidien-page-carnet.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/angle-b/_all/02-geste-quotidien-page-carnet.alt.json` |

## Objectif et principe

Slide de l'angle B : la brillance tient dans les gestes de tous les jours, sans rien à poser ni à faire sécher.

Principes (01-recherche-principes.md) : 01-A5 main vicariante · 01-A6 mouvement suggéré · 01-C angle B (liberté)

Zone focale : Ongles + coin de page entre 20 % et 55 % de la hauteur. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Références à joindre (dans cet ordre)

1. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles
2. **REF-04b** (`references/REF-04b-rituel-etapes-crop.png`) — niveau de brillance des ongles
3. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

## Prompt (EN)

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-ABSENT` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT -->
```text
Photorealistic lifestyle photograph, first-person point of view: a woman's right hand turns the page of an open notebook with blank cream pages, lying on a linen tablecloth. Use image 1 for skin and hand: deep brown skin (Fitzpatrick V–VI), about 29 years old. The thumb and index lift the corner of the page in a light, natural movement; the back of the hand and all nails face the camera. Nails: short, bare, natural, with a clear natural shine and a crisp highlight like image 2, natural free edges, no polish. A sage linen long sleeve covers the wrist; the hand enters from the lower right. In the soft background, a small glass of mint tea. No writing on the pages. Soft morning window light from the left like image 3, gentle shadows of a curtain. 50 mm lens, f/2.8, focus on the nails, slight motion in the page. Portrait framing, to be cropped to 4:5 and 3:4: the nails and the lifted page corner sit between 20% and 55% of the frame height; lower 35% calm (notebook and linen); 8% clear side margins. No product, no text. Mood: free, light, everyday.
```

## Must include

- Pages vierges (aucun texte lisible)
- Ongles bien visibles côté dos de main
- Geste en mouvement léger

## Must avoid

- Écriture, logos, téléphone de marque
- Vernis
- Visage
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Ancre 0.40.

```bash
python3 tools/hero_pack.py crop --id HP-SEC-B-ALL-02 --master generated/_work/HP-SEC-B-ALL-02/master.png
```

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "Main aux ongles nus et brillants qui tourne la page d’un carnet",
  "ar": "يد بأظافر طبيعية لامعة تقلب صفحة دفتر",
  "en": "Hand with bare, shiny nails turning a notebook page"
}
```
