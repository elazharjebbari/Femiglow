# 08 — Design system

Cette section codifie les tokens de design (couleurs, typographie, espacements, mouvement) pour le module Tracking. Elle s'aligne sur le design system FemiGlow existant (palette sauge/crème/encre) et étend avec des tokens sémantiques propres au tracking (status OK/warning/critical, états plan, etc.).

## Fichiers

| Fichier | Sujet |
|---|---|
| [color-system.md](color-system.md) | Palette, tokens sémantiques, contrastes WCAG, dark mode |
| [typography.md](typography.md) | Familles, échelle, hiérarchie, monospace pour JSON |
| [spacing.md](spacing.md) | Échelle 4pt, paddings standards, gaps, breakpoints |
| [motion.md](motion.md) | Durées, easing, transitions, animations |

## Principes

1. **Hériter avant d'inventer** : tout token tracking étend la palette de marque, pas de fork.
2. **Sémantique avant valeur** : les composants consomment `status.ok` plutôt que `bg-green-600`.
3. **Tous les états sont nommés** : pas de couleur "freestyle" dans le code, tout passe par les tokens.
4. **Contraste WCAG AA minimum** sur 100% des textes informationnels, AAA visé sur les labels critiques.
5. **Mouvement subtil** : durées 150–250ms, easing standard, pas d'animations gratuites.
