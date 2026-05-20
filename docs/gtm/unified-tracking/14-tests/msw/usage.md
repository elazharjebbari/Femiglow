# Usage MSW — patterns courants

## 1. Override one-off pour un test

```typescript
it('shows retry button on 500', async () => {
  server.use(
    http.get('/api/tracking/plans', () =>
      HttpResponse.json({ error: 'internal' }, { status: 500 })
    )
  )
  
  render(<TrackingPlansList />)
  expect(await screen.findByRole('button', { name: /Réessayer/ })).toBeInTheDocument()
})
```

L'override est automatiquement réinitialisé par `afterEach(() => server.resetHandlers())`.

## 2. Inspecter ce qui a été envoyé

```typescript
it('sends PATCH with correct body', async () => {
  let capturedBody: any = null
  
  server.use(
    http.patch('/api/tracking/plans/:id', async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ ...capturedBody, id: 'plan-001', version: 2 })
    })
  )
  
  render(<PlanEditor planId="plan-001" />)
  await userEvent.click(screen.getByRole('button', { name: /Enregistrer/ }))
  
  expect(capturedBody).toMatchObject({
    name: expect.any(String),
    version: 1,  // optimistic check
  })
})
```

## 3. Réponses dynamiques selon le body

```typescript
server.use(
  http.post('/api/tracking/plans', async ({ request }) => {
    const body = await request.json() as any
    if (!body.name?.trim()) {
      return HttpResponse.json(
        { error: 'validation_failed', field: 'name' },
        { status: 400 }
      )
    }
    return HttpResponse.json({ ...body, id: 'new-001', version: 1 }, { status: 201 })
  })
)
```

## 4. Simuler latence

```typescript
server.use(
  http.get('/api/tracking/plans', async () => {
    await delay(2_000)  // 2s de délai
    return HttpResponse.json({ data: [], total: 0 })
  })
)
```

Utile pour tester les états loading.

## 5. Erreur réseau (offline)

```typescript
server.use(
  http.get('/api/tracking/plans', () => HttpResponse.error())
)
```

## 6. Réponses en chaîne (1er échec, 2e succès)

```typescript
let calls = 0
server.use(
  http.post('/api/tracking/plans/:id/activate', () => {
    calls++
    if (calls === 1) {
      return HttpResponse.json({ error: 'temporarily_unavailable' }, { status: 503 })
    }
    return HttpResponse.json({ status: 'active' })
  })
)
```

Utile pour tester le retry automatique.

## 7. Tester contre une "vraie" structure de réponse

Les handlers retournent toujours du JSON parsable par les types Zod côté client. Si le contrat change :

1. Mettre à jour le type Zod (`src/lib/tracking/plan/types.ts`).
2. Mettre à jour le handler MSW (`src/mocks/handlers/tracking.ts`).
3. Le test unitaire `validator.test.ts` doit révéler l'incohérence.

## 8. Combiner avec React Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

it('refetches after invalidate', async () => {
  renderWithQuery(<TrackingPlansList />)
  // … le handler par défaut renvoie 1 plan
  expect(await screen.findByText('Production v8')).toBeInTheDocument()
  
  // override pour la prochaine requête
  server.use(
    http.get('/api/tracking/plans', () =>
      HttpResponse.json({ data: [{ id: 'p2', name: 'Nouveau plan', status: 'draft' }] })
    )
  )
  
  await userEvent.click(screen.getByRole('button', { name: /Rafraîchir/ }))
  expect(await screen.findByText('Nouveau plan')).toBeInTheDocument()
})
```

## 9. Pièges à éviter

- ❌ Ne JAMAIS mocker via `jest.mock('@/lib/api/...')` quand on a MSW : c'est doublonner.
- ❌ Oublier `onUnhandledRequest: 'error'` cache les régressions silencieuses.
- ❌ Polluer `plansDb` entre tests sans `resetStores()`.
- ✅ Toujours préférer fixture explicite à random pour traçabilité.
- ✅ Faire matcher l'URL exactement (sans wildcards en prod).
