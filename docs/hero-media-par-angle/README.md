# Pack de génération — images hero FemiGlow par angle et par langue

Point d'entrée pour **l'agent de génération d'images (gpt-image-2)** et pour les humains qui relisent.
Composant cible : `kit-hero-produit` (galerie hero de `/kit`). Date : 30/10/2026.

À lire avant de générer : ce README, puis `prompts/_shared/` (3 fichiers). Le *pourquoi* est dans `01-recherche-principes.md` (principes sourcés), le *quoi* produit dans `02-references-et-style.md` et `references/INDEX.md`, le *où ça va* dans `05-architecture-technique.md` §4.8.

---

## 1. Objet

Produire, pour chaque angle publicitaire (`utm_content` = `a` … `e`, `temoin`) et pour le défaut :

- une image **primaire** (slide 1, LCP) qui montre le **résultat** et fait écho au H1 de l'angle (message match) ;
- une liste **secondaire** de 4 images (les photos clientes publiées sont ajoutées après, automatiquement, par le site) ;
- chaque image en **deux recadrages** : desktop **4:5 (1200×1500)** et mobile **3:4 (1125×1500)**, plus ses textes alternatifs FR/AR/EN.

Les fichiers produits suivent **exactement** la convention d'import de `05-architecture-technique.md` §4.8, pour être importés en brouillon par `pnpm import:component-media -- --root generated/`.

## 2. Plan du dossier

```
docs/hero-media-par-angle/
├── 00-SOMMAIRE.md                 vue d'ensemble pour la cliente / le projet
├── 01-recherche-principes.md      principes CRO sourcés (référencés « 01-A4 », « 01-C », « 01-F » …)
├── 02-references-et-style.md      inventaire des images du site, bible de style, produit réel
├── 05-architecture-technique.md   modèle de données, résolveur, admin, import (§4.8)
├── README.md                      ce fichier
├── manifest.json                  SOURCE DE VÉRITÉ : toutes les images, chemins, références, alts
├── manifest.md                    le même manifest en tableaux lisibles
├── references/                    REF-01 … REF-10 + REF-04b (+ INDEX.md)
├── prompts/
│   ├── _shared/style-bible.md     bloc STYLE (collé en tête de chaque prompt)
│   ├── _shared/product-lock.md    blocs PRODUCT LOCK (FULL = produit visible / ABSENT = aucun produit)
│   ├── _shared/negative.md        bloc « Avoid: … » (collé en fin de prompt)
│   └── kit-hero-produit/<slot>/<variant>/<locale>/<nn>-<slug>.md   un fichier par image (17)
├── tools/hero_pack.py             assembler les prompts, recadrer, empiler, copier, valider
└── generated/                     SORTIES (non commitées, cf. generated/.gitignore)
    ├── _log.csv                   journal de toutes les tentatives
    ├── _work/<id>/                masters et panneaux bruts (master.png, <panneau>.png)
    └── kit-hero-produit/<slot>/<variant>/<locale>/<nn>-<slug>.png | .mobile.png | .alt.json
```

## 3. Décisions de conception (courtes, justifiées)

1. **Tout est `_all` (sans texte, `crossLocale`) : aucun dossier `fr` / `ar` / `en` n'est créé.** Une image n'est déclinée par langue que si elle contient du texte, une lecture temporelle gauche→droite ou un cadrage culturel différent (01-D). Ici :
   - aucune image ne contient de texte hors étiquettes produit (anglais, identiques partout) — prix, code promo et H1 restent en HTML (01-A11, 01-D, F3) ;
   - toutes les séquences sont **verticales**, de haut en bas : avant/après (avant en haut), rituel (1 paste → 2 powder → polissoir) et comparaison salon / maison (salon en haut). Le haut→bas se lit pareil en LTR et RTL, donc pas de version AR miroir (01-A10, F7, F8) ;
   - **angle E** : la comparaison salon / maison était la seule candidate à une déclinaison (prix incrustés, ordre gauche/droite). Elle est verticale et **sans prix**, car le prix dépend du code promo (199 DH sans code, cf. `registry.ts`) et doit rester en HTML. Elle reste donc `_all` ;
   - le cadrage culturel (Maroc : thé, sedari, tadelakt, manches longues) vaut pour les trois publics. Le public `en` (diaspora, touristes) arrive via des pubs marocaines ; il garde la même image pour garder le message match.

   Si plus tard une image doit porter du texte, créer `…/<variant>/fr|ar|en/` et un **ensemble complet** par langue (05 §4.1 : on ne mélange jamais deux listes).

