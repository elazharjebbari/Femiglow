# Résumé exécutif

## Vision

Le studio doit devenir l’atelier de production éditoriale FemiGlow. Il ne doit pas seulement “générer des posts”. Il doit transformer une intention de marque en contenu publiable, vérifiable, traçable et réutilisable.

Le flux cible :

1. La fondatrice choisit une intention : rituel, preuve, produit, journal, témoignage, réassurance, saison.
2. Le studio propose plusieurs angles éditoriaux et formats.
3. Le studio génère des brouillons texte et des directions visuelles.
4. Le système vérifie la conformité à la charte : ton, vocabulaire, promesses, visuels, formats, sécurité.
5. L’humain édite et approuve.
6. Le bridge Postiz programme ou publie.
7. Les performances reviennent dans FemiGlow pour améliorer les prochains contenus.

## Décision prototype

Le prototype doit être intégré à `apps/web` dans le back-office existant, pas livré comme microservice séparé.

Raisons :

- FemiGlow possède déjà les briques utiles : admin, media, tracking, chat/LLM, email, audit, Postgres/Drizzle.
- Le studio doit réutiliser la charte, les produits, les médias et les contenus existants.
- Le besoin initial est l’ergonomie et la robustesse du workflow, pas la scalabilité multi-tenant.
- Postiz est déjà le bon service externe pour publier ; FemiGlow doit rester le cerveau éditorial et le système de validation.

## Périmètre prototype ergonomique

Inclus :

- Bibliothèque d’idées.
- Génération de briefs.
- Génération de captions.
- Génération ou proposition de visuels.
- Variantes par plateforme.
- Score de conformité marque.
- Prévisualisation Instagram/Facebook.
- Workflow draft → review → approved → scheduled → published.
- Bridge Postiz : integrations, upload, create post.
- Calendrier éditorial simple.
- Audit trail.
- Runbook et tests.

Exclus du prototype :

- Publication 100 % automatique sans validation.
- Réponse aux commentaires/DM.
- Analytics avancés si Postiz/API ne les expose pas.
- Génération vidéo longue.
- Multi-marques ou multi-clients.
- Achat média publicitaire.

## Principes non négociables

| Principe | Implication |
| --- | --- |
| Fidélité marque avant volume | Mieux vaut 3 posts parfaits que 30 posts génériques |
| Humain dans la boucle | Aucune publication IA directe en prototype |
| Source unique de vérité | Les prompts lisent une charte versionnée, pas des consignes dispersées |
| Traçabilité | Chaque post conserve prompt, modèle, assets, validations, score, export Postiz |
| Réversibilité | Un post programmé doit pouvoir être retiré ou repassé en draft |
| Interopérabilité | Postiz publie ; FemiGlow garde stratégie, contenu, audit, feedback |

## Mesure de succès

| KPI | Cible prototype |
| --- | --- |
| Temps idée → post approuvé | < 15 minutes |
| Taux de brouillons acceptables sans réécriture lourde | ≥ 60 % |
| Posts bloqués par garde-fous avant review | 100 % des violations critiques |
| Publication Postiz traçable | 100 % |
| Médias avec droits/source/usage enregistrés | 100 % |
| Rollback d’un post programmé | < 2 minutes |

