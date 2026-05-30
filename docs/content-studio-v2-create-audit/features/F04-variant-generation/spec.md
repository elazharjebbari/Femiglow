# F04 — Génération des Variantes

## Objectif
Générer 3 variantes (A/B/C) à partir d'une idée. Chaque variante = caption + hook + cta + hashtags + altText + score brand review.

## Comportement attendu
- Déclenchement automatique après création d'idée (chain dans `IntentionForm.onCreated`)
- Affichage d'un loader pendant la génération (estimateur ~15-25s)
- Réponse contient brief + 3 drafts + 3 runs (one per draft OR one for the whole batch)
- Drafts insérés dans le contexte → VariantsCompare s'affiche

## Comportement actuel
- Chain implémentée dans `CreateWorkspace.tsx:153-174` (`onCreated`)
- Service `generateForIdea()` retourne brief + 3 drafts
- OpenAI ou fallback template (selon API key)
- Budget check (2 cents) ; si dépassé → erreur

## Gaps
- F04-LOCAL-1 : loader minimal pendant la génération (pas d'estimateur)
- F04-LOCAL-2 : pas de feedback du modèle utilisé (G07)
- F04-LOCAL-3 : pas de bouton "régénérer" si l'utilisateur n'aime pas les 3 variantes
- F04-LOCAL-4 : pas de gestion fine du timeout (peut bloquer indéfiniment)

## Propositions

### A — Statu quo + loader visible
Ajouter un loader simple "Génération en cours…" sous IntentionForm.

### B — Estimateur enrichi (comme MediaStudio)
Réutiliser `useGenerationEstimator` (déjà existant) avec barre de progression.

### C — Streaming SSE
Endpoint `/ideas/:id/generate-stream` qui pousse les variantes au fur et à mesure.

## Recommandation
**B** — réutiliser l'estimateur. Pas de stream pour l'instant (charge backend).

## Implementation
- Ajouter `useGenerationEstimator({ bucket: 'text', fallbackMs: 20_000 })` dans CreateWorkspace
- Afficher progress bar pendant la chaîne POST /ideas → POST /ideas/:id/generate
- Bouton "Régénérer" disponible après réception (callable indéfiniment, idempotency via nouvelle clé)
- Badge du modèle utilisé dans VariantsCompare header

## Tests
Voir `test-scenarios.yaml`.