2. **Une primaire dédiée par angle (6 générations)**, plus le défaut. Le **défaut** reprend à l'identique la primaire **témoin** (copie, même sha256). Ainsi, le bras témoin de l'A/B ne diffère du trafic hors pub que par le texte, et l'on remplace l'actuel packshot REF-01 (anti-pattern F1 : pas de résultat visible).

3. **Les slides secondaires partagées sont générées une fois, dans `default`.**
   - **Partagées** (01-C : « les slides 3 à 5 sont partagées ») : avant/après générique, rituel en 3 gestes, kit en main (échelle) et contenu du kit.
   - **Spécifiques**, seulement où l'angle a besoin d'une preuve propre :
     - **A** : macro du bord de l'ongle (aucune épaisseur de vernis) ;
     - **B** : avant/après dans un geste du quotidien, et le geste « tourner une page » ;
     - **C** : ongle abîmé après le semi-permanent → ongle sain et brillant ;
     - **D** : gouttes qui perlent sur l'ongle, et la main séchée dans une fouta, sans aucune mise en scène religieuse ;
     - **E** : comparaison verticale salon / maison.

4. **Copies plutôt que régénération.** Un ensemble secondaire est publié **en entier** (05 §4.1). La liste d'un angle doit donc contenir aussi les slides partagées. On y **copie octet pour octet** les fichiers du défaut (`tools/hero_pack.py place-copies`). L'import les dédoublonne par sha256 (05 §4.8, étape 2), donc aucun média n'est stocké en double. L'angle **témoin** n'a pas d'ensemble secondaire : il hérite du défaut.

5. **Volume maîtrisé.**
   - **17 slides à générer**, soit **23 appels de génération**, car les assemblages se font panneau par panneau.
   - Cela donne **34 fichiers image** générés (desktop et mobile).
   - Il faut y ajouter **14 copies**, ce qui fait **62 fichiers image** dans `generated/`.

6. **Les assemblages (avant/après, rituel, salon/maison) se génèrent par panneaux.**
   - On génère d'abord le panneau « après » (ou « maison »).
   - Le panneau « avant » est ensuite produit **en mode édition à partir du panneau validé** : même main, même lumière, seuls les ongles changent. C'est la condition d'un avant/après honnête (01-A9, F6).
   - Les panneaux sont empilés par l'outil, avec une gouttière crème de 12 px.

7. **Pas de fausses photos clientes.** La preuve sociale (01-B slide 5) vient des vraies photos publiées, ajoutées automatiquement après la liste secondaire. On ne génère **jamais** d'image « UGC » ni d'image présentée comme une cliente réelle.

8. **REF-01 n'est pas joint par défaut** : ses étiquettes sont en sérif, on y lit « Step 4 — » et son pot 1 contient de la poudre. Le produit est verrouillé par REF-02, REF-03, REF-05 et REF-06 (voir `prompts/_shared/product-lock.md`).

9. **EN : hypothèse à surveiller.** Les textes d'angle ne sont pas publiés en EN (le SQL `2026-10-kit-hero-angles.sql` publie FR et AR). Un visiteur `en` venu d'une pub d'angle voit donc l'image de l'angle sous le titre habituel. On l'accepte pour garder le message match avec la pub. Si ce n'est pas souhaité, publier les textes EN.

## 4. Matrice de couverture (angle × langue × slot → fichier servi)

Chaîne de repli du site : variante + langue → variante `*` → variante `fr` (crossLocale) → défaut + langue → défaut `*` → … (05 §4.3). Comme tout est en `_all` (= `*`), **les trois langues reçoivent les mêmes fichiers** ; seul l'alt change (`.alt.json` → `fr` / `ar` / `en`).

