# Audit UI fonctionnel — AI Engine

**Date** : 2026-05-25  
**Résultat** : 23 éléments manquants identifiés

---

## Problème #1 — Aucune page AI Engine n'a de sidebar

| Page | AppShell | Sidebar visible |
|---|---|---|
| `/ai-engine` (Dashboard) | ❌ | ❌ |
| `/ai-engine/create` | ❌ | ❌ |
| `/ai-engine/config` | ❌ | ❌ |
| `/ai-engine/knowledge` | ❌ | ❌ |
| `/ai-engine/trends` | ❌ | ❌ |
| `/ai-engine/analytics` | ❌ | ❌ |
| `/ai-engine/graph` | ❌ | ❌ |

**Les pages `home`, `create`, `library`, `plan` utilisent `AppShell` → sidebar visible.**  
**Les pages AI Engine sont `use client` sans `AppShell` → pas de sidebar.**

**Correction** : Ajouter un layout `ai-engine/layout.tsx` qui wrap avec AppShell.

---

## Problème #2 — Config Providers : lecture seule

| Action | API | UI |
|---|---|---|
| Lister providers | ✅ GET | ✅ Cards |
| Modifier priorité | ✅ POST | ❌ Pas de formulaire |
| Modifier budget | ✅ POST | ❌ Pas de formulaire |
| Activer/désactiver | ✅ POST | ❌ Pas de toggle |
| Configurer circuit breaker | ✅ POST | ❌ Pas de formulaire |
| Tester connexion | ✅ GET /health | ✅ Bouton |
| Supprimer provider | ❌ | ❌ |

**Correction** : Ajouter un dialog d'édition provider avec formulaire.

---

## Problème #3 — Config Workflows : pas de CRUD

| Action | API | UI |
|---|---|---|
| Lister workflows | ✅ GET | ✅ Cards |
| Créer workflow | ✅ POST | ❌ Pas de formulaire |
| Modifier workflow | ✅ POST | ❌ Pas de formulaire |
| Supprimer workflow | ❌ | ❌ |

**Correction** : Ajouter formulaire création/édition workflow.

---

## Problème #4 — Config Prompts : pas de CRUD

| Action | API | UI |
|---|---|---|
| Lister prompts | ✅ GET | ✅ Cards |
| Créer prompt | ✅ POST | ❌ Pas de formulaire |
| Modifier prompt (nouvelle version) | ✅ POST | ❌ Pas de formulaire |
| Voir historique versions | ❌ | ❌ |
| Comparer versions | ❌ | ❌ |
| Supprimer prompt | ❌ | ❌ |

**Correction** : Ajouter éditeur de prompt avec preview et versionning.

---

## Problème #5 — Knowledge : pas de suppression

| Action | API | UI |
|---|---|---|
| Lister collections | ✅ GET | ✅ Liste |
| Créer collection | ✅ POST | ❌ Pas de formulaire (API existe) |
| Modifier collection | ❌ | ❌ |
| Supprimer collection | ❌ | ❌ |
| Ajouter doc texte | ✅ POST | ✅ Formulaire |
| Ajouter doc URL | ✅ POST | ❌ Pas d'option URL |
| Supprimer document | ❌ | ❌ |
| Éditer document | ❌ | ❌ |
| Générer embeddings | ✅ POST | ✅ Bouton |

**Correction** : Ajouter boutons supprimer, option URL, formulaire création collection.

---

## Résumé des corrections à implémenter

### Priorité 1 — Sidebar
1. Créer `ai-engine/layout.tsx` avec AppShell

### Priorité 2 — Config Providers
2. Dialog édition provider (priorité, budget, rate limit, enable/disable)
3. API DELETE provider (route)

### Priorité 3 — Config Workflows  
4. Formulaire création workflow
5. Formulaire édition workflow
6. API DELETE workflow (route)

### Priorité 4 — Config Prompts
7. Éditeur de prompt (system + user template)
8. Versioning (créer nouvelle version)
9. API DELETE prompt (route)

### Priorité 5 — Knowledge
10. Bouton supprimer document + API DELETE
11. Bouton supprimer collection + API DELETE
12. Option "Ajouter depuis URL" dans le formulaire
13. Formulaire création collection
