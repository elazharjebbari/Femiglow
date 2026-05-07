# Runbook — Ajouter un produit

Procédure pour créer un nouveau produit FemiGlow depuis zéro.
Public visé : éditeur·trice / fondatrice. Aucune écriture de code
requise.

## Pré-requis

- Compte admin (`editor` minimum, `admin` pour publier)
- Visuels prêts :
  - Packshot 1:1 (carré), idéal 2000×2000
  - Photo lifestyle 4:3 (recommandé)
  - 0..N visuels gallery (paysage / portrait)
- Texte rédigé (titre, accroche, description)
- Au moins 1 SKU + prix

## Étapes

### 1. Création de la fiche

1. Aller sur `/admin/products`
2. Cliquer **+ Nouveau**
3. Remplir :
   - **Slug** : court, lowercase-kebab (ex: `serum-eclat`).
     Ne sera **plus modifiable** après création.
   - **Titre** : nom marketing
   - **Catégorie** (optionnel)
4. Cliquer **Créer le brouillon** → redirection vers la fiche.

### 2. Onglet Général

- **Tagline** : phrase d'accroche (max 180 chars)
- **Description** : rich-text (gras, listes, citations OK)
- **Tags** : ajouter quelques mots-clés (apparaissent dans les filtres)
- **Featured** : à activer si le produit doit apparaître en home

Sauvegarde auto au blur (toast « Brouillon enregistré »).

### 3. Onglet Médias

#### Packshot (obligatoire)

1. Cliquer la carte **Packshot principal**
2. **Téléverser** un visuel 1:1 OU **Choisir** dans la médiathèque
3. Vérifier le rendu de la vignette
4. Toggle **Actif** doit être ON

#### Lifestyle (recommandé)

Pareil avec un visuel 4:3.

#### Galerie (optionnel)

Glisser-déposer plusieurs visuels d'un coup. Réordonner par drag.

### 4. Onglet Variantes

Au moins 1 variante est requise pour publier.

1. Cliquer **+ Ajouter**
2. Remplir :
   - **SKU** : unique sur le produit (`SE-30`, `SE-50`, ...)
   - **Label** : ce que voit le client (`30 ml`, `Édition limitée`)
   - **Prix** : en euros (`39,00`)
   - **Promo** : optionnel, doit être < prix
   - **Stock** : `available` par défaut

Si plusieurs variantes : drag pour ordonner (la 1ère est la
« primary », celle affichée en card de listing).

### 5. SEO (recommandé)

1. Aller sur `/admin/seo`
2. **+ Nouveau** → scope `product`, target key = slug du produit
3. Remplir title, description, OG image
4. Auditer (panel droit) → corriger les warnings
5. **Publier** l'override SEO

Sans override SEO, le produit utilisera des defaults génériques
(titre = `<title> du produit`, description = `tagline`).

### 6. Publier

1. Sur la fiche produit, cliquer **Publier**
2. Modal de confirmation : vérifier le récap
3. **Confirmer**

Le produit est immédiatement visible sur :

- `/produits` (listing)
- `/produits/<slug>` (détail)
- Le sitemap.xml l'inclut

### 7. Vérification post-publish

- [ ] `/produits/<slug>` rend correctement (titre, packshot, prix)
- [ ] `/produits` montre la card du produit
- [ ] `/admin/products` affiche statut « Publié »
- [ ] OG preview FB : `https://developers.facebook.com/tools/debug/?q=https://femiglow.com/produits/<slug>`

## Modifier un produit publié

1. Aller sur la fiche → modifier les champs souhaités
2. Le badge passe en « Modifications non publiées »
3. **Publier** pour appliquer

Tant que vous n'avez pas cliqué Publier, le front voit l'ancienne
version. Vous pouvez expérimenter sans risque.

## Archiver un produit

1. Sur la fiche → menu **…** → **Archiver**
2. Confirmer

Effet :

- Front : 410 Gone sur `/produits/<slug>` (mieux que 404 pour SEO)
- Listing : exclu
- Admin : visible si toggle « Inclure archivés »

Restauration possible via le bouton **Restaurer** dans la liste
archivée → repasse en draft.

## Erreurs courantes

| Erreur                         | Cause                            | Fix |
|--------------------------------|----------------------------------|-----|
| « Slug déjà pris »             | un autre produit utilise ce slug | choisir un autre slug |
| « Au moins 1 variante »        | publish sans variante            | ajouter une variante |
| « Aucun packshot »             | publish sans packshot            | uploader un packshot |
| « SKU déjà utilisé »           | doublon dans les variantes       | renommer |
| « promo doit être < prix »     | promo >= prix                    | ajuster |

## Conseils éditoriaux

- **Slugs** : court, mémorable, lowercase. Ne jamais utiliser
  d'accents (`creme-eclat`, pas `crème-éclat`).
- **Titre** : 40-60 chars, évocateur. C'est ce qui apparaît dans
  Google + dans les unfurls.
- **Tagline** : 80-120 chars, axe émotionnel.
- **Description** : 200-500 mots, structurée (paragraphes courts +
  listes). C'est aussi ce que lit le SEO.
- **Photos** : préférer les fonds neutres pour le packshot, scènes
  pour le lifestyle.

## En cas de doute

- Lire les warnings du linter SEO
- Demander un preview share : envoyer `/produits/<slug>?preview=draft`
  à un collègue (route protégée par cookie admin)
