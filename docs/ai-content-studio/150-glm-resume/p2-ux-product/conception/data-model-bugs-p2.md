# Conception P2 — Bugs connus et dette technique

## Bugs hérités de P1

### B3 — `updateDraft()` ne valide pas les transitions d'état

**Localisation** : `src/lib/content-studio/service.ts`, fonction `updateContentDraft()`

**Problème** : Quand un draft est mis à jour via PATCH, le statut peut être modifié sans vérification de la state machine. Seuls les changements explicites via `approveContentDraft`, `reviewContentDraft`, etc. ont des appels `assertTransition()`.

**Solution P2** : Ajouter `assertTransition()` dans `updateContentDraft()` si le statut change.

**Sévérité** : Moyenne — permet des transitions invalides via l'API PATCH.

---

### B4 — Hashtags dans PlatformPreview

**Localisation** : `src/components/admin/content-studio/PlatformPreview.tsx`

**Problème** : La fonction `hashtags.map((tag) => `#${tag}`).join(' ')` ajoute un `#` devant chaque hashtag. Or les données dans `ContentDraft.hashtags` contiennent déjà le `#` (ex: `['#femiglow', '#rituel']`), ce qui produit `##femiglow ##rituel`.

**Solution P2** : Corriger PlatformPreview pour ne pas ajouter `#` si le tag commence déjà par `#`.

```typescript
// Avant (bug)
hashtags.map((tag) => `#${tag}`).join(' ')

// Après (corrigé)
hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')
```

**Sévérité** : Faible — cosmétique, n'affecte que l'aperçu.

---

### B5 — Pas de ErrorBoundary dans ContentStudioClient

**Localisation** : `src/components/admin/content-studio/ContentStudioClient.tsx`

**Problème** : Si un composant enfant lance une erreur, l'ensemble du Content Studio plante sans message d'erreur.

**Solution P2** : Ajouter un composant `ErrorBoundary` au niveau de `ContentStudioClient`.

```typescript
// Dans ContentStudioClient.tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">Erreur Content Studio</p>
      <p className="mt-1 text-xs text-red-700">{error.message}</p>
    </div>
  );
}

// Utilisation
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <ContentStudioClient {...props} />
</ErrorBoundary>
```

**Sévérité** : Moyenne — UX dégradée en cas d'erreur.

---

### B6 — ContentStudioClient ne gère pas les erreurs de fetch réseau

**Localisation** : `src/components/admin/content-studio/api.ts`

**Problème** : Les fonctions `postJson`, `patchJson`, `getJson` ne gèrent pas les erreurs réseau (timeout, DNS, etc.). Si le serveur ne répond pas, l'erreur est silencieuse.

**Solution P2** : Ajouter un timeout et un message d'erreur convivial.

```typescript
// Dans api.ts
const TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La requête a expiré. Veuillez réessayer.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
```

**Sévérité** : Moyenne — UX dégradée en cas de problème réseau.

---

### B7 — Pas de pagination dans les listes (ideas, drafts, posts)

**Localisation** : API routes `GET /ideas`, `GET /drafts`, `GET /posts`

**Problème** : Les listes retournent toutes les entrées sans pagination. Avec beaucoup de contenu, cela peut devenir lent.

**Solution P2** : Ajouter paramètres `limit` et `offset` avec les nouveaux query schemas (`ideaQuerySchema`, `draftQuerySchema`, `postQuerySchema`).

**Sévérité** : Faible — pas critique avec peu de données, mais nécessaire pour la production.

---

## Dette technique

### D1 — Service monolithique

`service.ts` fait 563+ lignes et gère toute la logique métier. Le plan P5 prévoit de le découper en services dédiés (`briefService`, `generationService`, etc.), mais ce n'est pas critique pour P2.

### D2 — Pas de cache côté client

Les composants font des appels API à chaque action. Un cache léger (stale-while-revalidate) améliorerait les performances, mais ce n'est pas critique pour le prototype.

### D3 — Tests E2E absents

Il n'y a pas encore de tests Playwright pour Content Studio. P2.8 prévoit d'en ajouter.

### D4 — Campaign non câblé

La table `content_campaign` existe en DB mais n'a aucun repository, service, ou API route. Ce n'est pas prioritaire pour P2 mais sera nécessaire pour P3+.