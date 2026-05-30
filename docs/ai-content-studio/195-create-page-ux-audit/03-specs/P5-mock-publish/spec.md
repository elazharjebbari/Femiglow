# P5 -- Mock Publish Chain (BridgeResult + Publish Handler)

## But

Rendre la section Publication visible et testable en mode mock en:
1. Ajoutant un `bridgeResult` non-null dans la reponse mock generate
2. Creant un handler MSW pour `POST /publish` avec une reponse mock realiste
3. Ajoutant un badge "Mode Mock" discret quand les IDs sont des mocks

---

## Probleme Actuel

La `PublishSection` (GenerationResult.tsx ligne 657) ne s'affiche que si `bridgeResult` est truthy:

```typescript
{bridgeResult && (
  <PublishSection draftId={bridgeResult.draftId} />
)}
```

Le mock actuel dans `ai-engine-handlers.ts` (ligne 35) inclut deja un `bridgeResult`:

```typescript
bridgeResult: { ideaId: 'ci_test001', briefId: 'cb_test001', draftId: 'cd_test001' },
```

MAIS le `handleGenerate` dans `page.tsx` (ligne 645) fait:

```typescript
setBridgeResult(data.bridgeResult ?? null);
```

Le probleme est que le mock fonctionne deja pour `MOCK_GENERATION_RESULT`, mais le `MOCK_REVIEW_PAYLOAD` (introduit par P3) ne contient pas de `bridgeResult`. De plus, le handler `POST /publish` existant (ligne 173) retourne une reponse trop minimale.

---

## Modifications Requises

### 1. BridgeResult dans MOCK_GENERATION_RESULT (deja present)

Le mock existant a deja:
```typescript
bridgeResult: { ideaId: 'ci_test001', briefId: 'cb_test001', draftId: 'cd_test001' },
```

Remplacer par des IDs clairement identifies comme mock:
```typescript
bridgeResult: {
  ideaId: 'mock-idea-001',
  briefId: 'mock-brief-001',
  draftId: 'mock-draft-001',
},
```

### 2. BridgeResult dans MOCK_REVIEW_PAYLOAD (nouveau, P3)

Ajouter a la reponse review le meme pattern:
```typescript
const MOCK_REVIEW_PAYLOAD = {
  // ... champs existants de P3 ...
  bridgeResult: {
    ideaId: 'mock-idea-review-001',
    briefId: 'mock-brief-review-001',
    draftId: 'mock-draft-review-001',
  },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=mock-draft-review-001',
};
```

Le handler `POST /jobs/:id/review` (ligne 181-183) doit aussi retourner un `bridgeResult`:
```typescript
http.post(`${BASE}/jobs/:id/review`, () => {
  return HttpResponse.json({
    ...MOCK_GENERATION_RESULT,
    status: 'completed',
    bridgeResult: {
      ideaId: 'mock-idea-reviewed-001',
      briefId: 'mock-brief-reviewed-001',
      draftId: 'mock-draft-reviewed-001',
    },
  });
}),
```

### 3. Handler POST /publish Enrichi

Le handler existant:
```typescript
http.post(`${BASE}/publish`, () => {
  return HttpResponse.json({ success: true, postId: 'post-001' });
}),
```

Remplacer par un handler qui lit le body et retourne une reponse realiste:

```typescript
http.post(`${BASE}/publish`, async ({ request }) => {
  const body = await request.json() as Record<string, unknown>;
  const draftId = (body.draftId as string) ?? 'unknown-draft';
  const mode = (body.mode as string) ?? 'now';
  const scheduledAt = body.scheduledAt as string | undefined;
  const jobId = `mock-pub-${Date.now()}`;
  const postId = `mock-post-${Date.now()}`;

  const response: Record<string, unknown> = {
    status: 'published',
    postId,
    draftId,
    job: {
      id: jobId,
      status: 'completed',
      platform: 'instagram',
      publishedAt: new Date().toISOString(),
    },
  };

  if (mode === 'schedule' && scheduledAt) {
    response.status = 'scheduled';
    response.scheduledAt = scheduledAt;
    response.job = {
      id: jobId,
      status: 'scheduled',
      platform: 'instagram',
      scheduledAt,
    };
  }

  return HttpResponse.json(response);
}),
```

---

## Badge "Mode Mock"

### Detection

Un `bridgeResult` est considere comme mock quand ses IDs commencent par `"mock-"`:

```typescript
function isMockBridgeResult(bridgeResult: BridgeResultData | null): boolean {
  if (!bridgeResult) return false;
  return (
    bridgeResult.ideaId.startsWith('mock-') ||
    bridgeResult.briefId.startsWith('mock-') ||
    bridgeResult.draftId.startsWith('mock-')
  );
}
```

### Affichage

Un petit badge amber apparait dans le footer de la `PublishSection`:

