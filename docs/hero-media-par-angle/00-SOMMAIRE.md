# Images hero par angle publicitaire — sommaire

**But :** sur `/kit`, la première image et la galerie changent selon la publicité d'où vient la visiteuse (`utm_content` A à E, ou « témoin ») et selon la langue (FR, AR, EN).

Ce dossier contient tout le nécessaire pour y arriver :
- la recherche qui justifie les choix ;
- les références visuelles du vrai produit ;
- le pack prêt à être donné à un agent de génération d'images ;
- le plan technique pour afficher et administrer ces images sur le site.

## Les 4 parties

| # | Partie | Fichiers | À quoi ça sert |
|---|---|---|---|
| 1 | **Recherche** | `01-recherche-principes.md` | Les principes qui font convertir une image hero, sourcés (Kolenda, Baymard, NN/g, CXL, web.dev…) : le résultat en slide 1, la main droite vue à la 1re personne, aucun texte incrusté, un avant/après vertical, le message match par angle, les zones de sécurité mobiles, les codes culturels et les anti-patterns. |
| 2 | **Références et style** | `02-references-et-style.md`, `references/` (REF-01 à REF-10 + REF-04b, `INDEX.md`) | Ce qu'est réellement le produit : 2 pots, labels « 1 paste » et « 2 powder », polissoir « Step ④ Polish & Shine », coffret. Aussi : les images du site utilisables comme références, celles à ne jamais utiliser, la palette et la charte photo. |
| 3 | **Pack de génération** | `README.md` (procédure), `manifest.json` / `manifest.md` (liste des images), `prompts/` (bible de style, verrou produit, exclusions, 17 fichiers de prompt), `tools/hero_pack.py`, `generated/` | Tout ce qu'il faut pour produire les images avec gpt-image-2 : quelles images, quelles références joindre et dans quel ordre, les prompts en anglais, le recadrage 4:5 et 3:4, la QA, le journal et les noms de fichiers attendus par l'import. |
| 4 | **Architecture technique** | `05-architecture-technique.md` | Comment le site choisit et affiche l'image : tables d'ensembles de médias, chaîne de repli angle → langue → défaut, LCP, tracking `hero_media_variant`, admin (brouillon, publication, historique) et script d'import. |

## Ce que contient le pack (en bref)

- **6 images principales** : une par angle (A reflet macro, B verre de thé, C ongles nus sains, D gouttes d'eau, E salon marocain, témoin main + kit ouvert). La version **témoin** sert aussi d'image par défaut.
- **4 slides partagées** : avant/après vertical, rituel en 3 gestes, kit en main (échelle) et contenu du kit.
- **7 slides propres aux angles** :
  - A : texture de l'ongle ;
  - B : avant/après au quotidien, et tourner une page ;
  - C : ongle abîmé par le semi-permanent → ongle sain ;
  - D : l'eau perle, et la main séchée ;
  - E : salon vs maison.
- **Volume :** 17 slides, soit 23 générations. Chacune est livrée en 4:5 (desktop) et en 3:4 (mobile), ce qui fait 34 fichiers, plus 14 copies.
- **Aucune version par langue n'est nécessaire.** Les images ne contiennent pas de texte et toutes les séquences sont verticales : les mêmes fichiers servent FR, AR et EN. Seul le texte alternatif change.
- Les vraies photos clientes s'ajoutent automatiquement après ces slides. On ne génère jamais de faux avis.

## Dans quel ordre avancer

1. **Relire** les parties 1 et 2 (30 min) ; ajuster si besoin un angle ou un casting dans `manifest.json` et le fichier de prompt concerné, puis lancer `python3 tools/hero_pack.py validate`.
2. **Générer** en suivant `README.md` §6 : d'abord les images P1 (les 6 principales et les 4 slides partagées), puis les P2. Pour chaque image : `python3 tools/hero_pack.py prompt --id …`, joindre les références dans l'ordre indiqué, générer, contrôler (checklist §7), recadrer (`crop` / `stack`), noter la tentative dans `generated/_log.csv`. Finir par `place-copies` et `status`.
3. **Comparer** chaque image principale au Reel de son angle (même plan, même main, même lumière). Régénérer si le message match n'y est pas.
4. **Implémenter** le site selon `05-architecture-technique.md` §6 (PR 1 à 5, avec le drapeau coupé).
5. **Importer** `generated/` en brouillon (`pnpm import:component-media … --dry-run`, puis sans `--dry-run`). Relire dans l'admin (matrice angle × langue, alts, aperçu), puis publier.
6. **Activer** le drapeau, vérifier (05 §7), puis **mesurer** par variante : clics sur « Commander » et taux de swipe.
