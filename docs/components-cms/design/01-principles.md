# D1 — Principes UX

## Cadrage

L'admin Components-CMS est un **outil de production éditoriale**, pas
une suite de design. La fondatrice y passe quelques minutes par
semaine, parfois entre deux rendez-vous, parfois depuis un téléphone.
Tout doit pouvoir se faire vite, sans peur d'effet de bord, sans
formation. Les six principes ci-dessous découlent de ce cadre et
gouvernent toutes les décisions D2 → D6.

Ils s'inscrivent dans la lignée des principes système A1 (en
particulier *Admin ergonomique* et *Zero-magie*) et du contrat
versioning A4 (publication explicite, restauration 1-click).

## P1 — Calme par défaut

### Énoncé

L'écran admin **ne crie pas**. Pas de couleurs vives au repos, pas
d'animation décorative, pas de notification push. Les états visibles
au premier coup d'œil sont uniquement ceux qui demandent l'attention
de l'utilisateur (champ en erreur, brouillon non publié, conflit).

### Rationale

La fondatrice écrit des contenus de soin et de bien-être. Un admin
agressif pollue son flow d'écriture. Le ton de la marque (cf. voix
FemiGlow : *« calme, précis, généreux »*) doit s'étendre à l'outil.

### Conséquences

- Palette dominante : `creme` + `creme-warm` + `encre-soft`.
- Aucune ombre marquée hors `shadow-sm`.
- `transition-duration` par défaut : `fast` (200 ms).
- Pas de toast auto-disparaissant pour le succès — un check discret
  inline suffit (cf. P5).

## P2 — Friction minimale, friction juste

### Énoncé

Toute action **réversible** se fait sans confirmation. Toute action
**irréversible ou publique** se confirme. Aucune autre friction.

### Rationale

Les confirmations systématiques entraînent l'aveuglement (l'admin
clique « OK » sans lire). Réserver le dialog aux cas qui le méritent
(publication, suppression, schedule passé) restaure l'attention quand
elle compte.

### Conséquences

| Action | Friction |
|---|---|
| Édition d'un texte | Aucune (auto-save) |
| Restauration d'une version | Aucune (crée un *draft*, pas une publication) |
| Annulation d'un schedule | Aucune |
| Publication | Modal de confirmation avec diff |
| Annulation de tous les changements (`Reset`) | Modal de confirmation |
| Republication d'une ancienne version | Modal de confirmation avec diff |

Cf. A4 transitions et D3 modale de publication.

## P3 — Statut toujours lisible

### Énoncé

Pour chaque champ, l'utilisateur sait **en moins d'une seconde** :
1. quel est l'état du champ (publié / brouillon / programmé / en
   conflit) ;
2. depuis quand cet état dure ;
3. ce qu'il doit faire pour avancer (s'il y a quelque chose à faire).

### Rationale

Le modèle multi-statut (A4) est puissant mais peut désorienter. Sans
indicateur clair, l'admin ne sait jamais si « ce qu'il voit » est en
ligne ou pas. La perte de confiance est immédiate.

### Conséquences

- Badge de statut **toujours visible** à côté du champ (D3 § Status badges).
- Tooltip avec date relative (« publié il y a 3 jours »).
- Bandeau global de page avec compteur « N champs en brouillon, 1 programmé ».
- Couleurs des badges respectent la palette : `sauge-soft`
  (publié), `champagne-soft` (brouillon), `ciel-soft` (programmé),
  `petale-soft` (conflit).

## P4 — Non-destructif par défaut

### Énoncé

Aucune action ne peut **détruire** une valeur sans la conserver
quelque part. Un texte effacé devient un draft (pas une suppression).
Une ancienne version reste restaurable. Une publication archive
l'ancienne, ne l'écrase pas.

### Rationale

Cf. invariant I7 (A2) — soft-delete uniquement. Mais le principe va
plus loin : même côté UI, on évite les *« vous allez tout perdre »*.
On préfère **annuler** une action que la **rendre irréversible**.

### Conséquences

- Bouton « Vider » sur un champ texte → confirme + sauvegarde l'ancien
  contenu en history.
- `Ctrl+Z` est traité dans chaque éditeur (history locale).
- « Restaurer » crée un draft à partir d'un snapshot (A4).
- Une publication ratée (échec serveur) garde le draft local intact.

## P5 — Save optimiste, retour visuel sobre

### Énoncé

L'utilisateur ne **clique jamais** sur « Enregistrer ». Le système
sauvegarde silencieusement, debounced 800 ms (D6 contrainte), et
matérialise le résultat par **un seul** indicateur visuel.

