# Ergonomie admin — Nielsen + métriques d'efficience

> L'admin chat-v2 est un outil de productivité, pas une vitrine. Sa qualité se mesure en **clics épargnés**, **erreurs évitées**, **temps de tâche**. Référentiel : 10 heuristiques de Nielsen + Norman Group sur les dashboards.

## Les 10 heuristiques de Nielsen — Application au manager

### 1. Visibilité du statut système

| Pratique | Implémentation |
|---|---|
| Toast après save | bottom-right, 3s auto-hide, vert si OK |
| Spinner sur actions > 200 ms | `Loader2` Lucide inline, jamais "loading..." en texte seul |
| Service level visible en permanence | header sticky `serviceLevel pill` colorée |
| Filtres actifs montrés en tags | clickables pour retirer |
| Save state | "Sauvegardé · il y a 3s" sous l'éditeur |

### 2. Correspondance avec le monde réel

- Pas de jargon technique sans glossaire (ex. "intent" → tooltip "type de question détectée").
- Métriques en MAD et USD selon contexte (jamais centimes/cents pour UX human).
- Dates relatives ≤ 24h ("il y a 3 min"), absolues au-delà ("13/05 14:23").

### 3. Contrôle utilisateur & liberté

- `Cmd+Z` undo sur les éditions (au moins le dernier état).
- "Annuler" sur toute action destructive (5 s pour récupérer après delete).
- Multi-tab admin sans conflit (lock optimiste avec révision).
- Pas de modal qui peut être fermée uniquement par un bouton (Esc + click outside).

### 4. Cohérence & standards

- Toutes les actions destructives sont **rouge** (`error.500`) + icône `Trash2`.
- Toutes les actions create sont **violet** primary + icône `Plus`.
- Tableaux : tri = chevron, filtres = en haut, pagination = en bas.
- Drawer = panneau right, full-modal = action lourde uniquement (wizard nouveau intent).

### 5. Prévention des erreurs

- Confirmation **uniquement** pour les vraies destructions :
  - Delete intent ✅ avec confirm + tape nom
  - Delete FAQ ✅ avec confirm simple
  - Save draft ❌ pas de confirm (sauvegarde rapide)
- Validation Zod en temps réel sur les champs.
- Bouton "Publier" disabled tant que les 3 langues ne sont pas remplies.
- Warning "Pages associées : 12" avant de désactiver une suggestion.

### 6. Reconnaissance plutôt que rappel

- Sidebar permanente avec icônes + labels.
- Breadcrumbs sur chaque écran ("Suggestions > Édition kit-price").
- Récents en haut (5 dernières suggestions éditées).
- Search global `Cmd+K` accessible partout (filtres + jump-to).

### 7. Flexibilité & efficacité d'usage

- Raccourcis clavier documentés (`?` ouvre cheat-sheet).
- `j/k` pour naviguer dans les tableaux.
- `Cmd+Enter` pour publier directement.
- `e` pour éditer la ligne survolée.
- Templates pour création rapide (canned, FAQ).
- Bulk actions (sélection rangées → "Archiver 12 sélectionnées").

### 8. Esthétique & design minimaliste

- Pas de chartjunk : graphes sobres, 2-3 couleurs max.
- Pas plus de 3 niveaux d'information par écran.
- White space respiratoire (16-24 px entre sections).
- Hierarchy typographique stricte (3 tailles : title, body, caption).

### 9. Aide à reconnaître et récupérer les erreurs

- Messages d'erreur **spécifiques** :
  - ❌ "Erreur lors de la sauvegarde"
  - ✅ "Le champ 'label FR' ne peut pas dépasser 30 caractères. Vous avez 34."
- Lien direct vers la cause ("Voir le champ qui pose problème").
- Pas d'erreur muette : tout erreur API doit déclencher un toast + log.

### 10. Documentation contextuelle

- `?` icon à côté de chaque concept abscons → tooltip ou link doc.
- Empty state explicite avec CTA ("Aucune entrée FAQ ici. [+ Créer la première]").
- Onboarding tour pour première visite (skippable, mais réactivable via menu).
- Lien permanent `/dashboard/chat-v2/help` (docs interne).

## Métriques d'efficience

### Time-to-task (TTT)

| Tâche | Persona | Cible | Mesure |
|---|---|---|---|
| Trouver conversation par intent | Yasmine | < 15 s | Session replay |
| Éditer label canned trilingue | Yasmine | < 60 s | Session replay |
| Publier nouvelle suggestion (wizard) | Yasmine | < 3 min | Session replay |
| Trier 10 leads par recency | Karim | < 30 s | Session replay |
| Marquer 5 leads "contacté" | Karim | < 45 s | Bulk action |
| Recompute centroïdes intents | Karim | < 5 s (click), 90 s (job) | Background |
| Sandbox test tool | Karim | < 60 s | Session replay |
| Diagnose conversation → root cause | Karim | < 90 s | Session replay |
| Reset service level (escalation) | PO | < 30 s | Confirmation panel |

