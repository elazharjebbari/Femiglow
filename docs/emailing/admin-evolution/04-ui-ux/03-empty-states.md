# Empty states catalogue

> Tout écran qui peut être vide a un empty state pédagogique.
> Composant : `<EmptyState>` (voir [03-frontend/02-components-catalog.md](../03-frontend/02-components-catalog.md)).

## Pattern visuel

```
┌────────────────────────────────────────────────────┐
│                                                    │
│                  [Icon 48px]                       │
│                                                    │
│              Titre (text-lg semibold)              │
│                                                    │
│         Description (text-sm muted)                │
│         (1 phrase, max 2 lignes)                   │
│                                                    │
│                [CTA Button]  (si applicable)       │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Catalogue par écran

### Transactional cockpit
| Cas | Titre | Description | CTA |
|---|---|---|---|
| DB vide | "Aucun email envoyé" | "Quand un email partira (formulaire contact, commande, automation…), il apparaîtra ici." | "Rafraîchir" |
| Filtres sans résultat | "Aucun email ne correspond" | "Filtres actuels : `{filters}`. Essaie d'élargir." | "Effacer les filtres" |
| Saved view vide | "Cette vue est actuellement vide" | "Aucun email ne correspond aux critères de la view '{name}'." | "Modifier la view" |

### Audiences
| Cas | Titre | Description | CTA |
|---|---|---|---|
| Aucune audience | "Aucune audience définie" | "Crée ta première audience pour cibler des contacts." | "+ Nouvelle audience" |
| Audience matche 0 | "0 contact correspond aux critères" | "Les règles définies n'ont aucun match dans la base. Essaie de relâcher les critères." | "Modifier les critères" |
| Aucun snapshot | "Pas encore de snapshot" | "Crée un snapshot pour figer la liste ou utilise-la directement en campagne dynamique." | "+ Snapshot maintenant" |

### Campagnes
| Cas | Titre | Description | CTA |
|---|---|---|---|
| Aucune campagne | "Aucune campagne créée" | "Crée ta première campagne pour envoyer un email à une audience." | "+ Nouvelle campagne" |
| Stats vides | "Pas encore de stats" | "Les métriques apparaîtront après l'envoi de la campagne." | – |

### Automation
| Cas | Titre | Description | CTA |
|---|---|---|---|
| Aucune automation | "Pas d'automation configurée" | "Configure des workflows automatiques basés sur des événements utilisateur." | "+ Nouvelle automation" |
| Aucune run | "Pas encore de runs" | "Les runs s'afficheront ici quand l'automation se déclenchera." | – |

## Icons proposés (Lucide)

| Empty state | Icon |
|---|---|
| Email vide | `Inbox` |
| Filter vide | `Search` |
| Audience vide | `Users` |
| Snapshot vide | `Camera` |
| Automation vide | `Zap` |
| Stats vide | `BarChart3` |

## Variations

### Empty state critique (erreur)
```
┌────────────────────────────────────────────────────┐
│                      ⚠                             │
│                                                    │
│        Impossible de charger les données           │
│                                                    │
│   Erreur : `{message}`                             │
│                                                    │
│       [Réessayer]    [Contacter support]           │
└────────────────────────────────────────────────────┘
```

### Empty state premier usage
Plus généreux, avec quelques lignes d'onboarding. Affiché seulement
la 1ère fois (flag `first_visit` en sessionStorage ou DB).
