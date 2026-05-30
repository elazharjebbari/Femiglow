# Phase 6 — Publish Validation (3 modes)

## Objectif
Vérifier et améliorer les 3 modes de publication (now / schedule / draft-on-provider) avec récap, mock mode badge, mapping erreurs.

## Durée estimée
0.5 j-p (dev) + 0.5 j (tests)

## Dépendances
- Phase 5 (postId disponible)

## Changements

### 1. Dialog enrichi pour Publier maintenant

```tsx
// PublishActionGroup.tsx — Dialog 'now'
<Dialog
  open={mode === 'now'}
  title="Publier maintenant ?"
  description="Le post sera envoyé immédiatement au provider configuré."
  size="md"
>
  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
    {media ? (
      <img
        src={media.thumbnailUrl ?? media.previewUrl}
        alt=""
        style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 6 }}
      />
    ) : null}
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 13, color: 'var(--cs-fg-primary)', margin: 0 }}>
        {draft.caption?.slice(0, 140)}{draft.caption?.length > 140 ? '…' : ''}
      </p>
      <span style={{ fontSize: 11, color: 'var(--cs-fg-muted)' }}>
        Plateforme : {draft.platform} · Format : {draft.format}
      </span>
    </div>
  </div>
  {mockMode ? (
    <p style={{ fontSize: 11, color: 'var(--cs-warning)' }}>
      Mode mock — publication simulée, aucun appel réel.
    </p>
  ) : null}
</Dialog>
```

### 2. Mock mode dans PublishActionGroup

```tsx
const { mockMode } = useStudio();
// Inline badge à côté du bouton Publier
{mockMode ? <MockModeBadge /> : null}
```

### 3. Mapping erreurs

```tsx
// apps/web/src/lib/content-studio-v2/errors/messages.ts (nouveau)
export const ERROR_MESSAGES: Record<string, string> = {
  budget_exceeded: 'Budget IA quotidien atteint.',
  brand_review_blocked: 'Le contenu est bloqué par la revue brand.',
  no_media_attached: 'Aucun média attaché au draft.',
  no_account_connected: 'Aucun compte social connecté.',
  session_expired: 'Session expirée, veuillez vous reconnecter.',
  rate_limit_exceeded: 'Trop de requêtes, réessayez dans un instant.',
  provider_down: 'Provider indisponible.',
  version_conflict: 'Le draft a été modifié ailleurs. Rechargez la page.',
  min_lead_time: 'La date doit être au moins 5 minutes dans le futur.',
};

export function formatError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    const code = err.code as string;
    return ERROR_MESSAGES[code] ?? ('message' in err ? String(err.message) : 'Erreur inconnue');
  }
  return err instanceof Error ? err.message : 'Erreur inconnue';
}
```

### 4. Utiliser `formatError` dans tous les catch blocks

```ts
// PublishActionGroup.tsx
async function executePublish(target: 'now' | 'schedule' | 'draft') {
  try { ... }
  catch (err) {
    const json = await err.response?.json?.().catch(() => null);
    const friendly = formatError(json?.error ?? err);
    toast.error(`Publication : ${friendly}`);
  }
}
```

### 5. Boutons preset schedule

```tsx
// Au-dessus du datepicker dans dialog schedule:
<div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
  <Button size="sm" variant="ghost" onClick={() => setScheduledAt(addHours(now(), 1))}>
    +1h
  </Button>
  <Button size="sm" variant="ghost" onClick={() => setScheduledAt(tomorrow9am())}>
    Demain 9h
  </Button>
  <Button size="sm" variant="ghost" onClick={() => setScheduledAt(nextMonday14h())}>
    Lundi 14h
  </Button>
</div>
```

### 6. Label timezone

```tsx
<span style={{ fontSize: 11, color: 'var(--cs-fg-muted)' }}>
  Fuseau : {Intl.DateTimeFormat().resolvedOptions().timeZone}
</span>
```

## MSW handlers

Voir `test-battery/03-msw-handlers.yaml`. Implémenter dans `src/test/msw/content-studio-handlers.ts`.

## Tests

### Component
- `PublishActionGroup.test.tsx` mis à jour pour les nouveaux dialogs

### Contract
- `posts-publish-now.contract.test.ts`
- `posts-schedule.contract.test.ts`
- `posts-draft-on-provider.contract.test.ts`

### E2E
- `create-golden-path.spec.ts` couvre publish-now
- `create-scheduling.spec.ts` (S07)
- `create-error-recovery.spec.ts` (S06)

## Acceptance
- [ ] Dialog publish-now affiche thumbnail + caption
- [ ] Dialog schedule a 3 boutons preset + label timezone
- [ ] Erreurs mappées vers messages clairs
- [ ] Mock badge inline dans PublishActionGroup
- [ ] 0 fail tests Phase 6
