# Plan d'action hardening AI generation / Postiz

Date: 2026-05-19
Scope: serveur de staging `/var/www/femiglow-staging`, module Admin Content Studio / AI generation / Postiz.

## Objectif

Rendre le flux AI generation -> brouillon approuvé -> brouillon Postiz robuste, observable et non régressif. Le plan couvre le backend, le frontend, l'UI/UX, les données, les tests et l'exploitation staging.

## Constats à corriger

- Les tests réels OpenAI et Postiz passent, mais Postiz peut répondre avec des formes JSON différentes selon l'endpoint ou la version.
- Les deliveries envoyées pouvaient rester avec `postizPostId = null` malgré un statut `sent` si l'ID est imbriqué dans `post`, `data`, `posts`, `result`, etc.
- L'upload média dépend d'une URL publique staging et d'un appel externe Postiz: un 5xx/429/timeout court ne doit pas faire échouer définitivement le parcours dès la première tentative.
- La page admin doit continuer à rester utilisable même si Postiz est partiellement indisponible: erreur claire, delivery persistée, état réessayable.

## Plan d'action robuste

### Phase 1 - Contrat backend Postiz

- Centraliser l'extraction de l'ID Postiz dans `apps/web/src/lib/content-studio/postiz.ts`.
- Accepter les réponses directes et imbriquées: `id`, `postId`, `post_id`, `publicationId`, `post`, `posts`, `data`, `result`, `items`.
- Conserver `null` uniquement si aucune valeur exploitable n'est présente.
- Couvrir ce contrat par tests unitaires.

### Phase 2 - Résilience réseau

- Ajouter un retry borné sur les statuts transitoires: `408`, `425`, `429`, `5xx`.
- Appliquer le retry à la récupération du média source staging, à l'upload Postiz et à la création du brouillon Postiz.
- Limiter les tentatives pour éviter les doubles effets incontrôlés: maximum 3 par défaut, borné à 5.
- Persister l'échec en delivery avec le stage concerné et le nombre de tentatives quand l'échec reste définitif.

### Phase 3 - Tests et non-régression

- Vitest ciblé sur Postiz, image generation, state machine et MSW Content Studio.
- Typecheck complet du package web.
- Build Next.js staging.
- Smoke HTTP sur `/admin/content-studio` après redémarrage.
- Test réel Postiz staging avec brouillon approuvé existant pour vérifier que le flux reste fonctionnel.

### Phase 4 - UI/UX à poursuivre ensuite

- Afficher dans l'admin un statut delivery plus explicite: `sent`, `failed`, `auth_failed`, stage d'échec et dernier message.
- Afficher l'ID Postiz quand il existe, avec lien futur vers Postiz si l'API fournit une URL stable.
- Ajouter une action de retry contrôlée depuis l'admin pour une delivery échouée, avec confirmation et audit log.
- Montrer le provider/modèle/coût estimé du dernier run AI sur la fiche brouillon pour rendre le système plus déboggable.

## Critères d'acceptation

- Les brouillons sans image gardent `image: []` dans le payload Postiz.
- Les réponses Postiz imbriquées produisent un `postizPostId` quand un ID est disponible.
- Les erreurs réseau transitoires ont au moins 3 tentatives avant échec final.
- Les tests ciblés, le typecheck et le build passent.
- Le service `femiglow-staging.service` est redémarré et `/admin/content-studio` répond.
