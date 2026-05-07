# 02 — Guide de prompting ChatGPT pour images FemiGlow

> Synthèse des recommandations OpenAI (gpt-image-1.5 / GPT-Image-2) et des
> meilleurs guides 2026, **filtrées et réécrites pour notre cas d'usage** :
> photo éditoriale lente, marque de soin pour ongles, voix posée.
>
> Ce fichier est **prescriptif** : il dit comment écrire un prompt, pas quoi
> représenter (cf. [03-inventaire-images.md](03-inventaire-images.md)).

---

## 1. La structure canonique du prompt

ChatGPT image préfère les prompts **structurés et ordonnés**, pas les
paragraphes cursifs. Utiliser des **étiquettes courtes** ou des **sauts de
ligne**, dans cet ordre :

```
[FORMAT]      ratio + usage final (ex. "1200x800, hero web image, AVIF")
[SCENE]       lieu, surface, époque, atmosphère générale
[SUBJECT]     ce qui occupe le cadre, ses caractéristiques
[ACTION]      le geste / l'instant capturé (verbe au présent)
[FRAMING]     plan, angle, distance, profondeur de champ
[LIGHTING]    qualité, source, direction, température
[PALETTE]     couleurs dominantes nommées sémantiquement
[STYLE]       médium, références, grain, post-traitement
[MOOD]        adjectifs émotionnels (quiet, slow, intimate)
[DO NOT]      exclusions explicites (texte, logos, modèles, etc.)
```

**Règle d'or :** plutôt que d'allonger le prompt, **itérer par petites
modifications** sur la sortie (« change uniquement la lumière, garde tout le
reste »). Les prompts trop longs déstabilisent le modèle.

## 2. Mots-clés impactants par bloc

### Lumière (le plus déterminant)

| Effet voulu | Mots-clés à utiliser |
|---|---|
| Lumière du matin, voilée | *soft morning side light, diffused through linen curtain, north-facing window* |
| Heure dorée discrète | *warm late-afternoon glow, low golden side light, no direct sun* |
| Studio sobre éditorial | *soft diffuse studio light, large softbox at 30°, gentle fall-off* |
| Intérieur tactile | *available light, single large window, soft shadows* |

**À bannir** : *bright*, *vibrant*, *high-contrast*, *dramatic backlight*,
*cinematic neon*, *flash*, *ring light*, *HDR*.

### Cadrage et caméra

| Plan | Mots-clés |
|---|---|
| Plan rapproché objet | *macro close-up, 50mm lens, shallow depth of field, sharp focus on [détail]* |
| Plan moyen mains | *medium close-up, 35mm lens, hands centered, soft background blur* |
| Plan large d'ambiance | *wide editorial shot, 35mm, slight low angle, balanced negative space* |
| Vue plongée objets | *flat lay top-down view, 90° overhead, even spacing* |
| Détail texture | *macro 1:1 magnification, surface texture visible, fine grain* |

**Règle :** toujours **nommer la focale** (35mm, 50mm, 85mm). Évite
l'aspect grand-angle déformé par défaut du modèle.

### Profondeur et focus

- *shallow depth of field* — sujet net, arrière flou doux
- *deep focus* — tout net (rare ; pour flat-lay éditorial)
- *sharp focus on [élément précis]* — guide l'œil
- Éviter *bokeh balls* — trop publicitaire.

### Ambiance / mood

| Émotion FemiGlow | Mots-clés |
|---|---|
| Lenteur rituelle | *unhurried, ritual atmosphere, contemplative pause* |
| Intimité quotidienne | *intimate domestic moment, lived-in, personal* |
| Authenticité atelier | *workshop reality, tactile materials, imperfect honesty* |
| Calme méditatif | *quiet stillness, soft breath, restrained mood* |

### Style et médium

Préfixe-type **à recopier en ouverture** de prompt FemiGlow :

> *Editorial still-life photography in the spirit of Kinfolk magazine and Aesop
> product catalogs. Natural unretouched film aesthetic, subtle Kodak Portra 400
> grain, restrained palette, paper-and-linen surfaces, honest texture.*

### Palette (à formuler sémantiquement)

Ne **jamais donner les hex**. Décrire les couleurs comme un styliste :

- *warm off-white background, hand-made paper feel*
- *muted sage green accent, herbarium tone*
- *dried rose petal highlight, faded not pink*
- *brushed champagne metal, never gold or yellow*

### Texture (souvent oubliée — décisive)

À glisser dans `[STYLE]` : *visible paper grain, linen weave, ceramic
unglazed pores, brushed metal microscratches*. C'est ce qui sauve l'image
de l'aspect plastique typique du modèle.

## 3. Format et ratio

ChatGPT comprend les ratios mais préfère qu'on les **dise en mots** plutôt
qu'en pixels :

