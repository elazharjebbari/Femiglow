# Fonctionnalité : Wizard de création AI Engine

## Description fonctionnelle

Le wizard de création permet à l'opérateur de générer du contenu multimédia (texte, image, vidéo) en remplissant un brief créatif. Le système exécute un pipeline LangGraph de 16 nœuds et retourne un script structuré, une caption, des hashtags, des visuels et un score de qualité.

## URL : `/admin/content-studio-v2/ai-engine/create`

## Parcours utilisateur

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│ Phase Brief  │ →  │ Phase        │ →  │ Phase Review │ →  │ Phase    │
│ (Formulaire) │    │ Generating   │    │ (HITL)       │    │ Result   │
│              │    │ (Pipeline)   │    │              │    │          │
└──────┬──────┘    └──────┬───────┘    └──────┬───────┘    └──────────┘
       │                  │                   │
       ▼                  ▼                   ▼
  Validation         SSE Progress        Approve/Reject      ┌──────────┐
  → Générer          → Temps réel        → Feedback          │ Phase    │
                                                              │ Error    │
                                                              │ (Retry)  │
                                                              └──────────┘
```

## Éléments UI à tester

### Phase Brief (formulaire)

| Élément | Type | Required | Valeurs | Validation |
|---|---|---|---|---|
| Objectif | `<select>` | Oui | awareness, engagement, conversion, education, loyalty, ugc | Non vide |
| Plateforme | `<select>` | Oui | instagram, tiktok, facebook, youtube, linkedin, pinterest | Non vide |
| Format | `<select>` | Oui | reel, carousel, story, single_image, text_post, infographic | Non vide |
| Ton | `<select>` | Oui | empowering, educational, playful, luxurious, authentic, urgent | Non vide |
| Message clé | `<textarea>` | Oui | Texte libre, 4 lignes | `.trim().length > 0` |
| Focus produit | `<input>` | Non | Texte libre | Optionnel |
| Référence tendance | `<input>` | Non | Texte libre | Optionnel |
| Bouton Générer | `<button>` | — | — | Désactivé si formulaire incomplet |

### Phase Generating (pipeline progress)

| Élément | Comportement attendu |
|---|---|
| Liste d'étapes | 6 étapes (image) ou 11 étapes (vidéo) |
| Icône pending | Cercle gris pour étapes non démarrées |
| Icône running | Spinner animé pour l'étape en cours |
| Icône done | Checkmark vert pour étapes terminées |
| Icône error | X rouge pour étapes en erreur |
| Durée par étape | Affichée en "X.Xs" ou "XXms" |
| Temps écoulé | Compteur en temps réel |
| Ligne de connexion | Verte quand done, grise sinon |

### Phase Review (HITL)

| Élément | Comportement |
|---|---|
| Preview script | Hook + scènes + CTA |
| Preview caption | Texte complet |
| Preview hashtags | Tags avec # |
| Preview images | Grille miniatures |
| Quality scores | Barres par dimension |
| Bouton Approuver | → Phase Result |
| Bouton Rejeter | → Régénération avec feedback |
| Bouton Modifier | → Régénération avec feedback |
| Textarea feedback | Apparaît pour Rejeter/Modifier |

### Phase Result

| Élément | Comportement |
|---|---|
| Script (collapsible) | Hook, scènes, CTA, visual direction |
| Caption | Texte avec bouton copier |
| Hashtags | Tags badges |
| Images | Grille avec aperçu |
| Quality scores | Barres de progression par dimension |
| Coût | Ventilation par nœud en centimes |
| Lien Bibliothèque | Navigation vers Content Studio |
| Bouton Régénérer | Retour à Phase Brief |
| Section Publier | Mode now/schedule, datetime, bouton publier |

### Phase Error

| Élément | Comportement |
|---|---|
| Message d'erreur | Texte explicatif |
| Étape en erreur | Indiquée dans le pipeline |
| Bouton Réessayer | Relance la génération |
| Bouton Nouveau brief | Retour au formulaire |

## Scénarios de test

### Validation formulaire
1. Tous les champs vides → bouton désactivé
2. Seulement objectif rempli → bouton désactivé
3. Tous les champs requis remplis → bouton activé
4. Message clé = espaces seulement → bouton désactivé
5. Caractères spéciaux dans message clé → accepté

### Flow de génération
6. Clic Générer → pipeline s'affiche
7. Étapes défilent de pending à running à done
8. Résultat apparaît avec script non vide
9. Caption contient du texte en français
10. Hashtags sont un tableau non vide
11. Quality score average ≥ 0.65
12. Coût est affiché

### Gestion d'erreur
13. API retourne 500 → phase error
14. API timeout → phase error avec message timeout
15. API retourne validation error → affiche détails
16. Clic retry → relance la génération
17. Clic nouveau brief → retour formulaire vide

### Mapping des valeurs
18. Format "single_image" → envoyé comme "post"
19. Format "text_post" → envoyé comme "post"
20. Tone "empowering" → envoyé comme "inspiring"
21. Objective "loyalty" → envoyé comme "engagement"
22. Format "reel" → étapes vidéo affichées (11 étapes)
23. Format "carousel" → étapes image affichées (6 étapes)