| Angle (utm_content) | Langues | `primary` servi | Niveau | `secondary` servi (ordre) | Niveau |
|---|---|---|---|---|---|
| aucun / inconnu | fr, ar, en | `primary/default/_all/01-resultat-main-kit-ouvert` (= témoin) | 5 | `secondary/default/_all/` : 01 avant-après · 02 rituel · 03 kit en main · 04 contenu | 5 |
| a | fr, ar, en | `primary/angle-a/_all/01-reflet-ongle-naturel-macro` | 2 | `secondary/angle-a/_all/` : 01 texture bord d'ongle · 02 rituel* · 03 avant-après* · 04 kit en main* | 2 |
| b | fr, ar, en | `primary/angle-b/_all/01-main-verre-de-the-ongles-nus` | 2 | `secondary/angle-b/_all/` : 01 avant-après quotidien · 02 page de carnet · 03 rituel* · 04 kit en main* | 2 |
| c | fr, ar, en | `primary/angle-c/_all/01-ongles-nus-sains-brillants` | 2 | `secondary/angle-c/_all/` : 01 avant-après semi-permanent · 02 rituel* · 03 kit en main* · 04 contenu* | 2 |
| d | fr, ar, en | `primary/angle-d/_all/01-gouttes-eau-ongles-brillants` | 2 | `secondary/angle-d/_all/` : 01 l'eau perle · 02 main séchée · 03 rituel* · 04 kit en main* | 2 |
| e | fr, ar, en | `primary/angle-e/_all/01-fini-salon-a-la-maison` | 2 | `secondary/angle-e/_all/` : 01 salon vs maison · 02 kit en main* · 03 rituel* · 04 contenu* | 2 |
| temoin | fr, ar, en | `primary/angle-temoin/_all/01-resultat-main-kit-ouvert` | 2 | hérite de `secondary/default/_all/` | 5 |

`*` = copie du fichier `default` de même slug. Niveau = rang dans la chaîne 05 §4.3 (2 = variante `*`, 5 = défaut `*`). Aucune combinaison ne tombe sur les liaisons historiques (niveau 7) une fois l'import publié.

## 5. Lire le manifest

`manifest.json` → `images[]`, une entrée par fichier final :

| Champ | Sens |
|---|---|
| `id` | `HP-<PRI\|SEC>-<A…E\|TEMOIN\|DEF>-<ALL\|FR\|AR\|EN>-<nn>` |
| `type` | `generate` (à produire) ou `copy` (`copyOf` = id source ; ne rien générer) |
| `slot`, `variant`, `locale`, `position`, `slug` | segments du chemin d'import 05 §4.8 |
| `composition` | `single` (1 génération) · `stack2` / `stack3` (2 ou 3 panneaux à générer puis empiler) |
| `productLock` | `full` → coller `PROMPT-BLOCK-FULL` ; `absent` → `PROMPT-BLOCK-ABSENT` |
| `promptFile`, `promptVersion` | fichier de prompt et sa version (à recopier dans le journal) |
| `references[]` (et `panels[].references[]`) | références **dans l'ordre** (= image 1, 2, …), avec leur rôle |
| `panels[]` | `key`, `position` finale (haut/milieu/bas), `generationOrder`, `cropAnchor`, `workFile` |
| `workFile`, `cropAnchor` | master brut et ancre verticale de recadrage (images `single`) |
| `outputs` | `desktop` (.png 4:5), `mobile` (.mobile.png 3:4), `alt` (.alt.json) |
| `targets` | dimensions finales exactes |
| `focalZone`, `safeZones` | où doit tomber l'ongle brillant, ce qui doit rester vide |
| `alt` | `{fr, ar, en}` (AR en arabe standard moderne), recopié tel quel dans `.alt.json` |
| `priority` | `P1` (primaires + slides partagées) avant `P2` (slides propres aux angles + leurs copies) |
| `talent` | casting de la main (carnation, âge, manche), rotation définie dans la bible de style |
| `rationale`, `principles` | pourquoi l'image existe (renvois à 01) |

