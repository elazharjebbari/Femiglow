# 50.7 — Ergonomie du gestionnaire admin

## Personas

### Persona 1 — "Maya", admin principal
- Sait ce qu'elle veut publier
- Travaille vite, parfois entre deux tâches
- Mobile rarement, desktop majoritairement
- Sait écrire en Markdown, n'aime pas les éditeurs WYSIWYG buggués

### Persona 2 — "Yassin", manager support
- Modifie occasionnellement (typo, ajout FAQ)
- Pas développeur, mais informaticien d'usage
- Peut avoir peur de "casser le site"

### Persona 3 — "Le juriste"
- Externe, accès ponctuel
- Reçoit un export PDF/HTML pour revue
- Pas d'accès direct à l'admin (V1)

## Principes ergonomiques

### 1. **Zero surprise**

L'admin doit savoir à tout moment :
- Quel est le statut actuel (draft / review / published)
- Quelle action va suivre s'il clique
- Si une action est destructive (confirmation explicite)

### 2. **Réversibilité**

Toute action **non-publish** est réversible :
- Save draft → modifiable à volonté
- Submit review → l'admin peut retirer
- Archive → restore possible
- **Publish** : action lourde, confirmation à 2 étapes + checklist

### 3. **Auto-save permanent**

Personne n'a perdu de travail. **Garantie absolue.**

- Sauvegarde toutes les 30s (drafts)
- Indicator visible : "💾 il y a 12s"
- Sur erreur : retry exponential + alerte
- `beforeunload` warning si dirty

### 4. **Discoverability**

Toutes les actions principales sont visibles d'emblée :
- Pas de menu hamburger caché
- Pas de raccourcis clavier-only
- Tooltips sur les icônes

### 5. **Efficiency for power users**

Cmd+S, Cmd+Shift+P (publish), Cmd+Shift+R (review) pour ceux qui veulent.

### 6. **Confirmations proportionnées**

| Action | Confirmation |
|---|---|
| Save draft | Aucune (auto) |
| Submit review | Aucune (action mineure) |
| Archive | Modal simple "Confirmer" |
| Publish | Modal + checklist + tape "PUBLIER" |
| Dépublier | Modal + tape "DÉPUBLIER" |
| Restore version | Modal simple |
| Delete account (V2) | Modal + email + délai 24h |

### 7. **Feedback immédiat**

Toutes les actions produisent un feedback :
- Toast success ("Page sauvée")
- Toast warning ("Variables manquantes")
- Toast error ("Erreur réseau, retry")

### 8. **Anticipation**

Le système anticipe les problèmes :
- Variables manquantes : highlight dans l'aperçu
- Liens cassés : warning avant publish
- Date de version : auto-incrémentée
- Slug : auto-généré depuis titre

## Parcours type

### A. Modifier le contenu d'une CGV

```
1. /admin/legal                    ← landing
2. Cliquer "CGV"                   ← navigation
3. Tab "Contenu" (default)         ← contexte
4. Modifier dans MD pane
   → auto-save background
   → aperçu live
5. "Soumettre à revue"             ← demande validation
   OU
   "Publier"                       ← si OK + permission
   → checklist 4 items
   → tape "PUBLIER"
6. Toast success + redirect liste
```

### B. Ajouter une nouvelle page

```
1. /admin/legal
2. "+ Nouvelle page"                ← wizard
3. Step 1 : Type                    ← Custom / Policy / Charter
4. Step 2 : Métadonnées             ← Titre, slug (auto), description
5. Step 3 : Contenu                 ← MD editor (vide ou template)
6. Step 4 : Placement               ← Où afficher
7. Step 5 : SEO + Publish           ← noindex default
8. Création → redirect éditeur
9. Affiner contenu
10. Publier (workflow normal)
```

### C. Mettre à jour une variable (RC, ICE)

```
1. /admin/legal/template-vars       ← variable editor
2. Liste des vars                   ← visible
3. Cliquer pour éditer
4. Save inline
5. Toast "Variable mise à jour"
6. Background : invalidate cache des pages utilisant cette var
7. Banner "5 pages doivent être re-publiées" (admin choisit quand)
```

## Patterns d'interaction

### Sauvegarde / publication

**Bouton principal toujours en bas de page**, sticky :

```
┌────────────────────────────────────────────────────┐
│ [Annuler]   [Aperçu public]   [Soumettre]  [Sauver]│
└────────────────────────────────────────────────────┘
```

Tooltips :
- "Sauver" → "Cmd+S · Garde la version en draft"
- "Soumettre" → "Demande revue avant publication"
- "Publier" → "Action définitive — création version immutable"

### Drag and drop

Limité aux endroits utiles :
- Réordonner placements dans une zone
- Réordonner variables template

Pas de drag pour modifier le contenu MD (édition texte classique).

### Modals / drawers

- **Modal** : action destructive ou critique (publish, archive)
- **Drawer** : exploration secondaire (history, template vars)
- **Inline edit** : champs simples (slug, title)

## Erreurs typiques et leur traitement

### "Variables manquantes au publish"

```
┌─────────────────────────────────────┐
│ ⚠ Variables non remplies            │
│                                     │
│ La page contient :                  │
│ - {{COMPANY_RC}} (obligatoire)     │
│ - {{ICE}} (obligatoire)            │
│                                     │
│ [Aller au formulaire variables]    │
│ [Continuer quand même (déconseillé)]│
└─────────────────────────────────────┘
```

Le "Continuer quand même" est en lien discret, pas en bouton primary.

### "Liens cassés détectés"

```
┌─────────────────────────────────────┐
│ ⚠ 2 liens semblent cassés           │
│                                     │
│ - https://example.com/x → 404      │
│ - /legal/old-page → page archivée  │
│                                     │
│ [Corriger]  [Publier quand même]   │
└─────────────────────────────────────┘
```

### "Conflit de version (autre éditeur)"

```
┌─────────────────────────────────────┐
│ ⚠ Conflit                            │
│                                     │
│ Yassin a modifié cette page         │
│ depuis votre dernière sauvegarde.   │
│                                     │
│ [Voir les changements]              │
│ [Recharger (perdre mon édition)]    │
│ [Garder ma version (écraser)]       │
└─────────────────────────────────────┘
```

## Mobile admin

Édition complète disponible mais moins confortable. Recommander desktop.

Si tap "Modifier" sur mobile :

```
┌──────────────────────────┐
│ Édition mobile possible  │
│ mais déconseillée pour   │
│ les longues pages.       │
│                          │
│ [Ouvrir quand même]      │
│ [Recevoir lien email]    │
└──────────────────────────┘
```

## Tests d'ergonomie (à mener)

| Test | Méthode |
|---|---|
| Temps moyen pour créer une page | Time-on-task chez 3 utilisateurs |
| Erreurs de saisie variables | Observé en session de test |
| Pages publiées avec variable manquante | Métrique production |
| Pages publiées puis dépubliées dans la même journée | Métrique production (signal erreur) |
| Satisfaction admin (NPS interne) | Form interne post-trimestre |