- *square 1:1*
- *vertical portrait 4:5*
- *editorial portrait 3:4*
- *wide landscape 3:2 or 16:9*
- *Open Graph card 1200×630, 1.91:1 ratio*

Toujours indiquer **l'usage final** : *« hero image for a web page, will be
displayed at 1200×800 with type overlaid »*. Le modèle ajuste le rythme et
laisse de l'espace négatif.

## 4. Exclusions (`do not include`)

Bloc **non-négociable** à coller en fin de chaque prompt FemiGlow :

```
DO NOT INCLUDE:
- any text, watermarks, logos, brand names, signage
- people facing or smiling at the camera; no influencer poses
- studio backdrops, white seamless paper, visible photography equipment
- shiny gold, chrome, glitter, pearlescent finishes
- HDR processing, oversharpening, plastic skin, beauty retouch
- vibrant saturated colors, neon, magenta, cyan
- orientalist clichés (overly bright zellige, saturated patterns, kaftans)
- alcohol, lit candles, food clutter (unless explicitly part of the subject)
```

**Pourquoi :** le modèle ajoute *par défaut* des éléments « lifestyle
généralistes » qui détonnent avec la voix lente.

## 5. Cohérence entre images (cas FemiGlow)

Le site a 18-22 images dans **5 familles** (héros, packshots, témoignages,
éditoriaux journal, social/OG). Pour les faire cohabiter :

1. **Une session ChatGPT par famille.** La mémoire intra-session aide la
   continuité ; on referme et on ouvre une nouvelle pour changer de famille.
2. **Préfixe de charte identique** en haut de chaque prompt (palette + style +
   lumière). On copie-colle, on ne paraphrase pas.
3. **Image-pilote** par famille : la première qu'on valide. Pour les
   suivantes, ajouter *« style, palette, grain and lighting consistent with
   the previous image »*.
4. **Variations de pose, jamais de style.** Si on veut une image différente,
   on change le sujet ou le cadrage, pas l'esthétique générale.

## 6. Itération propre

Après la première sortie, ne pas réécrire un prompt entier. Préférer :

> *Keep the previous image. Change only [X]. Preserve [palette / lighting /
> framing / mood]. Do not regenerate the rest.*

Le modèle dérive moins ; on garde la cohérence du shooting.

## 7. Pièges spécifiques au cas FemiGlow

| Piège | Symptôme | Antidote |
|---|---|---|
| Mains de mannequin | peau lisse plastique, ongles trop parfaits | demander explicitement *real skin texture, natural cuticles, ongles courts à moyens* |
| Cliché « hammam » | zellige bleu vif, lanternes | *understated Casablanca interior, plain plaster wall, dried flowers* |
| Pub parfum | flou doré, halo, brillant | bannir *glow, halo, bokeh balls, golden warmth* |
| Sur-saturation | rose qui devient fuchsia | demander *desaturated, faded, dusty pastel* |
| Texte parasite | étiquettes inventées | rappeler *no text* à chaque tour |
| Variabilité d'un jour à l'autre | sessions différentes | toujours réutiliser le même préfixe charte |

## 8. Modèle de prompt prêt à l'emploi (squelette)

À copier dans ChatGPT puis remplir les `[…]` selon
[03-inventaire-images.md](03-inventaire-images.md) :

```
FORMAT: [ratio + usage final]

SCENE: [lieu, surface, époque]

SUBJECT: [objet/personne, état]

ACTION: [verbe au présent — instant capturé]

FRAMING: [plan + focale + angle + profondeur de champ]

LIGHTING: soft morning side light, diffused through linen curtain,
no direct sun, gentle shadow fall-off

PALETTE: warm off-white background, deep ink black with warmth,
[1-2 accents tirés de la charte]

STYLE: editorial still-life photography in the spirit of Kinfolk and
Aesop catalog, natural unretouched film aesthetic, subtle Kodak Portra
400 grain, paper-and-linen surfaces, honest texture

MOOD: [2-3 adjectifs autorisés]

DO NOT INCLUDE: any text, watermarks, logos, brand names; people facing
the camera; studio backdrop or photography equipment; shiny gold or
glitter; HDR or oversharpening; vibrant saturated colors; orientalist
clichés.
```

## 9. Validation visuelle (avant intégration au site)

Avant de poser une image dans `apps/web/public/`, valider sur **5 critères** :

1. **Sur fond crème** — l'image se pose-t-elle sans jurer ?
2. **Lecture lente** — l'œil prend-il son temps, ou est-ce « bruyant » ?
3. **Mains** — si présentes, ont-elles l'air réelles, vivantes ?
4. **Texte parasite** — aucune étiquette inventée ?
5. **Cohérence famille** — placée à côté d'une autre image de la même
   famille, est-ce visuellement le même shooting ?

Si un critère échoue → itérer (cf. § 6), ne pas accepter par défaut.
