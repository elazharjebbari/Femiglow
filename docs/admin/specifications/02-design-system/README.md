# 02 — Design system

> Fondations visuelles et rédactionnelles de l'admin. Réutilise la palette
> earthen et la typographie déjà en place côté marketing/commerce, avec
> des extensions sémantiques propres à un environnement opérationnel
> (statuts, alertes, métriques).

---

## Contenu

| Fichier | Rôle |
|---|---|
| [`tokens.json`](./tokens.json) | Tokens design (couleurs, espacements, typo, radius, ombres) |
| [`palette.csv`](./palette.csv) | Palette tabulée avec usages sémantiques |
| [`typographie.md`](./typographie.md) | Hiérarchie typographique admin |
| [`spacing-grid.md`](./spacing-grid.md) | Système d'espacement, grille, breakpoints |
| [`composants-admin.md`](./composants-admin.md) | Inventaire composants admin (réutilisés + nouveaux) |
| [`etats-interactifs.md`](./etats-interactifs.md) | Hover, focus, active, disabled, loading |
| [`iconographie.md`](./iconographie.md) | SVG inline, conventions, jeu d'icônes |
| [`voix-redactionnelle.md`](./voix-redactionnelle.md) | Ton, libellés, microcopy admin |

---

## Principes directeurs

1. **Cohérence brand** : même palette, même typographie, mêmes courbes
   d'easing. L'admin doit "appartenir" au même monde que le site public.
2. **Sobriété** : densité d'information adaptée à un usage opérationnel,
   sans rupture visuelle. Pas d'effets gratuits.
3. **Lisibilité** : Inter pour les tableaux/données, Cormorant pour les
   titres. Aucun corps de texte en dessous de 14 px.
4. **A11y first** : focus visible partout, contraste ≥ 4.5:1, états
   indépendants de la couleur (icône + couleur, pas couleur seule).
5. **Réutilisation** : on n'introduit un nouveau composant que si aucun
   composant existant ne couvre le besoin avec ≤ 30 % de variation.
