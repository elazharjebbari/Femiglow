# Plan d'action — Villes prioritaires à l'affichage

**Date** : 2026-05-16  
**Branche** : `worktree-priority-cities`  
**Objectif** : Afficher en priorité les villes les plus commandées dans l'autocomplete du checkout, et fournir à l'admin une interface pour gérer cette priorité.

---

## Contexte

Actuellement, quand l'utilisateur ouvre le champ de ville dans le wizard checkout (étape 2), l'autocomplete affiche les villes par ordre alphabétique (ou par `position` puis `nameFr` si `position` est 0 pour toutes). L'expérience n'est pas optimale car les grandes villes (Casablanca, Marrakech, etc.) sont noyées dans la liste.

Le champ `position` existe déjà dans le schéma `delivery_cities` et dans le tri de `searchDeliveryCities()`. Il suffit de l'utiliser pour épingler les villes prioritaires en haut.

---

## Étapes d'exécution

### Phase 1 — Données : mise à jour des positions优先

| # | Tâche | Fichier(s) | Test |
|---|-------|------------|------|
| 1.1 | Écrire un script SQL de migration pour attribuer les positions优先 aux 13 villes | `drizzle/migrations/0054_priority_cities.sql` | Vérifier les positions en DB |
| 1.2 | Mettre à jour les données statiques `MOROCCAN_CITIES` avec un champ `position` | `src/lib/checkout/data/moroccan-cities.ts` | `moroccan-cities.test.ts` |
| 1.3 | Ajouter les 2 villes manquantes (Bouskoura-Ville Verte, Dar Bouaza) dans les données statiques et le seed | `moroccan-cities.ts`, `delivery-cities-sendit.json` | Tests seed |
| 1.4 | Ajouter le champ `position` dans les types `MoroccanCity` et les fonctions de search | `moroccan-cities.ts` | Tests existants + nouveaux |

### Phase 2 — Backend : API de gestion des positions

| # | Tâche | Fichier(s) | Test |
|---|-------|------------|------|
| 2.1 | Ajouter un endpoint `PATCH /api/admin/delivery-cities/positions` pour batch-update les positions | `src/app/api/admin/delivery-cities/positions/route.ts` | `route.test.ts` |
| 2.2 | Ajouter la Zod schema `deliveryCityPositionsSchema` | `src/lib/checkout/delivery/schemas.ts` | Tests unitaires |
| 2.3 | Ajouter `updateDeliveryCityPositions()` dans les queries | `src/lib/db/queries/delivery-cities.ts` | Tests unitaires |

### Phase 3 — Admin UI : panneau villes优先

| # | Tâche | Fichier(s) | Test |
|---|-------|------------|------|
| 3.1 | Ajouter un onglet « Villes优先 » dans l'éditeur admin existant | `DeliveryCitiesEditor.tsx` | Playwright |
| 3.2 | Créer le composant `PriorityCitiesPanel` avec drag-to-reorder | `src/components/admin/settings/PriorityCitiesPanel.tsx` | Vitest + Playwright |
| 3.3 | Ajouter les boutons « Ajouter / Retirer de la priorité » dans la table principale | `DeliveryCitiesEditor.tsx` | Playwright |
| 3.4 | Indicateur visuel de position dans la table (badge numéroté) | `DeliveryCitiesEditor.tsx` | Visuel |

### Phase 4 — Frontend : autocomplete avec villes优先 en tête

| # | Tâche | Fichier(s) | Test |
|---|-------|------------|------|
| 4.1 | Modifier `searchCities()` dans `moroccan-cities.ts` pour trier par `position` | `moroccan-cities.ts` | `moroccan-cities.test.ts` |
| 4.2 | Le backend `searchDeliveryCities()` trie déjà par `position ASC, nameFr ASC` — vérifier que c'est correct | `delivery-cities.ts` | Tests existants |
| 4.3 | Vérifier que l'autocomplete affiche bien les villes优先 quand la query est vide | `CityAutocomplete.tsx` | Playwright |
| 4.4 | Ajouter un label « Villes populaires » au-dessus des suggestions优先 quand la query est vide | `CityAutocomplete.tsx` | Playwright |

### Phase 5 — Tests non-régression

| # | Tâche | Fichier(s) |
|---|-------|------------|
| 5.1 | Tests unitaires : `moroccan-cities.test.ts` (position, tri优先, villes manquantes) | `src/lib/checkout/data/moroccan-cities.test.ts` |
| 5.2 | Tests unitaires : `delivery-cities.ts` queries (updatePositions) | `src/lib/db/queries/delivery-cities.test.ts` |
| 5.3 | Tests API : `positions/route.test.ts` (batch update, validation, auth) | `src/app/api/admin/delivery-cities/positions/route.test.ts` |
| 5.4 | Tests e2e : `delivery-cities-priority.spec.ts` (admin UI, autocomplete优先) | `e2e/delivery-cities-priority.spec.ts` |
| 5.5 | Tests MSW : mock API pour le panel admin | `src/mocks/handlers/delivery-cities.ts` |

### Phase 6 — Migration & déploiement

| # | Tâche |
|---|-------|
| 6.1 | Lancer `pnpm db:generate` pour créer la migration Drizzle |
| 6.2 | Appliquer la migration en dev |
| 6.3 | Build + restart |
| 6.4 | Vérifier l'autocomplete en prod-staging |
| 6.5 | Configurer les 13 villes优先 via l'admin UI |

---

## Villes prioritaires initiales

| Position | Slug | Nom FR | Nom AR | Justification |
|----------|------|--------|--------|---------------|
| 1 | casablanca | Casablanca | الدار البيضاء | Plus grande ville, volume le plus élevé |
| 2 | marrakech | Marrakech | مراكش | 2e destination e-commerce |
| 3 | tanger | Tanger | طنجة | Hub Nord |
| 4 | agadir | Agadir | أكادير | Hub Sud |
| 5 | kenitra | Kénitra | القنيطرة | Zone Rabat-Salé-Kénitra |
| 6 | fes | Fès | فاس | Grand centre |
| 7 | meknes | Meknès | مكناس | Grand centre |
| 8 | tetouan | Tétouan | تطوان | Nord intérieur |
| 9 | dar-bouaza | Dar Bouaza | الدار البيضاء外围 | Périphérique Casa |
| 10 | mohammedia | Mohammedia | المحمدية | Périphérique Casa |
| 11 | el-jadida | El Jadida | الجديدة | Côtier |
| 12 | bouskoura-ville-verte | Bouskoura-Ville Verte — | — | Zone résidentielle Casa |
| 13 | oujda | Oujda | وجدة | Est |

**Note** : Bouskoura et Dar Bouaza ne sont pas dans les données statiques actuelles. Elles devront être ajoutées au seed ou via l'admin.

---

## Ordre d'exécution recommandé

1. Phase 1 (données) → 2. Phase 2 (API) → 3. Phase 3 (admin UI) → 4. Phase 4 (frontend) → 5. Phase 5 (tests) → 6. Phase 6 (migration)

Chaque phase est indépendante et peut être commitée séparément. Les tests de Phase 5 sont écrits en parallèle des Phases 1-4.