```typescript
// Dans PublishSection, apres le bouton Publier:
{isMock && (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 'var(--cs-radius-sm)',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#f59e0b',
    fontSize: 'var(--cs-text-xs)',
    fontFamily: 'var(--cs-font-mono)',
  }}>
    <span style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#f59e0b',
      display: 'inline-block',
    }} />
    Mode Mock
  </div>
)}
```

### Modification de PublishSection Props

```typescript
// Ajouter isMock comme prop:
function PublishSection({ draftId, isMock = false }: { draftId: string; isMock?: boolean }) {
  // ...
}

// Dans GenerationResult:
{bridgeResult && (
  <PublishSection
    draftId={bridgeResult.draftId}
    isMock={isMockBridgeResult(bridgeResult)}
  />
)}
```

---

## Design Visuel -- ASCII Mockup

```
+----------------------------------------------------------+
|  Publier                                                 |
|                                                          |
|  +---------------------+  +-----------+                  |
|  | * Publier maintenant |  | Planifier |                  |
|  +---------------------+  +-----------+                  |
|                                                          |
|  [ Publier ]                                             |
|                                                          |
|  +---------------------------------------------------+  |
|  | [green check] Contenu publie avec succes.         |  |
|  +---------------------------------------------------+  |
|                                                          |
|  [o] Mode Mock                                           |
|                                                          |
+----------------------------------------------------------+
```

Le badge "Mode Mock" est discret: petit cercle ambre + texte mono, en bas de la section.

---

## Schedule Mode avec Mock

Quand l'operateur choisit "Planifier" et renseigne une date:

1. Le body POST inclut `{ draftId, mode: 'schedule', scheduledAt: '2026-06-01T10:00:00.000Z' }`
2. Le handler mock retourne `{ status: 'scheduled', scheduledAt, postId, job: { ... } }`
3. Le message de succes existant affiche: "Contenu planifie pour le 01/06/2026 10:00:00"

Le code existant dans PublishSection (lignes 242-246) gere deja cela:
```typescript
setPublishMessage(
  mode === 'now'
    ? 'Contenu publie avec succes.'
    : `Contenu planifie pour le ${new Date(scheduledAt).toLocaleString('fr-FR')}.`,
);
```

---

## Data Flow Complet

```
1. POST /generate retourne:
   { ..., bridgeResult: { ideaId: 'mock-idea-001', ... }, status: 'completed' }

2. handleGenerate() stocke:
   setBridgeResult(data.bridgeResult)  // non-null cette fois

3. GenerationResult recoit bridgeResult:
   <PublishSection draftId={bridgeResult.draftId} isMock={isMockBridgeResult(bridgeResult)} />

4. PublishSection s'affiche avec boutons Publier/Planifier + badge "Mode Mock"

5. Operateur clique Publier:
   POST /publish { draftId: 'mock-draft-001', mode: 'now' }

6. Mock handler retourne:
   { status: 'published', postId: 'mock-post-xxx', draftId: 'mock-draft-001', job: { ... } }

7. PublishSection affiche message de succes (vert)
```

---

## Accessibilite

- Le badge "Mode Mock" a `role="status"` et `aria-label="Publication en mode simulation"`
- Les boutons Publier/Planifier existants gardent leur accessibilite actuelle
- Le message de succes/erreur existant a deja des roles implicites via la structure

---

## Edge Cases

| Cas                                              | Comportement                                           |
|--------------------------------------------------|--------------------------------------------------------|
| bridgeResult est null (pas de mock)              | PublishSection non rendue (comportement existant)      |
| bridgeResult avec IDs non-mock                   | Badge "Mode Mock" non affiche                          |
| Publish retourne erreur 500                      | Message erreur affiche (gestion existante ligne 247)   |
| Publish retourne erreur 409 (deja publie)        | Message erreur "Content already published"             |
| Schedule sans date                               | Bouton desactive (gestion existante ligne 213-215)     |
| Schedule dans le passe                           | Le min du datetime-local empeche cela (ligne 339)      |
| Double-clic sur Publier                          | publishState='publishing' desactive le bouton          |
| bridgeResult present mais draftId vide           | PublishSection rendue mais publish echoue cote backend |
| Apres review approuvee, bridgeResult present     | PublishSection visible avec les IDs de la review       |

---

## Fichiers Impactes

| Fichier | Modification |
|---------|-------------|
| `test/msw/ai-engine-handlers.ts` | IDs mock dans bridgeResult, handler /publish enrichi, MOCK_REVIEW_PAYLOAD + bridgeResult |
| `components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` | PublishSection accepte prop `isMock`, badge "Mode Mock" |
| `app/admin/content-studio-v2/ai-engine/create/page.tsx` | Passer `isMock` basee sur `isMockBridgeResult()` (optionnel, peut etre dans GenerationResult) |