`summary` donne les totaux ; `tools/hero_pack.py validate` vérifie qu'ils correspondent.

## 6. Procédure de génération (à suivre image par image)

### 6.0 Préparation (une fois)

```bash
cd docs/hero-media-par-angle
python3 -m pip install pillow          # pour crop / stack / status
python3 tools/hero_pack.py validate    # doit afficher OK
```

### 6.1 Ordre

1. Toutes les entrées **P1** `generate`, dans l'ordre de `manifest.md`. Commencer par `HP-PRI-TEMOIN-ALL-01` : elle sert aussi de défaut.
2. Puis les **P2** `generate`.
3. Dans un assemblage, générer les panneaux par `generationOrder` croissant. Le panneau 1 validé devient la référence des suivants.
4. Enfin `place-copies` (toutes les entrées `copy`).

### 6.2 Pour chaque image (ou chaque panneau)

1. **Assembler le prompt et la liste des références :**
   ```bash
   python3 tools/hero_pack.py prompt --id HP-PRI-A-ALL-01
   python3 tools/hero_pack.py prompt --id HP-SEC-DEF-ALL-01 --panel bas-apres
   ```
   La commande affiche les références à joindre **dans l'ordre** (image 1, image 2, …), puis le **prompt final**.
   - Prompt final = `style-bible.md#PROMPT-BLOCK` + `product-lock.md#PROMPT-BLOCK-FULL|ABSENT` + bloc `PROMPT` du fichier de l'image + `negative.md#PROMPT-BLOCK`, séparés par une ligne vide.
   - Sans l'outil, faire ce collage à la main dans cet ordre.
2. **Joindre les références** dans l'ordre exact affiché. Les prompts disent « image 1 », « image 2 » : l'ordre est sémantique.
   - Ne jamais ajouter une image de la liste « ne jamais utiliser » de `02-references-et-style.md` §5.
   - Pour une primaire, si le Reel de l'angle existe, on peut joindre son premier plan **en dernière position** (rôle « composition / lumière »). Voir la note « Message match » dans le fichier de prompt.
3. **Réglages du modèle** (gpt-image-2 ou équivalent) :
   - **mode édition / images de référence** (endpoint d'édition avec plusieurs images d'entrée), pas la génération texte seul ;
   - `quality` : **high** (maximum) ;
   - `n` : 1 ; sortie **PNG**, fond opaque ;
   - fidélité aux images d'entrée au maximum, si l'option existe (ex. `input_fidelity: high`) ;
   - `size` des images uniques (`single`) : **portrait**.
     - Si les tailles libres sont acceptées, demander **1200×1600** (3:4) : il couvre les deux recadrages sans agrandissement.
     - Sinon, prendre **le plus grand portrait disponible**, par exemple **1024×1536** (2:3), à qualité maximale.
   - `size` des panneaux (`stack2` / `stack3`) : **paysage 1536×1024** (3:2).
4. **Enregistrer le brut** :
   - image unique → `generated/_work/<id>/master.png` ;
   - panneau → `generated/_work/<id>/<panneau>.png`.
   - Garder les tentatives ratées sous `…/<nom>.try<N>.png`.
5. **QA** (§7). Si l'image échoue, voir la politique de retry (§8).
6. **Recadrer ou assembler** (une fois toutes les pièces validées) :
   ```bash
   python3 tools/hero_pack.py crop  --id HP-PRI-A-ALL-01 --master generated/_work/HP-PRI-A-ALL-01/master.png
   python3 tools/hero_pack.py stack --id HP-SEC-DEF-ALL-01 \
     --panels generated/_work/HP-SEC-DEF-ALL-01/haut-avant.png generated/_work/HP-SEC-DEF-ALL-01/bas-apres.png \
     --anchors 0.5 0.3
   ```
   La commande exacte (ordre des panneaux de haut en bas, ancres) figure dans chaque fichier de prompt. L'outil écrit le `.png` 4:5, le `.mobile.png` 3:4 et le `.alt.json`.
7. **Re-QA** sur les deux recadrages : zones de sécurité, rien de coupé.
8. **Journaliser** dans `generated/_log.csv` : une ligne par tentative (§9).

