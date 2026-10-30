# HP-SEC-E-ALL-01 — Comparaison verticale : au salon (haut) / chez soi avec le kit (bas)

| Champ | Valeur |
|---|---|
| Identifiant | `HP-SEC-E-ALL-01` |
| Composant / slot | `kit-hero-produit` / `secondary` |
| Variante / langue / position | `angle-e` / `_all` (crossLocale) / `01` |
| Priorité | P2 |
| Version du prompt | v1 |
| Composition | assemblage vertical de 2 panneaux (2 génération(s)) |
| Verrou produit | `product-lock.md` → `PROMPT-BLOCK-FULL` |
| Main (casting) | Peau medium-mate (Fitzpatrick IV–V), ~39 ans, manche longue sauge (même cliente dans les deux panneaux) |
| H1 affiché au-dessus | FR « Sans rendez-vous · sans vernis — Kit de manucure japonaise, le soin du salon, chez vous, sans rendez-vous » · AR « دون موعد · بلا طلاء — كيت المانيكور الياباني، عناية الصالون في بيتكِ، دون موعد » |
| Sorties | `generated/kit-hero-produit/secondary/angle-e/_all/01-salon-vs-maison-vertical.png` (4:5, 1200×1500) · `generated/kit-hero-produit/secondary/angle-e/_all/01-salon-vs-maison-vertical.mobile.png` (3:4, 1125×1500) · `generated/kit-hero-produit/secondary/angle-e/_all/01-salon-vs-maison-vertical.alt.json` |

## Objectif et principe

Slide 2 de l'angle E : le même soin, au salon (rendez-vous, attente, lumière froide) puis chez soi avec le kit. Vertical sans prix ni texte → neutre FR/AR/EN.

Principes (01-recherche-principes.md) : 01-C angle E slide 2 · 01-A9 contraste (dégrader le cadrage « problème ») · 01-D pas de texte / prix en HTML · 01-A10 vertical

Zone focale : Haut : mains 30–70 % du panneau. Bas : ongles + polissoir 10–45 % du panneau. Zones de sécurité : rien d'essentiel dans les 30 % inférieurs ni dans les 8 % latéraux de l'image finale.

## Ordre de génération et panneaux

Générer les panneaux **dans l'ordre indiqué** : le premier panneau validé sert de référence « même main, même lumière » aux suivants. Format de chaque panneau : paysage 3:2 (ex. 1536×1024), qualité maximale. Enregistrer chaque panneau validé dans `generated/_work/HP-SEC-E-ALL-01/<panneau>.png`.

### Panneau 1 — `bas-maison` (position finale : bas, ancre de recadrage 0.3)

Références à joindre (dans cet ordre) :

1. **REF-02** (`references/REF-02-pots-ouverts-textures.png`) — fidélité produit
2. **REF-06** (`references/REF-06-ugc-composition-marbre.jpg`) — fidélité produit (coffret réel)
3. **REF-07** (`references/REF-07-resultat-ongles-peau-foncee.png`) — main / peau / ongles
4. **REF-09** (`references/REF-09-ambiance-lumiere-matin.png`) — lumière / ambiance

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=bas-maison -->
```text
Photorealistic landscape photograph, first-person view, at home on a traditional Moroccan sedari sofa with plain cream woven cushions. The woman's right hand holds the sky-blue buffer by its right end and polishes the nails of her left hand, which rests on the cushion; a light motion blur on the buffer. Buffer and kit reproduced exactly from images 1 and 2: the buffer with its saturated sky-blue top face, white and grey sides and the text “Step ④ Polish & Shine”; the two square jars with round sage “1 paste” and pink “2 powder” labels on a low wooden table, with a small glass of mint tea. Hands: medium-tan skin (Fitzpatrick IV–V) like image 3, about 39 years old, short bare natural nails with a clear shine, no polish. Sage long sleeves at the wrists. Warm afternoon window light from the left like image 4, relaxed and cosy. 50 mm lens, f/3.2. Composition for a 3:2 landscape panel that will be cropped slightly top and bottom: place the nails and the buffer between 10% and 45% of the panel height; 8% clear side margins. Only label text, no other text.
```

### Panneau 2 — `haut-salon` (position finale : haut, ancre de recadrage 0.5)

Références à joindre (dans cet ordre) :

1. **Panneau `bas-maison` validé** (`generated/_work/HP-SEC-E-ALL-01/bas-maison.png`) — même main, même lumière (panneau déjà validé)
2. **REF-08** (`references/REF-08-resultat-ongles-french-reel.jpg`) — main / peau / ongles

Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL` + le bloc ci-dessous + `negative.md#PROMPT-BLOCK`.

<!-- PROMPT panel=haut-salon -->
```text
Use image 1 as the reference for the same client: same skin, same sage long sleeves, same short bare natural nails. New scene: a busy beauty salon manicure station. The client's left hand rests on a folded white towel on a manicure table while the gloved hands of a manicurist (black nitrile gloves, no face visible) file her nails. Cool, flat overhead fluorescent light, slightly desaturated and colder palette, a blurred salon background with other clients and a waiting area, a plain wall clock out of focus suggesting waiting time. No FemiGlow product in this panel. No nail polish bottles, no UV lamp, no brand names, no readable text, no faces. The client's nails are bare and natural. Photorealistic landscape photograph, 50 mm lens, f/3.2. Composition for a 3:2 landscape panel that will be cropped slightly top and bottom: keep both pairs of hands between 30% and 70% of the panel height, 8% side margins.
```

### Assemblage

Panneaux de haut en bas : `haut-salon` → `bas-maison`.

```bash
python3 tools/hero_pack.py stack --id HP-SEC-E-ALL-01 \
  --panels generated/_work/HP-SEC-E-ALL-01/haut-salon.png generated/_work/HP-SEC-E-ALL-01/bas-maison.png \
  --anchors 0.5 0.3
```

## Must include

- Même cliente (peau, manches) dans les deux panneaux
- Haut froid/désaturé, bas chaud
- Kit lisible dans le panneau du bas

## Must avoid

- Prix, mots, logos de salon, horloge lisible
- Flacons de vernis, lampe UV, ongles vernis
- Visages
- Tout ce qui est listé dans `prompts/_shared/negative.md`

## Recadrage

Assemblage `stack` : haut = haut-salon (ancre 0.50), bas = bas-maison (ancre 0.30).

## Textes alternatifs (copiés tels quels dans le `.alt.json`)

```json
{
  "fr": "En haut, une manucure au salon ; en bas, le même soin chez soi avec le kit FemiGlow",
  "ar": "في الأعلى: مانيكير في الصالون. في الأسفل: العناية نفسها في البيت مع كيت FemiGlow",
  "en": "Top: a manicure at the salon. Bottom: the same care at home with the FemiGlow kit"
}
```
