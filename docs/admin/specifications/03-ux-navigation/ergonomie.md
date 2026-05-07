# Ergonomie

## Raccourcis clavier

> Compatibles macOS et Windows. Définis dans un hook
> `useAdminShortcuts()` global.

### Globaux (dans n'importe quelle page admin)

| Raccourci | Action |
|---|---|
| `g d` | Aller au tableau de bord |
| `g l` | Aller à Leads |
| `g w` | Aller à Webhooks |
| `/` | Focus la barre de recherche (si présente) |
| `?` | Ouvre une modale d'aide listant les raccourcis |
| `Esc` | Ferme dropdowns, modales, panneaux ; retour à la liste |
| `⌘ K` ou `Ctrl K` | (v2) ouvre une command palette |

### Page liste de leads

| Raccourci | Action |
|---|---|
| `j` / `k` | Lead suivant / précédent (focus la ligne) |
| `Enter` | Ouvre le lead focalisé |
| `f` | Ouvre les filtres |
| `e` | Exporte en CSV |

### Page détail lead

| Raccourci | Action |
|---|---|
| `j` / `k` | Lead suivant / précédent dans la liste |
| `s` | Focus le dropdown de statut |
| `n` | Focus le champ "Ajouter une note" |
| `r` | Rejouer la dernière livraison webhook |
| `Esc` | Retour à la liste |

### Page liste de webhooks

| Raccourci | Action |
|---|---|
| `n` | Nouvelle destination |

### Page détail webhook

| Raccourci | Action |
|---|---|
| `t` | Envoyer un payload de test |
| `Esc` | Retour à la liste |

## Microinteractions

| Interaction | Comportement |
|---|---|
| Hover ligne tableau | `bg-encre/8` en `120ms` linear |
| Click bouton primary | léger scale 0.98 + bg plus sombre, durée 80ms |
| Toast apparition | slide-down 200ms + fade |
| Toast disparition auto | 4 s pour info, 6 s pour erreur, persistant pour danger |
| Spinner submit | spin 1 turn / 1 s, durée infinie |
| Focus input | bordure `encre/40 → encre`, ring 1px |
| Copy secret | toast "Copié dans le presse-papiers." pendant 2 s |
| Toggle activation | léger bounce + couleur sauge → encre/40 |

Toutes ces animations respectent `prefers-reduced-motion: reduce` et
sont alors instantanées.

## Comportement de pagination

- Cursor-based, mais affichage convivial : `1-25 sur 47` avec boutons
  Précédent / Suivant.
- Précédent désactivé sur la première page.
- Suivant désactivé si `hasMore === false`.
- Touche `Page Down` / `Page Up` : page suivante / précédente.

## Filtres

- Application **immédiate** au changement (debounce 300 ms pour la
  recherche texte).
- URL search params reflètent l'état → URL bookmarkable et partageable.
- Bouton "Réinitialiser les filtres" si ≥ 1 filtre actif.
- Chips dismissibles avec `×`.

## Confirmations destructives

Toute action irréversible (suppression de lead, suppression de webhook)
ouvre `ConfirmationModal` avec :

- Titre clair (« Supprimer ce lead ? »).
- Description précisant les conséquences.
- Bouton de confirmation en variant `danger` (rouge).
- Bouton "Annuler" comme action principale (ne pas pré-focus la
  destruction).
- `Esc` annule.
- Click hors modale annule.

## Feedback temporel

| Durée d'attente | Feedback |
|---|---|
| < 200 ms | aucun (réponse instantanée) |
| 200-1000 ms | spinner inline sur le bouton |
| > 1 s | spinner + désactivation du formulaire |
| > 5 s | toast "Cela prend plus de temps que prévu…" |

## Auto-refresh ?

Pas d'auto-refresh par défaut (l'admin est consultative). Bouton manuel
"Actualiser" dans le header à côté du titre, ou touche `R`.

Pour le dashboard uniquement : un compteur "Dernière mise à jour il y a
X minutes" indique la fraîcheur.

## Persistance d'état UI

| État | Persistance |
|---|---|
| Filtres actifs | URL search params (pas de localStorage) |
| Tri colonnes | URL search params |
| Page courante | URL cursor |
| Préférences personnelles (densité…) | localStorage `femiglow-admin-prefs` (v1.1+) |

L'URL est la **source de vérité** : recharger la page conserve l'état.
