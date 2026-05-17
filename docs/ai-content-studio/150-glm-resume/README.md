# Reprise GLM-5.1 — AI Content Studio

**Modèle** : GLM-5.1 (Cloud)
**Date de reprise** : 2026-05-17
**Contexte** : Reprise du développement après la session Codex du 14-15 mai 2026

---

## Problème immédiat

Les routes API admin du Content Studio (`/api/admin/content-studio/*`) utilisent `requireAdmin()` qui appelle `redirect()` de Next.js quand il n'y a pas de session. Ce comportement est correct pour les pages (navigation directe vers `/admin/login`), mais pour les appels `fetch()` côté client, le navigateur reçoit une page HTML de login au lieu d'une réponse JSON structurée.

Conséquence concrète : l'interface Content Studio ne peut pas distinguer une erreur d'authentification d'une erreur serveur. Le panneau "Santé Postiz" (route `/api/admin/content-studio/automation`) était le dernier point en cours de correction quand la session Codex s'est arrêtée.

## Approche

Créer une variante `requireAdminApi()` qui renvoie du JSON `{ error, status }` au lieu d'un redirect. L'appliquer à toutes les routes API admin du Content Studio. Garder `requireAdmin()` inchangé pour les pages.

## Plan d'action P0

Voir `p0-auth-api-fix/runbook.md` pour l'exécution détaillée.