### 6.3 Règles de recadrage (appliquées par `crop`, à respecter si on recadre à la main)

| Master | Sortie | Recadrage | Redimensionnement |
|---|---|---|---|
| 1024×1536 (2:3) | desktop 4:5 → 1200×1500 | pleine largeur, hauteur 1280, décalage haut = ancre × 256 (ancre 0.40 → 102 px coupés en haut, 154 en bas) | ×1,17 (Lanczos) |
| 1024×1536 (2:3) | mobile 3:4 → 1125×1500 | pleine largeur, hauteur 1365, décalage haut = ancre × 171 | ×1,10 |
| 1200×1600 (3:4) | desktop 4:5 → 1200×1500 | hauteur 1500, décalage = ancre × 100 | ×1,00 |
| 1200×1600 (3:4) | mobile 3:4 → 1125×1500 | image entière | ×0,94 |
| plus large que la cible | toute sortie | pleine hauteur, recadrage horizontal **centré** | — |

- **Ancre par défaut : 0,40.** On coupe donc moins en haut qu'en bas, ce qui garde le point focal haut. Les ancres spécifiques (`cropAnchor`) sont dans le manifest.
- **Repères dans le master** : ce qui est entre **10 % et 55 %** de la hauteur du master tombe dans les **60 % supérieurs** de l'image finale. Ce qui est **sous 65 %** du master tombe dans les **30 % inférieurs** (zone non essentielle). La largeur n'est jamais coupée sur un master 2:3 : les marges latérales de 8 % demandées dans les prompts restent intactes.
- **Assemblages** (`stack`) : chaque panneau est mis à l'échelle pour couvrir sa bande, recadré verticalement selon son ancre, puis empilé, avec une gouttière de 12 px `#FBF8F1`.
  - 2 panneaux : 744 px de haut chacun.
  - 3 panneaux : 492 px chacun.
- **Agrandissement** : jamais au-delà de ×1,5. L'outil avertit ; dans ce cas, régénérer plus grand ou passer par un upscaler dédié.
- **Jamais de miroir horizontal** : la main droite deviendrait gauche et les étiquettes seraient inversées (F8).

## 7. Checklist QA (chaque image, chaque panneau, puis chaque recadrage)

**Produit** (si `productLock = full`)
- [ ] Exactement **2 pots** carrés en verre transparent épais à angles facettés, couvercle transparent ; **aucun 3e pot**.
- [ ] Étiquette ronde **sauge « 1 paste »** et étiquette ronde **rose « 2 powder »**, chacune avec « FemiGlow » en script, sans empattement, jamais inversées.
- [ ] Pot 1 = crème ivoire, pot 2 = poudre blanche nacrée (quand ils sont ouverts).
- [ ] Polissoir **bleu ciel saturé**, flancs blancs/gris, texte « **Step ④ Polish & Shine** ».
- [ ] Coffret : vagues sauge/rose, « FemiGlow », « MANICURE TREATMENT KIT », « Natural Nail Care System ».
- [ ] Aucun couvercle métal/doré, aucun « fortifiant », aucune résine ambrée, aucun flacon ni pinceau.
- [ ] Texte produit lisible **exact**, ou flou ; **jamais faux**.

**Produit** (si `productLock = absent`)
- [ ] Aucun produit cosmétique dans l'image.

**Ongles et main**
- [ ] Ongles **naturels**, courts à moyens, bord libre blanc fin, brillance naturelle avec un reflet net, texture visible. **Aucun vernis, gel, capsule ni couleur.**
- [ ] **Main droite** active, vue à la **1re personne**, entrant par le bas droit ; polissoir tenu par l'extrémité droite.
- [ ] 5 doigts, articulations plausibles, pas de doigt fusionné.
- [ ] Carnation et âge conformes au `talent` du manifest.
- [ ] Manches couvrant le poignet ; pas de bijoux ni de tatouage ; **pas de henné** (nulle part, et surtout pas en primaire).

