# 07 — UX

Personas, user journeys, flux d'interaction.

## Contenu

| Fichier | Contenu |
|---|---|
| [personas.md](./personas.md) | Profils utilisateurs cibles |
| [user-journeys.md](./user-journeys.md) | Parcours typiques de bout en bout |
| [wizard-flow.puml](./wizard-flow.puml) | Diagramme état du wizard |
| [interactions.md](./interactions.md) | Micro-interactions et feedback |
| [empty-states.md](./empty-states.md) | Catalog empty states |

## Principe

**Le wizard est l'expérience par défaut.** Le mode expert est un escape hatch pour les 10% de cas avancés. Tout admin novice doit pouvoir publier un plan complet en < 5 minutes.

## Erreurs à éviter (anti-patterns observés ailleurs)

- ❌ Une UI qui présente 50 champs sans hiérarchie (l'utilisateur ne sait pas par où commencer).
- ❌ Validation finale uniquement (l'utilisateur apprend les règles trop tard).
- ❌ Un download sans visibilité sur ce qu'on télécharge (= notre situation actuelle).
- ❌ Boutons d'action destructifs sans confirmation explicite.
- ❌ Modales en cascade (modale dans modale dans modale).
