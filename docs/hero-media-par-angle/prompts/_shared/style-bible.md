# Bible de style — images hero FemiGlow

Bloc commun collé **en tête de chaque prompt** (section `PROMPT-BLOCK`, en anglais). Le reste de ce fichier explique les règles aux humains et sert de grille de relecture.
Sources : `../../02-references-et-style.md` §4 (charte), `../../01-recherche-principes.md` (A, D, E), tokens du site (`apps/web/src/styles/tokens.css`).

## 1. Palette

| Rôle | Hex | Usage dans l'image |
|---|---|---|
| Crème (fond) | `#FBF8F1` / `#F5EFE3` | Lin écru, papier fait main, murs chaulés. Aussi la couleur des gouttières des assemblages. |
| Encre (ombres profondes) | `#2C2A28` / `#4A4744` | Noir chaud, jamais `#000`. |
| Sauge | `#C5DBC4` (label réel ≈ `#B5D0C2`), sauge foncée `#4F6D52` | Label du pot 1, vague du coffret, manches sauge. |
| Pétale | `#F2CECC` (label réel ≈ `#E0AEB8`), `#B14F4A` | Label du pot 2, vague du coffret, nude des lits d'ongle. |
| Ciel (polissoir) | `#C5DBE5` dans les tokens ; **polissoir réel plus saturé ≈ `#6FAAD0`–`#78AAD4`** | Face supérieure du polissoir uniquement. |
| Champagne | `#C8A876` / `#E8D9BC` | Reflets métal brossé discrets, jamais doré brillant. |

Les valeurs « réel ≈ » sont mesurées sur les photos clientes REF-05, REF-06 et REF-10 (échantillonnage, à ±10 %).

## 2. Lumière, matières, optique, grain

- **Lumière** : naturelle, diffuse, latérale **depuis la gauche** (fenêtre ou rideau de lin), du matin ou de fin d'après-midi ; ombres douces, rayons striés possibles sur la surface (REF-09). Pas de flash, pas de spot, pas de contre-jour dur. Exception : panneau « salon » de l'angle E (néon froid et plat, volontairement moins flatteur, 01-A9).
- **Matières** : lin froissé, papier épais à bord déchiré, marbre crème veiné, bois clair brut, céramique non émaillée, tadelakt blanc cassé, coussins de sedari tissés sobres.
- **Optique** : 35–50 mm pour les scènes, 85–100 mm macro pour les ongles ; faible profondeur de champ ; mise au point sur les ongles.
- **Grain** : rendu argentique doux type Kodak Portra 400, esprit Kinfolk/Aesop ; pas de HDR, pas de peau plastique, pas de gloss artificiel.

## 3. Cadrage et zones de sécurité

- **Master** : portrait (2:3 si le modèle impose 1024×1536), recadré ensuite en **4:5 desktop (1200×1500)** et **3:4 mobile (1125×1500)** par `tools/hero_pack.py`.
- **Point focal** (l'ongle brillant) dans les **60 % supérieurs** de l'image finale ; dans le master, viser **10 %–55 %** de la hauteur.
- **Rien d'essentiel** dans les **30 % inférieurs** (barre sticky, ≈ 35 % bas du master) ni dans les **8 % latéraux** (peek de la slide suivante, flèches).
- **Main droite, vue à la 1re personne** : la main entre par le **bord inférieur droit**, doigts vers le haut ou le haut-gauche ; ce qui se saisit (polissoir) est tenu **par son extrémité droite** (01-A4).
- **Un seul point focal** par image (01-A12) ; pas de collage en slide 1.
- **Séquences** (avant/après, étapes, comparaison) : **toujours verticales**, de haut en bas, pour rester valables en LTR et RTL (01-A10, 01-D).

## 4. Codes culturels et pudeur (public marocain)

- Manches **longues ou mi-longues** couvrant le poignet, tissus simples (lin, coton, maille) ; pas de bras nus, pas de décolleté.
- Pas de bijoux du tout dans le pack (la charte tolère des bijoux fins, mais ils détournent l'œil des ongles et le modèle les rend souvent dorés et brillants).
- **Pas de henné** dans les images générées (il colore l'ongle et brouille la preuve « ongle naturel »).
- Décor marocain **reconnaissable mais sobre** : verre de thé à la menthe, sedari, tadelakt, fouta ; **pas** de zellige saturé, de lanternes-clichés ni de couleurs criardes.
- **Angle D** : eau, mains, sobriété ; **aucune** mise en scène de prière (tapis, chapelet, mosquée, calligraphie, aiguière décorative).
- **Visages** : jamais dans le pack. Si un visage devait apparaître un jour, il regarde les ongles, jamais l'objectif (01-A7).

## 5. Carnations et âges (rotation)

Politique : représenter le public marocain réel, **olive à brun**, en alternant clair-olive / medium / medium-mat / brun foncé, de 20 à 55 ans, avec **au moins deux mains mûres**. Jamais de mains de stock caucasiennes manucurées (01-A8).

| Carnation | Images |
|---|---|
| Claire olive à claire-medium (Fitzpatrick III) | PRI-C, PRI-TEMOIN (= défaut), SEC-DEF-03 (mûre), SEC-B-01, SEC-D-02 |
| Medium olive (III–IV / IV) | PRI-A, PRI-E (mûre), SEC-DEF-02, SEC-C-01 (mûre) |
| Medium-mat (IV–V) | PRI-D, SEC-A-01, SEC-E-01 |
| Brun foncé (V–VI) | PRI-B, SEC-DEF-01, SEC-B-02, SEC-D-01 |

Le casting exact (âge, manche) est indiqué dans chaque fichier de prompt et dans `manifest.json` (`talent`).

## 6. Ongles (règle absolue)

Ongles **naturels**, courts à moyens, arrondis ou carrés doux, lit d'ongle rose-beige, **bord libre blanc naturel et fin**, cuticules nettes mais naturelles. Brillance **naturelle polie** : un reflet net par ongle, la texture de l'ongle reste visible. **Jamais** de vernis, de gel, de capsules, de top coat bombé, d'effet « miroir » plastique, de couleur.

## PROMPT-BLOCK

<!-- PROMPT-BLOCK -->
```text
STYLE: photorealistic editorial photograph for a natural nail-care brand, shot on a full-frame camera, soft film grain like Kodak Portra 400, natural colours, no HDR, no retouched plastic skin. Warm cream palette (#FBF8F1, #F5EFE3) with soft sage (#C5DBC4) and petal pink (#F2CECC) accents, warm black shadows, never pure black. Light: natural diffused daylight from the left through a window or linen curtain, soft shadows. Subject: a real woman's RIGHT hand seen from her own point of view (first person), entering the frame from the lower right; when both hands appear, the right hand is the active one; her face is never shown. Nails: short to medium, natural and bare, pink-beige nail beds, thin natural white free edges, natural cuticles, a crisp natural shine with one clean highlight per nail; never nail polish, gel, acrylic, tips or colour. Modest styling: a plain long or mid-length sleeve covers the wrist; no rings, no bracelets, no henna, no tattoos. Real, sober Moroccan home details only when asked. No text, letters, numbers, logos, watermarks or captions anywhere, except the printed product labels described below.
```
