# Plan de conception (design → spec → validation)

> Objectif : qu'aucun écran ne parte en développement sans une spec UX
> **testable** — chaque critère d'acceptation doit être formulable en oracle
> de test (sinon il est reformulé). Méthode type cabinet : artefacts légers,
> revues courtes, traçabilité totale audit → spec → test.

## 1. Chaîne d'artefacts par fonctionnalité

```
matrice d'audit (IDs)            ../03-matrice-problemes.csv
   │
   ▼
wireframe cible (ASCII)          ../interfaces/1x-*.md  §4        [DÉJÀ LIVRÉ]
   │
   ▼
description du fonctionnement    fonctionnalites/Fxx/01-description.md
optimal (vue opérateur)
   │
   ▼
spec technique machine-readable  fonctionnalites/Fxx/02-spec-technique.yaml
(composants, contrats, états)
   │
   ▼
batterie de tests (oracles)      fonctionnalites/Fxx/03-batterie-tests.csv
   │
   ▼
scénarios métier E2E             fonctionnalites/Fxx/04-scenarios-metier.md
```

**Règle de traçabilité** : chaque ligne de batterie porte soit un
`regression_ref` (ID de la matrice d'audit qu'elle verrouille), soit le tag
`nominal`/`metier` — un problème d'audit sans test = revue refusée.

## 2. Design tokens & système visuel

Source : `../05-design-system-conventions.txt` §9. Décisions gelées :

| Token | Valeur | Remplace |
|---|---|---|
| `semantic.success` | emerald (50/300/700) | sage ET emerald mélangés |
| `semantic.danger` | rose (50/300/700) | rose ET red mélangés |
| `semantic.warning` | amber (50/300/800) | — (déjà cohérent) |
| `semantic.info` | sky (50/300/700) | sky ET blue mélangés |
| `action.primary` | stone-900 → hover stone-800 | — |
| `label.form` | text-xs font-medium text-stone-600, sans uppercase | 2 patterns concurrents |
| typographie admin | sans-serif partout | font-serif de templates/new |

Implémentation : objets `tone` dans `ui/Pill.tsx` + classes utilitaires —
PAS de refonte tailwind.config (risque de débordement sur le site public).
**Test de verrouillage** : test unitaire qui échoue si `sage-`/`red-`/`blue-`
apparaissent dans `components/admin/emails/**` hors liste blanche (grep AST).

## 3. Standards d'interaction (critères d'acceptation transverses)

Chaque écran DOIT satisfaire ces invariants (testés dans F01 puis hérités) :

1. **Action destructive** → `ConfirmDialog` : focus initial sur Annuler,
   `Esc` ferme sans agir, bouton danger libellé par le verbe (« Supprimer »,
   jamais « OK »), conséquences explicites, saisie de confirmation si
   irréversible massif (>50 éléments).
2. **Mutation réussie** → toast succès auto-dismiss 4 s, formulé résultat
   (« 3 emails relancés »), JAMAIS « opération effectuée ».
3. **Mutation échouée** → toast/bandeau persistant `role="alert"`, message
   actionnable (consigne), bouton Réessayer qui rejoue la MÊME action avec le
   MÊME état (sélection préservée).
4. **Données affichées** → fraîcheur visible (`Freshness`) dès qu'un écran
   reste ouvert (>60 s de validité), TZ explicite sur toute heure.
5. **Liste vide** → `EmptyState` : pourquoi c'est vide + action suivante.
6. **Formulaire sale** → garde de sortie (dialog navigation + beforeunload).
7. **Chargement** → skeleton `role="status"` (jamais de page blanche), bouton
   en cours = libellé dédié (« Envoi… ») + `aria-busy`.
8. **Clavier** : tout parcours réalisable sans souris ; wizards Ctrl+←/→ ;
   focus visible ; aucune perte de focus après action.

## 4. Accessibilité — barème de conception

Cible WCAG 2.1 AA sur les écrans refondus. Checklist par spec :
- contrastes ≥ 4.5:1 (vérif tooling au moment du choix de tone) ;
- emojis décoratifs `aria-hidden`, icônes d'action avec `aria-label` ;
- live regions : 1 seule region polite par zone (pas de spam SR) ;
- tableaux : `scope="col"`, tri `aria-sort`, sélection labellisée par ligne ;
- dialogs : focus trap + retour du focus à l'élément déclencheur à la fermeture.
Tests : axe en jsdom sur chaque composant du socle (smoke), axe Playwright sur
chaque page refondue (gate bloquant : 0 violation serious/critical).

## 5. Processus de revue

| Revue | Quand | Participants | Sortie |
|---|---|---|---|
| Revue de spec | avant dev d'un Fxx | dev + relecteur (rôle « QA lead ») | spec amendée, batterie validée |
| Revue de PR | chaque PR | relecteur + gates CI | merge |
| Revue d'écran | fin de chantier | démo enregistrée du parcours opérateur (scénarios métier déroulés à la main une fois) | GO switch de route |

Toute dérogation aux standards §3 est consignée dans la spec YAML
(`derogations:`) avec justification — sinon c'est un bug.