### Rationale

Le bouton Save est une relique. Il oblige à décider quand sauvegarder,
introduit la peur d'oublier, et complexifie la dirty-check. La save
optimiste est instantanée pour le ressenti et le rollback est
trivial sur erreur (on garde le draft local).

### Conséquences

- Indicateur unique `<SaveIndicator>` en haut de page :
  `…enregistrement` (gris), `enregistré` (check `sauge-soft`),
  `non enregistré — réessayer` (`petale-dark`).
- Pas de spinner sur chaque champ (saturerait l'écran).
- Le focus ne saute pas pendant un save.
- Le contrat reste : la **publication** est explicite (P2). Save ≠ publish.

## P6 — Prévisible, jamais magique

### Énoncé

Les comportements de l'admin sont **explicables en une phrase**. Pas
d'auto-complétion devinée, pas de formatage automatique caché, pas de
champs qui apparaissent/disparaissent selon un état caché.

### Rationale

Cf. principe directeur 9 (README) : *« Zero-magie »*. Un admin qui
ne comprend pas ce que fait l'outil le fuit. La transparence est le
prix de la confiance.

### Conséquences

- Pas de Markdown auto-converti (le rich-text affiche les balises ou
  les boutons, pas les deux silencieusement).
- Pas de champs conditionnels invisibles (un champ optionnel reste
  visible vide).
- Les transformations serveur (sanitize HTML, trim, normalisation
  d'URL) sont **affichées** après save (« nous avons retiré
  `<script>` de votre rich-text »).
- L'ordre des champs dans l'UI = l'ordre dans le registre.

## P7 — Une seule façon de faire

### Énoncé

Pour chaque tâche éditoriale, il existe **un seul chemin** dans
l'admin. Pas de menu *Édition rapide* + *Édition avancée*, pas de
*« vue grille »* alternative, pas de raccourcis cachés.

### Rationale

La duplication des chemins multiplie les bugs perçus (« tiens, ça
marche pas comme dans l'autre vue ») et fragmente la couverture de
test. Un chemin unique est plus simple à enseigner, à tester, à faire
évoluer.

### Conséquences

- L'écran d'édition d'un composant est l'**unique** entrée pour ses
  champs. Pas d'édition inline depuis la liste.
- La preview iframe **lit** mais n'**édite** pas.
- Les raccourcis clavier sont des accélérateurs des actions UI, jamais
  des alternatives (D5).

## P8 — Accessibilité comme feature, pas comme dette

### Énoncé

L'accessibilité (D5) n'est pas un sprint de fin. Chaque éditeur
naît accessible : labels, focus visible, navigation clavier
complète, contraste AA. Tout PR ajoutant un éditeur **doit** passer
axe-core à 0 violation.

### Rationale

Outre la conformité WCAG 2.2 AA visée (A1 § Qualité), l'accessibilité
est un proxy de qualité d'interface tout court. Une UI navigable au
clavier est souvent plus rapide pour les utilisateurs experts (la
fondatrice **est** un utilisateur expert de son propre admin).

### Conséquences

- Cf. D5 pour le détail. Aucune dérogation acceptée en revue.

## Anti-principes

Ces tournures sont **explicitement** rejetées :

| ❌ Anti-pattern | Pourquoi |
|---|---|
| ❌ Auto-save + auto-publish | Tue la garantie publication explicite (A4). |
| ❌ Wizard multi-étapes pour éditer un champ | Friction injustifiée (P2). |
| ❌ Drag-and-drop pour réordonner des champs du registre | Le registre est code (A1). |
| ❌ « Mode expert » qui débloque des options | Une seule façon (P7). |
| ❌ Toast de succès avec animation | Bruit visuel (P1). |
| ❌ Spinner full-page sur save | Bloque l'écriture (P5). |
| ❌ Confirmation à chaque save | Friction injustifiée (P2). |
| ❌ Couleur de marque (terracotta saturé) en CTA admin | Casse le ton calme (P1). |

## Croisements

| Principe | Doc connexe |
|---|---|
| P1, P5 | D4 — micro-interactions, palette |
| P2, P3 | D3 — modale publish, badges |
| P3 | A4 — modèle de statuts |
| P4 | A2 § I7 — soft-delete |
| P5 | F3 — form-engine, dirty-tracking |
| P6 | A3 — résolveur transparent |
| P7 | D2 — IA unique |
| P8 | D5 — guide accessibilité |
