# 50.4 — Interactions et microinteractions

## Patterns globaux

- **Confirm modal** systématique pour : activate, archive, delete, reset-default, export GTM
- **Toast feedback** < 200ms après chaque action user (succès ou erreur)
- **Optimistic UI** pour les changements rapides (toggle, édit cellule local)
- **beforeunload** confirm si modifs non sauvegardées

## Microinteractions

### Édition d'une cellule
1. Hover sur cellule → border légèrement plus marquée + tooltip avec valeur actuelle
2. Click → popover éditeur ouvre en place
3. Input focus auto sur `mappedName`
4. Saisie → validation Zod live, error inline rouge < 50ms
5. Enter ou click "Appliquer" → cellule mise à jour, popover ferme, animation flash vert 300ms
6. Esc → ferme sans save, focus retourne sur la cellule
7. Footer page → counter "{n} modifs en attente" mis à jour

### Sauvegarde des modifs
1. Click "Sauvegarder" → modal confirm avec récap des changements
2. Confirm → bouton loading state spinner
3. Réponse 201 → toast success "Nouvelle version v4 draft créée. Active-la pour la mettre en production."
4. Auto-redirect vers `/v4` (la nouvelle version draft)
5. Bandeau "Version draft non active" en haut de la page

### Activation d'une version
1. Click "Activer" sur une row → confirm modal
2. Modal affiche le nom de l'active courante qui sera archivée
3. Confirm → loading state du bouton + désactive tous les autres "Activer"
4. Réponse 200 → toast success "Version activée"
5. List re-fetch + badges mis à jour (animation crossfade 200ms)
6. Cache resolver serveur invalidé immédiatement (TTL=0 forced)

### Diff entre 2 versions
1. Cocher 2 checkboxes "Comparer" dans la liste
2. Bouton "Comparer 2 versions →" devient enabled
3. Click → navigate vers `/compare/[a]/[b]`
4. Page charge avec spinner "Calcul du diff..."
5. Render side-by-side avec animations fade-in 150ms par ligne
6. Filtre "Modifications uniquement" → animation collapse des ✓

### Reset au default
1. Bouton "Reset au default" visible seulement si `activeId !== defaultId`
2. Click → modal détaillée avec preview des changements (top 5 diff)
3. Confirm explicite "↩ Revenir au default factory"
4. Loading state
5. Toast "Mapping par défaut restauré"
6. List re-fetch, l'ancienne active passe à `archived`, `__default__` devient active

### Export GTM
1. Click "Exporter GTM" → modal sélection env
2. Aperçu calculé en temps réel (count events/tags/variables)
3. Confirm → loading "Génération..."
4. Réponse 200 → Blob généré + download auto
5. Toast "Export OK — 32 events, 156 tags générés"
6. Info action suivante : "Importe maintenant via GTM Web > Admin > Importer un container"

### Test mapping (dry-run)
1. Click "Tester" sur une row
2. Modal s'ouvre, dropdown event sélectionnable
3. Choix d'event → "Lancer le test"
4. Loading 100-200ms
5. Résultats listés par provider avec icône ✅/🚫 + nom mapped
6. Bouton "Tester un autre event" → reset
7. Bouton "Fermer" → ferme la modal

## Animations

### Transitions de status (badges)
- `active → archived` : fade out + slide right 200ms
- `draft → active` : pulse vert 400ms

### Apparition / disparition
- Modals : backdrop fade-in 150ms + scale-up 200ms (ease-out)
- Toasts : slide-in depuis haut-droit + fade-in 200ms ; auto-dismiss avec slide-out 200ms
- Popover cellule : scale-up 100ms (ease-out)

### Loading states
- Buttons : spinner remplace l'icône + texte change ("Sauvegarde..." etc.)
- Skeleton placeholders pour la liste pendant fetch initial
- Empty state si 0 versions

### Erreurs
- Input invalide : border rouge + shake 100ms (subtle)
- Toast error : slide-in plus marqué (assertive)

## États d'attente prolongée

Si une action dépasse 1500ms :
- Bouton reste en loading
- Si > 3000ms : message inline "Cela prend plus de temps que prévu..."
- Si > 10s : timeout client → toast erreur "Le serveur ne répond pas. Réessaie."

## Skeleton & empty states

### Empty state (0 versions)
```
┌──────────────────────────────────┐
│  📋                              │
│  Aucune version de mapping       │
│                                  │
│  Crée ta première version pour  │
│  commencer à éditer les mappings│
│  vendors.                        │
│                                  │
│  [+ Créer la première version]  │
└──────────────────────────────────┘
```

### Skeleton (loading)
- 3 cards skeleton avec lignes grises pulsantes
- Skeleton matrice : 5 rows × 6 cols cellules grises

### Error state (fetch failed)
```
┌──────────────────────────────────┐
│  ⚠ Impossible de charger        │
│                                  │
│  Erreur réseau. Vérifie ta      │
│  connexion ou réessaie.         │
│                                  │
│  [Réessayer]                    │
└──────────────────────────────────┘
```