### Error rate (ER)

| Erreur | Cible | Mesure |
|---|---|---|
| Click sur action mauvaise (rage click) | < 1.5% | Hotjar / Clarity |
| Save échec validation | < 5% | Toast count |
| Navigation circulaire (back ↔ forward) | < 3% | Session replay |
| Search no result | < 10% | Event |

### Adoption (AD)

- DAU/MAU admin (daily/monthly active users).
- Features used per session.
- Funnel "open dashboard → édit ≥ 1 entry → save".

## Comportements d'expert

L'admin doit récompenser la maîtrise :

| Geste expert | Récompense |
|---|---|
| `Cmd+K` search | Jump direct (vs 3-4 clicks dans nav) |
| Filtres URL `?intent=pricing` | Partage de vue collègue |
| `j/k` table navigation | Vitesse mouseless |
| Bulk select shift+click | Action 10× plus rapide |
| Save as template | Réutilisable en wizard |

Les power users (Yasmine, Karim) doivent pouvoir atteindre **20-30 % gain de vitesse** par rapport aux nouveaux utilisateurs.

## Onboarding admin

Première visite `/dashboard/chat-v2` :

```
┌────────────────────────────────────────┐
│  👋 Bienvenue dans le chat manager !   │
│                                        │
│  Faisons un tour rapide (≤ 90 s) :    │
│                                        │
│  Étape 1/5 — Sidebar de navigation     │
│  [Suivant →]   [Passer]                │
└────────────────────────────────────────┘
```

5 étapes : sidebar, conversations, suggestions, leads, settings.
Skippable.
Réactivable via menu "Aide > Refaire le tour".

## Empty states catalogue

| Page vide | Texte | CTA principal |
|---|---|---|
| Conversations (aucune) | "Pas encore de conversations. Le chat va se peupler dès qu'un visiteur l'ouvrira." | Lien "Voir le chat live" |
| Leads (aucun) | "Aucun lead pour le moment. Quand un visiteur soumettra le form, il apparaitra ici." | — |
| FAQ (vide) | "Aucune entrée FAQ. Créez votre première question." | "+ Créer FAQ" |
| Conversations filtrées (no match) | "Aucune conversation ne correspond à votre filtre." | "Réinitialiser filtres" |
| Search (no result) | "Aucun résultat pour « {term} ». Essayez avec moins de mots." | — |

## Loading states catalogue

| Loading | UI |
|---|---|
| Table en cours de fetch | Skeleton 5 rows (gray bars animés) |
| Bouton submit | Spinner inline + disable, texte préservé |
| Chart loading | Placeholder shape + "Chargement…" |
| Drawer ouvert vide | Spinner centré 32px + "Chargement…" |
| Aperçu live preview | Skeleton bulle assistant |

## Confirmations destructives

```
┌────────────────────────────────────────┐
│  Supprimer définitivement "pricing" ?  │
│                                        │
│  ⚠ Cette action supprime aussi :       │
│     - 42 exemples d'intent             │
│     - 12 FAQ entries liées             │
│                                        │
│  Tapez « pricing » pour confirmer :    │
│  < ___________________________ >      │
│                                        │
│  [ Annuler ]      [ Supprimer ]       │
└────────────────────────────────────────┘
```

## Anti-patterns admin à éviter

- ❌ Modal pour action triviale (edit titre row).
- ❌ Confirmation pour action non-destructive (save = jamais de confirm).
- ❌ Multiple sources de vérité (UI dit X, DB dit Y).
- ❌ Pas de feedback après action (silence anxiogène).
- ❌ Loading sans skeleton (blank screen).
- ❌ Erreur globale en bandeau qui ne dit pas où (toast lié à un champ → ancré au champ).
- ❌ Cmd+S ignoré (devrait save brouillon).
- ❌ Refresh page = perte form non-sauvegardé (autosave brouillon).

## Process d'audit ergonomie

Trimestriel :
1. **Heuristic eval** par 2 designers/devs (10 critères Nielsen).
2. **Tests utilisateurs internes** : 3 collègues effectuent des tâches chronométrées.
3. **Analyse Hotjar/Clarity** : rage clicks, dead clicks, hesitation zones.
4. **Backlog d'amélioration** dans Linear `CHAT-ADMIN-UX`.