**Personne et culture**
- [ ] **Aucun visage**, a fortiori aucun regard caméra.
- [ ] Angle D : **aucune mise en scène de prière** (ni tapis, ni chapelet, ni calligraphie, ni aiguière décorative).
- [ ] Décor marocain sobre, sans cliché ni zellige saturé.

**Texte et composition**
- [ ] **Aucun texte incrusté** hors étiquettes produit : ni prix, ni flèche, ni « avant/après », ni chiffre, ni filigrane.
- [ ] Point focal dans les **60 % supérieurs** des sorties 4:5 **et** 3:4.
- [ ] Rien d'essentiel dans les **30 % inférieurs** ni dans les **8 % latéraux**. Seule exception documentée : le 3e panneau du rituel.
- [ ] Un seul point focal ; lumière naturelle depuis la gauche ; pas de HDR, néon ni doré brillant.

**Assemblages**
- [ ] Même main, même peau, même lumière, même cadrage entre panneaux.
- [ ] Avant **en haut**, après **en bas** ; salon en haut, maison en bas ; rituel 1 → 2 → polissoir de haut en bas.
- [ ] L'« avant » n'est dégradé que sur les ongles (le fond au plus −10 % de saturation).

**Fichiers**
- [ ] `.png` en 1200×1500, `.mobile.png` en 1125×1500, `.alt.json` présent avec les clés `fr`, `ar`, `en` (vérifier avec `python3 tools/hero_pack.py status`).
- [ ] Le chemin respecte exactement `outputs` du manifest.

Une image ne passe que si **toutes** les cases applicables sont cochées. Un doute sur le produit = échec.

## 8. Politique de retry

- **Maximum 4 tentatives** par image ou panneau avec le même prompt, puis **escalade humaine** : noter `qa=fail` et la raison dans le journal, et passer à l'image suivante.
- **Produit faux** (3e pot, étiquette erronée, mauvais bleu) :
  1. relancer en mettant la référence produit en **image 1** ;
  2. ajouter REF-03 (étiquette en macro) ;
  3. simplifier la scène : moins d'objets, produit plus petit ou plus flou ;
  4. en dernier recours, faire une **retouche ciblée** (mode édition avec masque sur la zone produit, image générée + REF-02). Jamais de retouche « à la main » qui inventerait un design.
- **Main gauche, visage, vernis, texte parasite** : régénérer. Ne pas corriger par miroir ni par recadrage qui cacherait le défaut dans les zones sûres.
- **Avant/après incohérent** : regénérer le panneau « avant » à partir du panneau « après » validé. Ne jamais regénérer les deux indépendamment.
- **Changer le prompt**, c'est-à-dire changer la scène et pas juste relancer :
  - incrémenter `version` dans le fichier de prompt (v1 → v2) ;
  - noter la raison sous « Recadrage » ou dans une section « Historique » du fichier ;
  - reporter la nouvelle version dans le journal.
  Ne jamais changer les chemins, l'id ni les alts sans mettre à jour `manifest.json` et relancer `validate`.

## 9. Sorties et journal

