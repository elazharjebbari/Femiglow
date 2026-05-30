# P02 — Logique de déverrouillage des étapes

> **Contexte** : le Stepper actuel verrouille les étapes futures via `cursor:not-allowed` et `opacity:0.5`. La progression repose sur `draft.status`, mais l'UI ne fait jamais les transitions nécessaires (`needs_review`, `approved`). Cette proposition arbitre la **mécanique de progression**.

## Contraintes

1. Source de vérité unique : pas de drift entre UX visuelle et état métier
2. Navigation rétrograde toujours possible (revenir corriger)
3. Pas de blocage si l'utilisateur veut sauter une étape "non bloquante" (ex: éditer caption avant d'attacher média)
4. Feedback clair sur ce qui manque pour avancer

## Option A — Status-driven strict (état métier seul)

Le Stepper lit `draft.status` et reflète exactement l'état DB. Les transitions sont déclenchées par des actions utilisateur explicites :
- "Choisir cette variante" → `POST /drafts/:id/review` → `needs_review`
- "Valider et préparer" → `POST /drafts/:id/approve` → `approved`

### Forces
- Source de vérité unique
- Audit/reporting fidèle
- Pas de hack visuel
- Cohérent avec architecture state-machine

### Faiblesses
- Nécessite des appels API supplémentaires (peuvent échouer)
- Plus de boutons UI explicites (potentiellement plus de friction)

### Pertinence
Cohérent et propre. Le coût "boutons supplémentaires" est en réalité un bénéfice UX (intentionnalité).

## Option B — Hybride : UI flag + status

Maintenir l'approche actuelle `deriveActiveStep` côté UI (regarde status + presence média + caption non-vide) mais SYNC vers le statut via un debounce :
- À chaque changement UI signifiant, déclencher en background l'API correspondante

### Forces
- L'UX semble fluide
- L'utilisateur ne voit pas les boutons "intermédiaires"

### Faiblesses
- Magique : l'utilisateur ne sait pas pourquoi le step a changé
- Race conditions possibles (autosave + auto-review + select)
- Rollback complexe en cas d'échec API
- Audit trouble (transition implicite)

### Pertinence
Trop magique pour un flow business avec règles d'approbation.

## Option C — Stepper non-bloquant + checks au "Valider"

Stepper purement visuel (indicatif), aucun verrouillage. Tous les steps cliquables. Au moment du clic Publier ou Valider, on vérifie les pré-requis et on affiche une erreur claire si manquant.

### Forces
- Liberté maximale
- Pas de friction à l'avancement
- Stepper devient purement informatif

### Faiblesses
- L'opérateur novice peut se perdre
- Erreurs détectées tard
- L'UI ne guide plus

### Pertinence
Bien pour power-users seuls. Mauvais pour onboarding ou audit.

## Comparaison

| Critère | A — Status-driven | B — Hybride | C — Non-bloquant |
|---------|-------------------|-------------|------------------|
| Source de vérité | 🟢 unique | 🔴 doublée | 🟢 (mais lâche) |
| Audit | 🟢 | 🔴 | 🟡 |
| UX fluide | 🟡 (2 clics) | 🟢 | 🟢 |
| Onboarding | 🟢 (guidé) | 🟡 | 🔴 |
| Race conditions | 🟢 | 🔴 | 🟢 |
| Réversibilité | 🟢 | 🟡 | 🟢 |

## Recommandation finale

**Option A — Status-driven strict**, augmentée de :

1. **Auto-review au select variante** : quand l'utilisateur clique "Choisir cette variante", déclencher `POST /drafts/:id/review` en arrière-plan ET mettre à jour le draft localement. Pas un comportement magique — c'est sémantiquement attendu (sélectionner = soumettre au review).

2. **Bouton explicite "Valider et préparer la publication"** dans le PreviewPane :
   - Position : en bas du PreviewPane, sous l'aperçu
   - Variant : `primary` (couleur accent FemiGlow)
   - State :
     - `disabled` si caption vide OU media manquant OU brand_review.status='blocked'
     - Tooltip explicite quand disabled : "Attachez un visuel pour valider"
   - Action : `POST /drafts/:id/approve` → upsertPost → débloque PublishActionGroup

3. **Navigation rétrograde toujours possible** : les steps précédents (`done`) sont cliquables, ramènent au composant correspondant via scroll/focus.

4. **Steps futurs visibles mais non cliquables** : pas de `cursor:not-allowed` agressif ; un texte d'aide en dessous ("Sélectionnez une variante pour continuer").

### Conséquences

- `Stepper.tsx` doit refléter exactement les statuts (pas de hack `deriveActiveStep`)
- `VariantsCompare` doit appeler `/drafts/:id/review` au select
- Nouveau composant `ApproveButton` dans PreviewPane
- `PublishActionGroup` lit `postId` directement de `posts` context (déjà le cas)

Voir `features/F01-stepper-progress/`, `features/F05-variant-comparison/`, et `features/F13-approval-postid/` pour la mise en œuvre.
