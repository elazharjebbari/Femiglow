# Ton premier import d'image

Ce guide t'accompagne pas à pas pour ajouter un média (image, vidéo,
audio) à ta bibliothèque FemiGlow. Aucune compétence technique requise.

## Pré-requis

- Tu as accès à `/admin` avec ton compte fondatrice.
- Le fichier est sur ton ordinateur, en bonne définition (idéalement
  ≥ 2000px de large pour les hero, ≥ 1200px pour les images inline).
- Tu as une **alt text** prête : une phrase courte qui décrit l'image
  pour les personnes qui ne la voient pas (lecteurs d'écran, indexation).

## 1. Ouvrir la console

1. Va sur `/admin` et connecte-toi avec ton email + mot de passe.
2. Dans la barre latérale, clique sur **Médias**.

Tu vois la bibliothèque : toutes les images déjà importées, leur statut
(`Prêt`, `Traitement`, `Échec`) et un bouton **Importer** en haut à
droite.

## 2. Choisir tes fichiers

1. Clique sur **Importer**.
2. Sur la page d'import, clique sur la zone de drop ou glisse tes
   fichiers depuis ton bureau.
3. Tu peux importer plusieurs fichiers à la fois.

> **Astuce.** Le slug (identifiant texte du média) est généré
> automatiquement à partir du nom de fichier. Renomme `MaPhoto Hero.png`
> en `hero-rituel.png` avant de glisser pour avoir un slug clair.

## 3. Choisir le profil par défaut

Le **profil qualité** détermine comment l'image sera optimisée :

- **Hero** : pour les images de couverture (page d'accueil, hero d'un
  article). Plus lourdes, plus belles, chargées en premier.
- **Inline** : pour les illustrations dans le corps des pages.
  Compromis qualité/poids.
- **Thumb** : pour les vignettes (liste journal, cartes produits).
  Légères, chargées paresseusement.

Choisis un profil dans le menu déroulant **avant** de cliquer
**Importer** : il s'appliquera à tous les fichiers du batch.

## 4. Lancer l'import

Clique sur **Importer**. Une ligne par fichier s'affiche :

- ✓ vert : le média est créé, le pipeline d'optimisation démarrera
  dans la minute.
- ✗ rouge : un problème (slug déjà utilisé, fichier corrompu, taille
  excessive). Le message t'indique quoi faire.

Reviens sur la bibliothèque (`Médias`) : ton fichier apparaît avec le
badge **Traitement** puis **Prêt** (≤ 60 s sur image, jusqu'à
plusieurs minutes pour la vidéo).

## 5. Vérifier et compléter

Clique sur ton média pour ouvrir le détail.

### Onglet Métadonnées

- **Alt text** : indispensable. Si tu l'as oublié, complète-le
  maintenant.
- **Caption** : légende affichée sous l'image dans certains
  contextes (article, kit).
- **Crédit** : nom de la photographe / source.
- **Hero (LCP)** : à cocher uniquement si cette image est l'image
  principale d'une page (la première qu'on voit en haut). Le système
  préchargera l'image et utilisera la qualité maximale.

### Variantes générées

Dès que le statut passe à **Prêt**, tu vois la liste des variantes :
AVIF, WebP, JPEG dans plusieurs largeurs. Tu n'as rien à faire — le
composant `<MediaImage slug="…" />` choisira automatiquement la
meilleure pour chaque visiteur.

### Usages

Quand le média est utilisé sur une page (composant `<MediaImage>`,
`<MediaVideo>` ou `<MediaAudio>`), tu vois apparaître les routes ici.
Pratique pour comprendre où une image est consommée avant de la
remplacer.

## 6. Utiliser le média dans une page

Dans le code de ta page, utilise le slug :

```tsx
<MediaImage slug="hero-rituel" context="hero" priority />
```

C'est tout. Le composant gère :

- responsive (`<picture>` + `<source>` par format)
- lazy loading (sauf si `priority`)
- placeholder BlurHash pendant le chargement
- accessibilité (`alt` pris en base)

## Que faire si…

### Le statut reste **Traitement** trop longtemps

Plus de 5 minutes ? Va dans **Réglages** → **État** : tu y vois si le
worker est en panne. Si oui, contacte le support technique avec le
log.

### Le statut passe à **Échec**

Clique sur le média : la section **Journal** indique la raison
(format non supporté, fichier trop lourd…). Tu peux **Régénérer**
après correction, ou **Supprimer** et réimporter une version corrigée.

### Je veux remplacer une image existante

1. Va sur le média existant.
2. Clique **Supprimer** (soft delete : récupérable 30 jours).
3. Importe la nouvelle version avec le **même slug**.

Toutes les pages qui utilisent `<MediaImage slug="…" />` afficheront
automatiquement la nouvelle image — pas besoin de toucher au code.

### J'ai uploadé deux fois le même fichier

Va sur **Médias** → **Doublons**. Le système détecte les images
visuellement similaires (hash perceptuel). Choisis laquelle garder.

## Limites

- Image : 20 Mo max par fichier.
- Vidéo : 200 Mo max, durée ≤ 5 minutes.
- Audio : 50 Mo max.

Au-delà, le pipeline refuse l'import. Compresse en amont (ex.
[handbrake.fr](https://handbrake.fr) pour la vidéo).

## Glossaire

- **Slug** : identifiant texte (`hero-rituel`) utilisé dans le code et
  les URLs. Doit être unique.
- **LCP (Largest Contentful Paint)** : la plus grande image visible
  au-dessus de la ligne de flottaison. Cocher **Hero** sur cette
  image améliore les performances perçues.
- **AVIF / WebP / JPEG** : trois formats. Le navigateur choisit le
  plus moderne qu'il sait afficher. AVIF ~2x plus léger que JPEG.
- **BlurHash** : empreinte ultra-compacte (~30 octets) de l'image
  affichée en flou pendant le chargement.
