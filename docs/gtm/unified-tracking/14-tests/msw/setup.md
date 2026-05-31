# Setup MSW (Browser + Node)

## Setup Node (Jest)

```typescript
// apps/web/src/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers/tracking'

export const server = setupServer(...handlers)
```

```typescript
// jest.setup.ts (extension)
import { server } from '@/mocks/server'
import { resetStores } from '@/mocks/fixtures/tracking-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  server.resetHandlers()
  resetStores()
})

afterAll(() => server.close())
```

## Setup Browser (Storybook, manual UI debug)

```typescript
// apps/web/src/mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers/tracking'

export const worker = setupWorker(...handlers)
```

```typescript
// apps/web/.storybook/preview.tsx
import { worker } from '../src/mocks/browser'

if (typeof window !== 'undefined') {
  worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledRequest: 'bypass',
  })
}
```

## Public mockServiceWorker.js

Généré une fois :
```bash
npx msw init public/ --save
```

## Activation conditionnelle en dev (optionnel)

```typescript
// apps/web/src/app/_internal/init-mocks.ts
export async function initMocksIfEnabled() {
  if (process.env.NEXT_PUBLIC_MOCK_API !== 'true') return
  if (typeof window === 'undefined') return
  
  const { worker } = await import('../../mocks/browser')
  await worker.start()
  console.info('[MSW] Mocks actifs (NEXT_PUBLIC_MOCK_API=true)')
}
```

Utilisé dans `apps/web/src/app/layout.tsx` :
```typescript
useEffect(() => { initMocksIfEnabled() }, [])
```

## Setup Playwright (rare cas)

Normalement Playwright frappe la vraie API de test. MSW dans Playwright n'est utilisé que pour quelques scénarios isolés (test offline, erreurs réseau).

```typescript
// e2e/helpers/install-msw.ts
import { Page } from '@playwright/test'

export async function installMockWorker(page: Page) {
  await page.addInitScript({ path: 'apps/web/public/mockServiceWorker.js' })
  // Then in test:
  // await page.evaluate(() => navigator.serviceWorker.ready)
}
```

→ Pour Playwright, préférer `page.route(...)` quand possible (plus simple).

## Override d'un handler dans un test

```typescript
// dans un test Jest
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'

it('handles 500 from /plans', async () => {
  server.use(
    http.get('/api/tracking/plans', () =>
      HttpResponse.json({ error: 'internal' }, { status: 500 })
    )
  )
  
  render(<TrackingPlansList />)
  
  await screen.findByText(/Erreur serveur/)
})
```

## Debug

```typescript
server.events.on('request:start', ({ request }) => {
  console.log('[MSW] →', request.method, request.url)
})

server.events.on('response:mocked', ({ response, request }) => {
  console.log('[MSW] ←', response.status, request.url)
})

server.events.on('request:unhandled', ({ request }) => {
  console.error('[MSW] Unhandled request:', request.url)
})
```
