# F02 — Intention Form (Cadrer)

## Objectif
Capturer l'intention créative initiale : pilier de marque, objectif business, plateforme, format, prompt textuel — et désormais le **modèle de génération texte** (cf F03).

## Comportement attendu
- Carte radio pour Format (4 options : post / story / reel / carousel) avec icône + description
- Selects pour Pilier, Objectif, Plateforme (CTRL+F : `SelectField` natif stylé)
- Textarea pour Intention (8-2000 chars, validation Zod)
- ⭐ **ModelPicker** (nouveau, voir F03) au-dessus du textarea Intention
- Bouton "Enregistrer l'idée" — déclenche `POST /ideas` puis `POST /ideas/:id/generate`

## Comportement actuel
Fichier : `apps/web/src/components/admin/content-studio-v2/create/IntentionForm.tsx`

Tout fonctionne sauf : pas de ModelPicker, pas de feedback du modèle utilisé.

## Gaps
- G03 : pas de sélection modèle texte → adressé par F03
- F02-LOCAL-1 : pas d'indicateur visuel pendant `/ideas/:id/generate` (le bouton montre `loading` mais pas le contexte "génération de 3 variantes en cours, ~20s")

## Propositions

### A — Statu quo + ajouter ModelPicker
Simple ajout du ModelPicker au-dessus du textarea. Pas d'autres changements.

### B — Refactor en 2 colonnes
2 colonnes : à gauche les selects pilier/objectif/plateforme, à droite format + intention + modèle. Plus aéré.

### C — Wizard multi-step
Séparer en 3 sous-étapes : Contexte (pilier/objectif/plateforme) → Format → Intention+Modèle. Plus guidé pour novices.

## Recommandation
**A** — ajout incrémental du ModelPicker. Si retours utilisateurs, envisager B en v2.

## Implementation
- Ajouter `model` au state
- Ajouter `<ModelPicker role="chat" format={format} value={model} onChange={setModel} />` au-dessus du textarea
- Envoyer `model` dans le payload POST /ideas
- Aucun changement au schéma Zod sauf champ optionnel

## Tests
Voir `test-scenarios.yaml`.