- **Images finales** : `generated/kit-hero-produit/<slot>/<variant>/<locale>/<nn>-<slug>.png` (4:5) et `<nn>-<slug>.mobile.png` (3:4).
- **Textes alternatifs** : `<nn>-<slug>.alt.json` = `{"fr": "…", "ar": "…", "en": "…"}`, copié du manifest.
- **Valeurs** :
  - `variant` ∈ `default` | `angle-a` … `angle-e` | `angle-temoin` ;
  - `locale` ∈ `fr` | `ar` | `en` | `_all` (ce pack n'utilise que `_all`).
  Convention identique à 05 §4.8.
- **Bruts** : `generated/_work/<id>/…` (ignorés par l'import, qui ne lit que `generated/kit-hero-produit/…`).
- **Journal** `generated/_log.csv` : une ligne **par tentative**, y compris les échecs.
  ```
  id,file,prompt_version,refs_used,seed_attempt,qa,notes,date,model
  HP-PRI-A-ALL-01,generated/_work/HP-PRI-A-ALL-01/master.png,v1,REF-08|REF-04b|REF-02|REF-09,try1,fail,"label pot 2 illisible et faux",2026-10-31,gpt-image-2
  HP-PRI-A-ALL-01,generated/_work/HP-PRI-A-ALL-01/master.png,v1,REF-08|REF-04b|REF-02|REF-09,try2,pass,,2026-10-31,gpt-image-2
  ```
  - `seed_attempt` : la graine si le modèle l'expose, sinon `tryN` ;
  - `refs_used` : les références dans l'ordre, séparées par `|` ;
  - `qa` : `pass` ou `fail`.
- **Contrôle final** : `python3 tools/hero_pack.py place-copies`, puis `python3 tools/hero_pack.py status`. Les 31 entrées doivent être complètes, aux bonnes dimensions.

## 10. Ensuite (implémentation et mise en ligne)

1. Les PR 1 à 5 de `05-architecture-technique.md` §6 doivent être déployées (tables `component_media_sets`, résolveur, script d'import), avec `HERO_MEDIA_VARIANTS=off`.
2. Copier `generated/` sur le serveur (les images ne sont pas commitées), puis :
   ```bash
   pnpm import:component-media -- --root generated/ --component kit-hero-produit --dry-run --report import-report.json
   pnpm import:component-media -- --root generated/ --component kit-hero-produit
   ```
   - Le premier passage est à blanc : relire le rapport.
   - Le second crée les ensembles **en brouillon**.
   - Le dossier `_all` donne `locale = '*'` et `crossLocale = true` ; le fichier `.mobile` devient `mobileMediaId` ; les `.alt.json` remplissent les alts.
3. Dans **l'admin** (`/admin/components/kit-hero-produit`, onglet « Médias par audience ») :
   - relire la matrice et les alts FR/AR/EN ;
   - régler le point focal si besoin ;
   - prévisualiser `/{fr|ar|en}/kit?angle=<a…e|temoin>&hmv_preview=draft` ;
   - puis **publier** (ensemble par ensemble, ou en masse après `dryRun`).
4. Activer `HERO_MEDIA_VARIANTS=on` (ou mettre le champ CMS `mediaVariantsEnabled` à `true`), puis vérifier selon 05 §7 : `data-hero-media-variant`, `GET …/media-sets/resolve`, `view_item.hero_media_variant`, budget Lighthouse.
5. Mesurer par variante (01-C) : CTR vers « Commander », taux de swipe, croisé avec `kit_angle × hero_media_variant`.

## 11. Ce qu'il ne faut jamais faire

- Joindre une référence de la liste noire :
  - `kit-fortifiant.png`, `kit-principale.png`, `og-kit.png` ;
  - `hero-home.png`, `kit-detail-mains.png`, `hero-lifestyle.png` ;
  - `reviews1/9/11/12.jpg`, `stories/*`, `public/products/*`, `*.svg`.
- Laisser passer un **3e pot**, « fortifiant », un couvercle métal, un polissoir qui n'est pas bleu ciel, ou une étiquette mal orthographiée.
- Générer des ongles **vernis, gel, capsules ou colorés**, ou du **henné**.
- **Miroiter** une image, y compris pour l'arabe.
- Incruster du **texte** : prix, « 99 DH », code promo, titre, flèche, « avant/après », numéros d'étapes, filigrane.
- Montrer un **visage**, a fortiori un regard caméra.
- Mettre en scène la **prière** (angle D) ou tout symbole religieux.
- Fabriquer de fausses **photos clientes** ou un faux témoignage, ou présenter une image générée comme une cliente réelle.
- Faire un **avant/après truqué** : mains, lumière ou cadrage différents, ongle « avant » abîmé au-delà du réaliste.
- Placer le point focal dans le **tiers inférieur**, ou un élément clé dans les marges latérales.
- Disposer une séquence **horizontalement** dans un fichier `_all`.
- Renommer ou déplacer un fichier hors de la convention 05 §4.8, ou modifier un chemin, un id ou un alt sans mettre à jour `manifest.json` puis relancer `validate`.
- Publier directement : l'import crée des **brouillons**, et la publication passe par la relecture admin.
- Commiter les images générées.
