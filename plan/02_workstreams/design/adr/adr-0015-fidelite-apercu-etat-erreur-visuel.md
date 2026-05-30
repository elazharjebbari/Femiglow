# ADR-0015 — Contrat de fidélité d'aperçu et d'état d'erreur visuel

- Statut : **proposé** (conception ; aucun code applicatif modifié)
- Date : 2026-05-29
- Workstream : design
- Lié : BUG-053 (aperçu = thumbnail sm AVIF), MISS-021 (`<video src=''>`), MISS-004 (stubs 10 octets servis comme média), BUG-004/BUG-066 (slots livrables A)
- Principes : P1 (vérité), P5 (fallbacks visibles), P6 (évolutivité)
- Tâches : ACT-DS-004, ACT-DS-005

## Contexte

L'aperçu réseau (`PlatformPreview`, `media/PlatformPreview.tsx:281-304`) promet « ce que vous voyez est ce qui sera publié », mais :
- il rend l'image via `media.previewUrl`, qui en mock pointe une **vignette AVIF `sm`** (~1,7 ko, `originalUrl=null`) — l'aperçu de publication n'est **pas** la pleine résolution (BUG-053) ;
- pour un asset vidéo vide (`url=''` que compose/generate-video peuvent renvoyer), `VideoPlayer` reçoit `src=''` et rend un **cadre noir sans erreur** (MISS-021) ;
- un stub `composed-*.jpg`/`export-*.jpg` de 10 octets (977 présents en prod, MISS-004) serait rendu comme **image cassée** servie comme succès.

Ce sont des **faux succès visuels** : la présentation certifie un état que l'asset ne porte pas, ce qui viole P1 (vérité) et P5 (fallbacks visibles). De plus, les livrables riches de A (vidéo composée, voix-off, sous-titres) n'ont **aucune surface** (BUG-004) — le design n'a pas de cible pour la réparation backend.

## Décision

1. **L'aperçu rend la plus grande dérivée disponible.** `PlatformPreview.renderMedia` et `MediaStudio` (`:127`) choisissent `original`/`lg`/`md` quand elle existe, et ne se rabattent sur `sm` qu'à défaut, **jamais** comme aperçu de publication. Le backend expose la dérivée (coordination ui-ux ACT-UX-008 / BUG-053).
2. **État d'erreur visuel dédié, obligatoire.** Quand `previewUrl` est vide, l'asset est introuvable, ou fait < 1 ko, la présentation rend un **placeholder explicite « média indisponible »** — jamais un cadre noir, une image cassée ou `<video src=''>`. Couvre MISS-021 et le risque MISS-004.
3. **Slots conditionnels pour les livrables de A.** `MediaStudio`/`PreviewPane` prévoient des emplacements (vidéo composée, lecteur voix-off/musique, aperçu sous-titres multi-cue) **rendus uniquement si** `GenerationResult` (T-104) fournit l'asset. Pas de slot vide promettant une capacité inatteignable (anti-tromperie, cohérent avec ADR-0007 §convergence).

## Conséquences

- L'aperçu devient **fidèle** ; testable en mock (URL ≠ `…/avif/sm.avif`) et en live (comparaison pixel-à-pixel aperçu↔Postiz/IG une fois le LIVE débloqué).
- Plus aucun asset vide/cassé rendu comme succès : la dégradation est **visible** (P5).
- La réparation backend BUG-004/T-104 a une **cible visuelle** prête ; la convergence A→B matérialise des drafts dont les livrables avancés sont approuvables.
- Coût modéré ; dépend de l'exposition de la dérivée par le backend (sous-DoD live découplé si credential média externe manquant, ADR-0006).

## Alternatives écartées

- **Garder `sm` pour la performance** : une vignette n'est pas un aperçu de publication ; on peut charger `sm` puis échanger pour `original` (progressif) sans mentir sur le rendu final.
- **Masquer les slots A définitivement** : contredit la cible de convergence (l'opérateur doit accéder à voix-off/montage). On conditionne, on ne supprime pas.
