# Brainstorming comparatif

## Méthode

Brainstorming morphologique : on décompose le studio en dimensions, puis on compare plusieurs options plausibles. Cette méthode convient ici car le sujet croise produit, IA, médias, publication, marque, admin et automation.

Dimensions explorées :

1. Où vit le studio ?
2. Quel degré d’automatisation ?
3. Comment générer les images ?
4. Comment garantir la charte ?
5. Quelle ergonomie pour la fondatrice ?
6. Comment se connecter à Postiz ?
7. Comment apprendre des performances ?

---

## 1. Localisation du studio

| Option | Description | Forces | Faiblesses | Pertinence |
| --- | --- | --- | --- | --- |
| A — Module intégré FemiGlow | Routes admin + DB existante | Reuse media/products/admin/audit, moins de friction | App encore plus large | Très haute |
| B — Microservice séparé | Service Node/Python dédié IA contenu | Isolation, scaling indépendant | Auth, UI, DB, deploy, observabilité à dupliquer | Moyenne |
| C — Utiliser Postiz AI directement | Produire dans Postiz | Rapide | Charte FemiGlow faible, peu de contrôle data | Basse |
| D — n8n/Zapier autour de Postiz | Workflows externes | Rapide pour POC technique | Ergonomie faible, audit/UX fragmentés | Moyenne pour automation, basse comme studio |

Décision : A, avec des abstractions propres pour pouvoir extraire plus tard.

---

## 2. Niveau d’automatisation

| Option | Description | Forces | Faiblesses | Pertinence |
| --- | --- | --- | --- | --- |
| A — Assistant brouillon | IA propose, humain publie | Sûr, fidèle marque, debuggable | Moins automatisé | Très haute |
| B — Semi-auto | IA génère + programme après validation globale | Bon volume | Risque si validations trop larges | Haute phase 2 |
| C — Auto complet | Calendrier + génération + publication | Gain temps maximal | Risque marque/compliance, posts génériques | Basse en prototype |
| D — Auto uniquement evergreen | Réutilise contenus validés | Sûr pour récurrence | Besoin corpus solide | Moyenne phase 2 |

Décision : A pour prototype, D possible ensuite.

---

## 3. Génération image/vidéo

| Option | Description | Forces | Faiblesses | Pertinence |
| --- | --- | --- | --- | --- |
| A — Sélection média existant | IA choisit dans bibliothèque | Fidélité produit maximale | Moins créatif | Très haute v0 |
| B — Image IA avec références produit | Génération/édition depuis photos FemiGlow | Bon équilibre | Demande garde-fous et QA visuelle | Haute v1 |
| C — Image IA sans référence | Prompt pur | Rapide | Risque produit infidèle, hallucination packaging | Basse |
| D — Templates graphiques | Fond, typo, citation, produit | Très stable, brand-safe | Moins naturel | Haute pour carrousels |
| E — Vidéo IA | Reel généré | Attractif | Coût, qualité, cohérence, droits | Basse v0, explorer plus tard |

Décision : A + D au prototype, B en POC contrôlé.

---

## 4. Fidélité marque

| Option | Description | Forces | Faiblesses | Pertinence |
| --- | --- | --- | --- | --- |
| A — Prompt système long | Charte injectée dans chaque génération | Simple | Drift possible, difficile à auditer | Moyenne |
| B — Brand Rule Engine | Règles lexicales, claims, ton, visuel | Testable, explicable | Nécessite maintenance | Très haute |
| C — LLM juge | Score IA qualité/charte | Flexible | Non déterministe | Haute comme second avis |
| D — Golden examples | Corpus posts bons/mauvais | Améliore style | Demande corpus | Haute |

Décision : B + C + D. Le score final combine règles déterministes et juge IA.

---

## 5. Ergonomie studio

| Option | Description | Forces | Faiblesses | Pertinence |
| --- | --- | --- | --- | --- |
| A — Wizard “Créer un post” | Intention → format → génération → review | Très clair | Moins adapté production en masse | Très haute prototype |
| B — Kanban editorial | Colonnes idée/draft/review/scheduled | Excellent suivi | Peut être lourd au démarrage | Haute |
| C — Calendrier visuel | Vue semaine/mois | Naturel pour réseaux sociaux | Nécessite données Postiz sync | Haute |
| D — Table admin dense | Rapide à implémenter | UX froide, peu créative | Moyenne |
| E — Canvas créatif | Manipulation visuelle avancée | Puissant | Trop cher pour v0 | Basse |

Décision : combiner A + B + C minimal.

---

## 6. Connexion Postiz

| Option | Description | Forces | Faiblesses | Pertinence |
| --- | --- | --- | --- | --- |
| A — Sync integrations + publish | Femiglow stocke IDs, appelle Postiz | Simple et robuste | Dépend clé API | Très haute |
| B — Proxy complet Postiz | UI Femiglow reproduit Postiz | Contrôle fort | Refaire un produit existant | Basse |
| C — Deep-link vers Postiz | Femiglow prépare, Postiz finalise | Simple | Rupture UX, moins traçable | Moyenne fallback |
| D — Webhooks Postiz | Statuts reviennent automatiquement | Très utile | À vérifier côté self-hosted/API | Haute phase 2 |

Décision : A au prototype, D si disponible.

---

## 7. Feedback loop

| Option | Description | Forces | Faiblesses | Pertinence |
| --- | --- | --- | --- | --- |
| A — Notes manuelles post-campagne | Fondatrice tague gagnant/perdant | Simple, qualitative | Subjectif | Haute v0 |
| B — Analytics Postiz | Import métriques | Automatique | API peut être limitée | Haute si exposé |
| C — Tracking site UTM | Mesure clics/conversions | Relié business | Requiert liens trackés | Très haute |
| D — LLM analyse hebdo | Synthèse tendances | Gain temps | Dépend données propres | Haute phase 2 |

Décision : A + C au prototype, B si disponible, D ensuite.

---

## Concept final issu du brainstorming

Un studio en trois plans :

1. **Plan stratégique** : intentions, campagnes, piliers, calendrier.
2. **Plan production** : briefs, drafts, assets, variations, scores.
3. **Plan diffusion** : approvals, Postiz, statuts, performances.

