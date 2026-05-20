# P0 — Runbook : Correction authentification API admin Content Studio

**Date** : 2026-05-17
**Priorité** : Bloquante
**Duree estimee** : 1-2h
**Execute le** : 2026-05-17 par GLM-5.1
**Statut** : Termine

## Probleme

`requireAdmin()` (dans `lib/auth/require-admin.ts`) utilise `redirect()` de Next.js quand il n'y a pas de session. Pour les pages HTML c'est correct (redirige vers `/admin/login`), mais pour les routes API appelees via `fetch()` par le client React, le navigateur recoit le HTML de la page de login au lieu d'un JSON structure.

L'interface Content Studio ne pouvait donc pas :
- Detecter une session expiree
- Afficher une erreur claire a l'utilisateur
- Gerer le retry ou la reconnexion

## Solution appliquee

1. Cree `requireAdminApi()` dans `auth.ts` qui jette `HttpError('unauthorized', 'Session expiree...')` au lieu de `redirect()`
2. Remplace `requireAdmin()` par `requireAdminApi()` dans les 12 routes `api/admin/content-studio/*`
3. Garde `requireAdmin()` (redirect) pour la page `/admin/content-studio/page.tsx`
4. Aucune modification necessaire au client React - `parseJson()` affiche deja le message de l'API

## Implementation

### `auth.ts` - Nouvelle fonction

```typescript
export async function requireAdminApi(): Promise<AdminSession> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await decodeSession(token);
  if (!session) {
    throw new HttpError('unauthorized', 'Session expiree. Veuillez vous reconnecter.');
  }
  return session;
}
```

### Routes API - Changement pattern

Avant :
```typescript
import { requireAdmin } from '@/lib/auth/require-admin';
import { requireContentStudioEnabled } from '@/lib/content-studio/auth';
// ...
await requireAdmin('/admin/content-studio');
```

Apres :
```typescript
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
// ...
await requireAdminApi();
```

### Fichiers modifies

- `apps/web/src/lib/content-studio/auth.ts` - ajout de `requireAdminApi()`
- 12 fichiers `apps/web/src/app/api/admin/content-studio/*/route.ts` - remplacement des imports et appels

## Validation

- [x] `curl` sans cookie sur /api/admin/content-studio/ideas -> 401 JSON `{"error":{"code":"unauthorized","message":"Session expiree..."}}`
- [x] `curl` POST /api/admin/content-studio/automation sans cookie -> 401 JSON (identique)
- [x] Navigation admin normale -> 307 redirect vers login (inchange)
- [x] TypeScript : 0 erreurs
- [x] Build Next : succes
- [x] Service staging : actif