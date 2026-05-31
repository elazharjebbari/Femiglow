# 50.9 — Interaction patterns

## Pattern 1 : Édition avec preview live

**Quand** : éditeur MD admin.
**Comportement** : split-pane, scroll sync, debounce 200ms, indicators.

```
┌────────────────┬────────────────┐
│ MD source       │ Aperçu          │
│ (édit. côté)   │ (rendu live)    │
├────────────────┴────────────────┤
│ B I H 🔗 ≡       💾 il y a 12s   │
└─────────────────────────────────┘
```

Sur mobile : tabs au lieu de split.

## Pattern 2 : Confirm destructive avec friction

**Quand** : publish, archive, dépublier.

```
1. Click "Publier"
2. Modal s'ouvre
3. Checklist 4 items (toutes cochables)
4. Input : tape "PUBLIER"
5. Bouton "Publier" activé seulement si :
   - 4 cases cochées
   - texte === "PUBLIER" (case sensitive)
6. Click → action + toast success
```

⚠ Pas de raccourci clavier pour valider cette modal (anti-erreur).

## Pattern 3 : Toast non-bloquant

**Quand** : feedback action (save, error, info).

```
[ ✓ Page sauvegardée ]    en haut-droite, 3s, auto-dismiss
```

Variantes :
- ✓ green : success
- ⚠ amber : warning
- ✗ red : error
- ℹ blue : info

Actions secondaires possibles : "Annuler" pour les save (undo 5s).

## Pattern 4 : Inline edit

**Quand** : variables, slug, title.

```
Slug : conditions-generales-vente  [✏]
       ──────────────────────────
       (click → champ devient input)

Slug : [conditions-generales-vente]  [Enregistrer] [Annuler]
```

Esc pour annuler, Enter pour enregistrer.

## Pattern 5 : Optimistic update

**Quand** : toggle placement actif/inactif.

```
1. Click checkbox
2. UI passe immédiatement à coché
3. API call en background
4. Si succès : rien (déjà à jour)
5. Si erreur : rollback + toast "Erreur, retry"
```

## Pattern 6 : Drawer pour exploration secondaire

**Quand** : history, template vars, links inspector.

```
┌──────────────┬─────────────┐
│              │ Drawer       │
│   Main       │ ←  Right  →  │
│              │              │
│              │              │
└──────────────┴─────────────┘
```

- Click hors drawer → close
- Esc → close
- Pas de scroll lock sur le main

## Pattern 7 : Empty state engageant

**Quand** : zone sans placement, page sans version, etc.

```
┌──────────────────────────────┐
│         🪶                   │
│                              │
│   Aucune page dans cette     │
│   zone.                      │
│                              │
│   [+ Ajouter une page]       │
└──────────────────────────────┘
```

## Pattern 8 : Skeleton loaders

**Quand** : chargement initial > 200ms.

```
┌────────────────────┐
│ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭     │
│ ▭▭▭▭▭▭▭▭           │
│ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭   │
└────────────────────┘
```

Animation `pulse` 1.5s. Hauteur correspond au layout final (anti-CLS).

## Pattern 9 : Progressive disclosure

**Quand** : SEO advanced settings, danger zone.

```
SEO settings
✓ Indexer ?    [Non, exclure du SEO]
                                       
+ Réglages avancés (canonical, …)      ← collapsé par défaut
```

## Pattern 10 : Search-as-you-type

**Quand** : recherche dans la liste.

```
🔍 [_______________]
   ↓ debounce 200ms
   ↓ filter via fuse.js (titre + slug)
   ↓ highlight matches
```

## Pattern 11 : Sticky action bar

**Quand** : éditeur (toujours), tableau (sélection bulk).

```
┌─────────────────────────────────┐
│ Contenu de la page              │
│ …                               │
│ …                               │
├─────────────────────────────────┤  ← sticky bottom
│ [Annuler]  [Sauver]  [Publier] │
└─────────────────────────────────┘
```

## Pattern 12 : Banner global (alert/info)

**Quand** : variable manquante critique, link health alert.

```
╔════════════════════════════════════════╗
║ ⚠ 2 pages ont des liens cassés         ║
║ [Voir détails] [Masquer]               ║
╚════════════════════════════════════════╝
```

Persistant jusqu'à action ou dismiss.

## Pattern 13 : Diff inline

**Quand** : restore d'une ancienne version, conflict d'édition.

```
Avant (v3)                Maintenant (v5)
──────────                ───────────────
Bonjour,                  Bonjour,
                          
Nous offrons 7 jours      Nous offrons {{COOLING_OFF_DAYS}} jours
de rétractation.          de rétractation.
                          
Pour tout retour…         Pour tout retour…
- send email              - email à hello@femiglow.ma
- include order #         - inclure n° commande
```

Highlight :
- vert : ajouts
- rouge : suppressions
- gris : inchangé

Format inspiré de `react-diff-viewer`.

## Pattern 14 : Soft 404

**Quand** : page archivée, slug non trouvé.

```
┌─────────────────────────────────┐
│         404                     │
│ Cette page n'existe plus ou a  │
│ été archivée.                  │
│                                 │
│ Voici nos pages utiles :        │
│ → Politique de retours          │
│ → Politique cookies             │
│ → Mentions légales              │
│                                 │
│ [Retour à l'accueil]            │
└─────────────────────────────────┘
```

## Pattern 15 : Confirmation par tape

**Quand** : Actions très critiques (delete account, hard delete).

```
Pour confirmer, tapez :
SUPPRIMER MA PAGE LEGALE

[__________________________]
                            
[Annuler]  [Confirmer]
```

Le bouton "Confirmer" reste désactivé tant que le texte n'est pas identique.
