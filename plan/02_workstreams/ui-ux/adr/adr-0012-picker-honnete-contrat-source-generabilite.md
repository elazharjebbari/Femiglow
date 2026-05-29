# ADR-0012 — Picker honnête : le badge « Live » est lié à la générabilité réelle, pas à la découverte

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Workstream** : ui-ux (ACT-UX)
- **Findings liés** : `BUG-006`, `BUG-007`, `BUG-009`, `MISS-002`, `MISS-012`, `MISS-015`
- **Actions liées** : ACT-UX-001, ACT-UX-002, ACT-UX-003, ACT-UX-004
- **Décisions parentes** : ADR-0002 (vérité = comportement réel), ADR-0004 (résolution clés OpenAI unifiée), ADR-0006 (Higgsfield async), ADR-0007 (convergence vers A)
- **Dépend de (autres workstreams)** : ACT-ARC-RESOLVE-CRED / T-005 (`resolveProviderCredential()` unique), ACT-BE T-101/T-103 (générabilité réelle image/vidéo)

## Contexte

Le `ModelPicker` annonce aujourd'hui comme **« Live »** des modèles qui **throwent tous à la génération** (preuve audit : `GET /models?role=image` renvoie 14-18 modèles `source:'live'`, **aucun** générable ; sélectionner le suggested `gpt-image-1-mini` en live → HTTP 409 `invalid_state` clé manquante ; n'importe quel `hf-*` → 409 « credential Higgsfield incomplet »). Trois mécanismes concourent :

1. **Sources de clé divergentes** (BUG-006/007 root) : la *discovery* du picker passe par `resolveApiKey('openai')` (chaîne vers `OPENAI_API_KEY`, présente) tandis que le *générateur* `generateStudioImage` lit `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide). Le picker reflète une capacité que le moteur n'a pas.
2. **Badge forcé** (BUG-007 root b) : `materialiseDiscoveredModel` (`models/route.ts:62-88`) force toujours `source:'live'`, **même quand `discoverModels` a renvoyé `source='fallback'`** (host Higgsfield mort). Le fallback statique est maquillé en live.
3. **Desync catalogue↔exécution** (BUG-009) : le catalogue vidéo expose des IDs natifs Higgsfield (`veo3_1`, `kling3_0`…) que `generateStudioVideo` ne reconnaît pas (il n'accepte que `/^mock-/` et `startsWith('hf-')`) → throw avec un message **faux** (« aucun modèle vidéo live disponible » alors que le modèle EST higgsfield-live).

S'y ajoute la **pré-sélection automatique** (MISS-002) : `ModelPicker` injecte `onChange(suggested.id)` au montage sans action opérateur, armant le throw live au tout premier clic ; l'**`allowCustom` non validé** (MISS-015) qui laisse passer un id arbitraire jusqu'au générateur ; et la **non-persistance du `model`** (MISS-012) qui rend le choix sans effet ni trace (`run log` = `deterministic-template`).

C'est la classe de bug d'**honnêteté UI** la plus directe pour la cible (convergence vers A) : tant que le picker promet plus que ce que le moteur produit, l'opérateur perd confiance et ne peut distinguer un vrai échec d'une fausse affordance.

## Décision

1. **Le badge `source` est un fait, pas une intention.** `materialiseDiscoveredModel` **propage** `r.source` (`live` | `cache` | `static`/`fallback`) au lieu de forcer `live`. Un modèle issu du fallback statique porte `source !== 'live'` et l'UI l'affiche comme « Statique » / « Cache » (pictos existants `◯` / `◐`), jamais « Live ».
2. **« Live » ⟺ même résolution de clé que le générateur.** La discovery et le chemin de génération lisent **la même** source de credential (`resolveProviderCredential()` de T-005). Un modèle n'est badgé `Live` que si la clé que le **générateur** utilisera est effectivement résolue (pas seulement une clé générique trouvée côté discovery). C'est la règle de parité picker↔moteur.
3. **Générabilité par capacité, pas seulement par provider.** Tant que l'intégration vidéo async (T-103) n'est pas livrée, le catalogue vidéo n'expose `Live` **que** des modèles réellement routables par `generateStudioVideo` (route par `provider==='higgsfield'` + mapping ID-natif→interne, OU filtrage à liste blanche). Aucun modèle non routable n'est cliquable en live.
4. **Pas de pré-engagement d'un modèle non-fonctionnel.** La sélection automatique du suggested au montage (MISS-002) est conditionnée : on n'auto-sélectionne un modèle `Live` que s'il est générable ; sinon on ne pré-engage pas (la génération exige un choix explicite ou retombe sur un défaut sûr déclaré, typiquement mock).
5. **`allowCustom` borné.** Par défaut `allowCustom=false` sur les pickers du flux create (image/vidéo/texte) ; si activé, l'id custom est validé contre le registre/capacité avant d'atteindre l'API (sinon refus UI clair, pas de throw provider en aval).
6. **Le choix de modèle est tracé.** Le `model` sélectionné est persisté et honoré dans le `generation_run` ; l'UI ne prétend pas appliquer un choix qui serait écrasé en `deterministic-template` (MISS-012 — la trace doit refléter le modèle réellement utilisé).

## Conséquences

- **Positif** : le picker devient un instrument de vérité ; un badge `Live` est une promesse tenue (parité ADR-0002/0004) ; suppression d'une fausse affordance majeure avant convergence ; surface de desync UI/réalité fermée (custom, pré-sélection, vidéo non routable).
- **Coût / dépendance** : la règle 2 (« Live ⟺ générateur ») dépend strictement de T-005 (credential unique) et de T-101/T-103 (générabilité réelle) — **avant** ces tâches, le picker affichera surtout `Statique`/`Cache`, ce qui est l'état honnête attendu, pas une régression.
- **Réversible** : aucune décision d'architecture moteur ; uniquement le contrat d'affichage/validation du picker. La liste blanche vidéo est retirée quand T-103 livre le routage async.

## Alternatives écartées

- *Garder le badge `Live` optimiste et corriger seulement le générateur* : laisse l'UI mentir pendant toute la durée de P1 ; viole ADR-0002.
- *Masquer entièrement les modèles non générables* : perte d'information pour l'opérateur (il ne voit pas qu'un modèle existe mais n'est pas configuré) ; on préfère **déclarer l'état** (`Statique`/`non configuré`) plutôt que cacher.
