# 08 — Stratégie de tests

> Comment on **valide** que le système emailing fonctionne, ne régresse pas, et reste maintenable. Trois étages : **Jest** (unit + integration React), **MSW** (mock API Listmonk + webhook Stalwart pour stories isolées), **Playwright** (E2E + flux user complets). Scénarios atomiques **par composant** et **par flux**.

## §1 — Philosophie

| Niveau | Lib | But | Coût | Couverture |
|---|---|---|---|---|
| Unit | Jest + RTL | Logique pure, schemas Zod, composants isolés | très rapide (< 50 ms / test) | toutes fonctions critiques (mailer, validations, parsers webhooks) |
| Integration UI | Jest + RTL + MSW | Composants montés avec API mockée | rapide (< 300 ms / test) | tous les composants Admin emails |
| Component visual | Playwright (mode component) | Screenshot par composant | moyen | StatusBadge, KpiTile, TemplatePreview, CampaignCard |
| E2E flow | Playwright | Flux user complets, navigation, formulaires | lent (5-30 s / test) | wizard happy + edge, transactional, suppression mgmt |
| Visual regression | Playwright screenshots | Detect change visuel inattendu | moyen | 5 pages clés + 3 templates rendus |
| Accessibility | jest-axe + Playwright AxeBuilder | 0 violation A11y | léger | toutes les pages admin emails |
| Webhook contract | Jest contract test | Payload conforme entre Stalwart/Listmonk et FemiGlow | léger | parsers stalwart/listmonk |

**Règle d'or** : aucun chemin critique sans test E2E. Aucun composant exporté sans test Jest. Aucun endpoint sans test integration + contract.

## §2 — Setup

### 2.1 — Dépendances à ajouter

```json
{
  "devDependencies": {
    "msw": "^2.5.0",
    "@playwright/test": "^1.50.0",
    "@react-email/render": "^1.0.0",
    "jest-axe": "^9.0.0",
    "@axe-core/playwright": "^4.10.0"
  }
}
```

### 2.2 — Structure

```
apps/web/
├── src/test/
│   ├── setup.ts                      ← jest setup (déjà existant)
│   ├── msw/
│   │   ├── server.ts                 ← MSW server (Node) pour Jest
│   │   ├── browser.ts                ← MSW worker (browser) pour dev
│   │   ├── handlers/
│   │   │   ├── listmonk.ts           ← mock API Listmonk
│   │   │   ├── stalwart-webhook.ts   ← mock webhook delivery/bounce
│   │   │   ├── smtp.ts               ← mock nodemailer (via stub)
│   │   │   └── admin-emails.ts       ← endpoints /api/admin/emails/*
│   │   └── fixtures/
│   │       ├── lists.ts
│   │       ├── subscribers.ts
│   │       ├── campaigns.ts
│   │       └── templates.ts
│   ├── playwright/
│   │   ├── playwright.config.ts
│   │   ├── fixtures/
│   │   │   ├── auth.ts               ← login admin
│   │   │   └── seed.ts               ← seed DB état stable
│   │   ├── pages/                    ← Page Object Model
│   │   │   ├── EmailsDashboardPage.ts
│   │   │   ├── WizardPage.ts
│   │   │   ├── OutboxPage.ts
│   │   │   └── TemplateStudioPage.ts
│   │   └── specs/
│   │       ├── wizard.spec.ts
│   │       ├── transactional.spec.ts
│   │       ├── suppression.spec.ts
│   │       ├── templates.spec.ts
│   │       └── infra.spec.ts          ← health checks bout-en-bout
│   └── unit/
│       ├── mail/
│       │   ├── render.test.ts
│       │   ├── catalog.test.ts
│       │   ├── outbox.test.ts
│       │   ├── backoff.test.ts
│       │   ├── webhooks/
│       │   │   ├── stalwart-parser.test.ts
│       │   │   └── listmonk-parser.test.ts
│       │   └── listmonk/
│       │       └── client.test.ts
│       └── components/
│           └── admin/emails/
│               ├── StatusBadge.test.tsx
│               ├── KpiTile.test.tsx
│               ├── OutboxTable.test.tsx
│               ├── CampaignCard.test.tsx
│               ├── AudienceSelector.test.tsx
│               ├── TemplatePreview.test.tsx
│               ├── SubjectComposer.test.tsx
│               └── wizard/
│                   ├── CampaignWizard.test.tsx
│                   ├── StepType.test.tsx
│                   ├── StepAudience.test.tsx
│                   ├── StepTemplate.test.tsx
│                   ├── StepCompose.test.tsx
│                   ├── StepSchedule.test.tsx
│                   └── StepReview.test.tsx
```

### 2.3 — MSW server

`apps/web/src/test/msw/server.ts` :

```ts
import { setupServer } from 'msw/node';
import { listmonkHandlers } from './handlers/listmonk';
import { stalwartWebhookHandlers } from './handlers/stalwart-webhook';
import { adminEmailsHandlers } from './handlers/admin-emails';

export const server = setupServer(
  ...listmonkHandlers,
  ...stalwartWebhookHandlers,
  ...adminEmailsHandlers,
);
```

`apps/web/src/test/setup.ts` (extension) :

```ts
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 2.4 — MSW handlers — exemple Listmonk

`apps/web/src/test/msw/handlers/listmonk.ts` :

```ts
import { http, HttpResponse } from 'msw';
import { listsFixture, subscribersFixture, campaignsFixture, templatesFixture } from '../fixtures';

const BASE = 'http://127.0.0.1:9000';

export const listmonkHandlers = [
  http.get(`${BASE}/api/lists`, () => HttpResponse.json({ data: { results: listsFixture } })),
  http.post(`${BASE}/api/lists`, async ({ request }) => {
    const body = await request.json();
    const created = { id: Math.floor(Math.random() * 10000), ...body };
    return HttpResponse.json({ data: created }, { status: 201 });
  }),
  http.get(`${BASE}/api/subscribers`, () => HttpResponse.json({ data: { results: subscribersFixture } })),
  http.post(`${BASE}/api/subscribers`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { id: 99, ...body } }, { status: 201 });
  }),
  http.put(`${BASE}/api/subscribers/blocklist`, () => HttpResponse.json({ data: { count: 1 } })),
  http.get(`${BASE}/api/templates`, () => HttpResponse.json({ data: templatesFixture })),
  http.post(`${BASE}/api/templates`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { id: 42, ...body } }, { status: 201 });
  }),
  http.get(`${BASE}/api/campaigns`, () => HttpResponse.json({ data: { results: campaignsFixture } })),
  http.post(`${BASE}/api/campaigns`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { id: 7, status: 'draft', ...body } }, { status: 201 });
  }),
  http.put(`${BASE}/api/campaigns/:id/status`, () => HttpResponse.json({ data: { status: 'scheduled' } })),
  http.post(`${BASE}/api/tx`, () => HttpResponse.json({ data: { message: 'queued' } })),
];
```

### 2.5 — MSW handlers — Stalwart webhook (events entrants vers FemiGlow)

`apps/web/src/test/msw/handlers/stalwart-webhook.ts` :

```ts
import { http, HttpResponse } from 'msw';

export const stalwartWebhookHandlers = [
  // Pour les tests qui simulent un POST entrant vers /api/mail/webhook/stalwart,
  // on appelle directement le handler Next.js dans le test (pas MSW).
  // Ces handlers servent uniquement si on simule des outbound calls Stalwart admin
  // (ex. tests E2E avec stalwart-cli mock).
];
```

### 2.6 — Fixtures stables

`apps/web/src/test/msw/fixtures/lists.ts` :

```ts
export const listsFixture = [
  { id: 1, name: 'Newsletter',         type: 'public',  optin: 'double', subscriber_count: 3247 },
  { id: 2, name: 'Clientes premium',   type: 'private', optin: 'single', subscriber_count: 412 },
  { id: 3, name: 'Esthéticiennes pro', type: 'private', optin: 'double', subscriber_count: 89 },
  { id: 4, name: 'Promo printemps',    type: 'private', optin: 'single', subscriber_count: 1240 },
];
```

## §3 — Tests Jest unit & integration

### 3.1 — Patterns

```ts
// describe par composant, it par scénario
describe('StatusBadge', () => {
  it('renders "Livré" with emerald color for status=delivered', () => {
    render(<StatusBadge status="delivered" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Livré');
    expect(badge).toHaveClass('text-emerald-700');
  });

  it('shows tooltip with detail on hover', async () => {
    const user = userEvent.setup();
    render(<StatusBadge status="failed" detail="SMTP 550 not found" />);
    await user.hover(screen.getByRole('status'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('SMTP 550 not found');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<StatusBadge status="delivered" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

### 3.2 — Couverture par fichier

> Reproduit ici en compact ; chaque ligne devient un fichier `.test.tsx` avec 5-15 it() blocks.

#### Mail core (`lib/mail/`)

| Fichier test | Couvre |
|---|---|
| `render.test.ts` | Render templates valides ; rejet payload invalide ; subject généré ; text non vide ; HTML inclut tokens brand |
| `catalog.test.ts` | Tous les templates ont schema + sampleData ; sampleData passe schema ; version > 0 ; unique slug |
| `outbox.test.ts` | `pickAndProcessBatch` claim atomique ; respecte `max_attempts` ; calcule next_retry ; dispatche `dlq` quand max atteint |
| `backoff.test.ts` | Backoff exponentiel correct ; jitter dans bornes ; plafond 1h |
| `webhooks/stalwart-parser.test.ts` | Parse `message.delivered`, `message.delivery-failed`, `message.delivery-deferred`, `auth.failure` ; refuse payload invalide |
| `webhooks/listmonk-parser.test.ts` | Parse `subscriber.created`, `unsubscribed`, `campaign.metrics` ; signature HMAC valide ; refuse signature invalide |
| `listmonk/client.test.ts` | Tous les endpoints mockés répondent ; gère 4xx avec `ListmonkApiError` ; respect du timeout |
| `suppression.test.ts` | `isSuppressed(email)` retourne bool ; INSERT idempotent via onConflictDoNothing |
| `variables.test.ts` | `toListmonkPlaceholders` transforme correctement les 5 placeholders connus |
| `send.test.ts` | sendTransactional refuse adresse suppression ; respecte idempotency ; INSERT outbox ; lance attempt immédiat |

#### Composants UI (`components/admin/emails/`)

| Fichier test | Scénarios atomiques |
|---|---|
| `StatusBadge.test.tsx` | render 13 statuts ; tooltip ; a11y |
| `KpiTile.test.tsx` | render valeur + delta ; sign coloration ; tooltip ; skeleton state |
| `OutboxTable.test.tsx` | render rows ; tri colonnes ; filtres ; retry click ; empty ; loading ; pagination |
| `CampaignCard.test.tsx` | render draft / scheduled / sent variants ; click ouvre détail ; menu kebab |
| `AudienceSelector.test.tsx` | render lists ; search filter ; multi-select ; estimate update ; create new list ; listmonk down |
| `TemplatePreview.test.tsx` | render iframe sandboxé ; toggle desktop/mobile ; refresh button ; erreur render → fallback ; a11y title |
| `SubjectComposer.test.tsx` | counter ; emoji warning ; insert variable au curseur ; preview update |
| `MetricBadge.test.tsx` | render valeur + pourcentage ; format français (espaces fines) |
| `BouncesPanel.test.tsx` | render rows ; actions (block/retry) ; empty |
| `SuppressionList.test.tsx` | render rows ; suppression manuelle ; confirmation modal |
| `EmailsHealthBadge.test.tsx` | 3 états (ok/dégradé/incident) ; tooltip détail ; refresh |
| `ListmonkFrame.test.tsx` | iframe rendu avec sandbox ; postMessage navigate écouté |

#### Wizard (`components/admin/emails/wizard/`)

Tous documentés en détail dans `06-wizard-specification.md` §3-8. Compilation rapide :

| Step | Test file | Scénarios |
|---|---|---|
| 1 Type | `StepType.test.tsx` | 11 scénarios (cf. §3.6) |
| 2 Audience | `StepAudience.test.tsx` | 11 scénarios (cf. §4.5) |
| 3 Template | `StepTemplate.test.tsx` | 7 scénarios (cf. §5.5) |
| 4 Compose | `StepCompose.test.tsx` | 13 scénarios (cf. §6.5) |
| 5 Schedule | `StepSchedule.test.tsx` | 7 scénarios (cf. §7.5) |
| 6 Review | `StepReview.test.tsx` | 11 scénarios (cf. §8.5) |
| Wizard global | `CampaignWizard.test.tsx` | nav prev/next, persistence draft, keyboard shortcuts, beforeunload, init from URL |

### 3.3 — Hooks

| Fichier test | Couvre |
|---|---|
| `useCampaignWizard.test.ts` | reducer transitions ; auto-save debounced ; goNext bloqué si invalid ; goPrev libre ; persistence URL |
| `useEmailFilters.test.ts` | sync URL ↔ state ; localStorage fallback ; reset |
| `useOutboxRow.test.ts` | optimistic retry ; rollback on error |

### 3.4 — Server actions

| Fichier test | Couvre |
|---|---|
| `wizard-actions.test.ts` | createDraft idempotent ; saveCampaignDraft partial update ; estimateAudience exclu suppression ; finalizeCampaign syncs Listmonk |
| `outbox-actions.test.ts` | retryOutboxAction reset status ; audit log écrit |
| `template-actions.test.ts` | testSendAction validation recipient ; rate limit per user |

## §4 — Tests integration API (Jest + MSW)

Pour chaque endpoint `/api/admin/emails/*` et chaque webhook `/api/mail/webhook/*`, tester :

```ts
describe('POST /api/mail/webhook/stalwart', () => {
  it('updates outbox status to delivered on message.delivered', async () => {
    await seedOutbox({ id: 'OB1', smtpMessageId: '<msg-1@x>', status: 'sent' });

    const req = new Request('http://x/api/mail/webhook/stalwart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({
        event: 'message.delivered',
        messageId: '<msg-1@x>',
        queueId: '123',
        rcpt: 'a@b.c',
        ts: '2026-05-13T16:00:00Z',
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const row = await db.select().from(emailOutbox).where(eq(emailOutbox.id, 'OB1'));
    expect(row[0].status).toBe('delivered');

    const events = await db.select().from(emailEvent).where(eq(emailEvent.outboxId, 'OB1'));
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('delivered');
  });

  it('rejects payload with wrong Authorization', async () => {
    const req = new Request('http://x/api/mail/webhook/stalwart', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
      body: JSON.stringify({ event: 'message.delivered' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('inserts suppression on hard bounce (5xx)', async () => { /* … */ });
  it('does NOT insert suppression on soft bounce (4xx)', async () => { /* … */ });
  it('ignores unknown messageId without throwing', async () => { /* … */ });
});
```

Liste exhaustive des endpoints à couvrir :

| Endpoint | Méthodes | Tests |
|---|---|---|
| `/api/admin/emails/audience/estimate` | POST | counts correct, exclude suppression, multi-list dedup |
| `/api/admin/emails/campaigns` | POST, GET | create draft, list filter status |
| `/api/admin/emails/campaigns/:id/draft` | PUT | partial update, optimistic locking |
| `/api/admin/emails/campaigns/:id/test-send` | POST | send via Stalwart mock, rate limit, suppression block |
| `/api/admin/emails/campaigns/:id/conformity` | GET | report shape, DKIM/SPF/DMARC checks |
| `/api/admin/emails/campaigns/:id/finalize` | POST | idempotency, Listmonk sync, status transition |
| `/api/admin/emails/templates` | GET | list + filter category |
| `/api/admin/emails/templates/:slug/preview` | POST | render HTML returned |
| `/api/admin/emails/templates/:slug/test-send` | POST | send mock, audit log written |
| `/api/admin/emails/outbox` | GET | filtre period/status/template ; pagination |
| `/api/admin/emails/outbox/:id` | GET | détail + events ; non-admin → 403 |
| `/api/admin/emails/outbox/:id/retry` | POST | reset status, audit log |
| `/api/admin/emails/stats/daily` | GET | depuis matview, format chartable |
| `/api/admin/emails/smtp/test` | POST | verify() success/failure |
| `/api/listmonk/[...path]` | tous | proxy passthrough auth, headers Forwarded-User |
| `/api/mail/webhook/stalwart` | POST | 5 events, auth, Zod, idempotency |
| `/api/mail/webhook/listmonk` | POST | HMAC, 4 events, idempotency |
| `/api/mail/transactional/send` | POST | API interne (cron, auto), validation |
| `/api/cron/email-outbox` | POST | auth cron secret, batch processing |

## §5 — Tests templates (snapshot + render)

```ts
// apps/web/src/test/unit/mail/templates.test.ts
import { TEMPLATE_REGISTRY } from '@/lib/mail/catalog';
import { renderTemplate } from '@/lib/mail/render';

describe('All registered templates', () => {
  Object.entries(TEMPLATE_REGISTRY).forEach(([slug, meta]) => {
    describe(`Template ${slug}`, () => {
      it('renders with sampleData without throwing', async () => {
        const { html, text, subject } = await renderTemplate(slug as any, meta.sampleData);
        expect(html).toBeTruthy();
        expect(text).toBeTruthy();
        expect(subject).toBeTruthy();
      });

      it('schema validates sampleData', () => {
        expect(() => meta.schema.parse(meta.sampleData)).not.toThrow();
      });

      it('subject is < 140 chars', () => {
        const subject = meta.subjectFn(meta.sampleData);
        expect(subject.length).toBeLessThan(140);
      });

      it('html contains opt-out / unsubscribe placeholder for broadcasts', async () => {
        if (meta.category !== 'broadcast') return;
        const { html } = await renderTemplate(slug as any, meta.sampleData);
        expect(html).toMatch(/se désabonner|unsubscribe/i);
      });

      it('matches snapshot', async () => {
        const { html } = await renderTemplate(slug as any, meta.sampleData);
        expect(html).toMatchSnapshot();
      });
    });
  });
});
```

## §6 — Tests E2E Playwright

### 6.1 — Configuration

`apps/web/playwright.config.ts` (étendre l'existant) :

```ts
projects: [
  // … existing
  {
    name: 'emails-chromium',
    use: { ...devices['Desktop Chrome'], baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' },
    testDir: './src/test/playwright/specs',
    testMatch: /\.spec\.ts$/,
  },
],
```

### 6.2 — Page Object Model — `WizardPage.ts`

```ts
import { Page, expect } from '@playwright/test';

export class WizardPage {
  constructor(private page: Page) {}

  async start() {
    await this.page.goto('/admin/emails/campaigns/new');
    await expect(this.page.getByRole('heading', { name: /Étape 1/i })).toBeVisible();
  }

  async fillTypeStep(type: 'regular' | 'ab_test', name: string) {
    await this.page.getByRole('radio', { name: type === 'regular' ? /Campagne classique/i : /Test A\/B/i }).click();
    await this.page.getByLabel(/Nom interne/i).fill(name);
    await this.page.getByRole('button', { name: /Suivant/i }).click();
  }

  async fillAudienceStep(listNames: string[]) {
    for (const n of listNames) {
      await this.page.getByLabel(n).check();
    }
    await this.page.getByRole('button', { name: /Suivant/i }).click();
  }

  async fillTemplateStep(templateSlug: string) {
    await this.page.getByTestId(`template-card-${templateSlug}`).click();
    await this.page.getByRole('button', { name: /Suivant/i }).click();
  }

  // … fillComposeStep, fillScheduleStep, finalizeStep
}
```

### 6.3 — Specs exhaustifs

#### `wizard.spec.ts` — flux happy path et edge

```ts
import { test, expect } from '@playwright/test';
import { WizardPage } from '../pages/WizardPage';
import { loginAsAdmin, seedDb } from '../fixtures';

test.describe('Campaign wizard', () => {
  test.beforeEach(async ({ page }) => {
    await seedDb({ lists: 4, templates: 3 });
    await loginAsAdmin(page);
  });

  test('happy path: create draft, fill all steps, schedule and verify', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'E2E test campaign');
    await w.fillAudienceStep(['Newsletter']);
    await w.fillTemplateStep('spring-welcome');
    await w.fillComposeStep({
      subject: '✨ E2E test subject',
      preheader: 'Test preheader',
      variables: { discount_code: 'TEST10' },
    });
    await w.fillScheduleStep({ mode: 'scheduled', date: '2026-12-31', time: '09:00' });
    await w.finalizeStep();
    await expect(page).toHaveURL(/\/admin\/emails\/campaigns\/[a-z0-9]+$/i);
    await expect(page.getByRole('status', { name: /Planifié/i })).toBeVisible();
  });

  test('persists draft on browser refresh', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'Refresh test');
    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByLabel(/Nom interne/i)).toHaveValue('Refresh test');
  });

  test('beforeunload warns when dirty', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await page.getByLabel(/Nom interne/i).fill('dirty');
    page.on('dialog', dialog => dialog.dismiss());
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  });

  test('keyboard shortcuts: Ctrl+S saves, Ctrl+Arrow navigates', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'Kbd test');
    await page.keyboard.press('Control+ArrowLeft');
    await expect(page.getByRole('heading', { name: /Étape 1/i })).toBeVisible();
  });

  test('exit & keep produces draft visible in list', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'Saved draft');
    await page.getByRole('button', { name: /Quitter & garder/i }).click();
    await expect(page).toHaveURL('/admin/emails/campaigns');
    await expect(page.getByText('Saved draft')).toBeVisible();
  });

  test('cannot proceed with invalid audience step', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'Bad audience');
    // Skip audience selection
    await expect(page.getByRole('button', { name: /Suivant/i })).toBeDisabled();
  });

  test('shows estimate update when toggling lists', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'Estimate test');
    await page.getByLabel('Newsletter').check();
    await expect(page.getByText(/Envois estimés/i)).toBeVisible();
    await expect(page.getByText(/3 235/)).toBeVisible({ timeout: 2000 });
  });

  test('test-send works from compose step', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'Test send');
    await w.fillAudienceStep(['Newsletter']);
    await w.fillTemplateStep('spring-welcome');
    await page.getByLabel(/Envoyer test à/i).fill('me@example.com');
    await page.getByRole('button', { name: /Envoyer test/i }).click();
    await expect(page.getByRole('status', { name: /Envoyé à me@example.com/i })).toBeVisible();
  });

  test('conformity check blocks finalize on DKIM fail', async ({ page, context }) => {
    // Stub conformity endpoint to return DKIM fail
    await page.route('**/api/admin/emails/campaigns/*/conformity', route =>
      route.fulfill({ json: { dkim: false, spf: true, dmarc: true, optin: true } }),
    );
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('regular', 'Conformity test');
    await w.fillAudienceStep(['Newsletter']);
    await w.fillTemplateStep('spring-welcome');
    await w.fillComposeStep({ subject: 'Subj', preheader: 'Pre' });
    await w.fillScheduleStep({ mode: 'now' });
    await expect(page.getByText(/DKIM/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Planifier l'envoi|Envoyer/i })).toBeDisabled();
  });

  test('A/B variant adds step 4.5', async ({ page }) => {
    const w = new WizardPage(page);
    await w.start();
    await w.fillTypeStep('ab_test', 'A/B test');
    await w.fillAudienceStep(['Newsletter']);
    await w.fillTemplateStep('spring-welcome');
    await w.fillComposeStep({ subject: 'A', preheader: 'preA' });
    await expect(page.getByRole('heading', { name: /Variante B/i })).toBeVisible();
  });

  test('a11y: no axe violations on each step', async ({ page }) => {
    const { AxeBuilder } = await import('@axe-core/playwright');
    const w = new WizardPage(page);
    await w.start();
    for (const step of ['type', 'audience', 'template', 'compose', 'schedule', 'review']) {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      // … advance step
    }
  });
});
```

#### `transactional.spec.ts`

```ts
test('outbox list filters by status and date', async ({ page }) => { /* … */ });
test('retry button enqueues outbox and toast confirms', async ({ page }) => { /* … */ });
test('detail page shows preview iframe + timeline', async ({ page }) => { /* … */ });
test('bounce hard suppressed appears in suppression list', async ({ page }) => { /* … */ });
```

#### `suppression.spec.ts`

```ts
test('manual add to suppression list works', async ({ page }) => { /* … */ });
test('cannot send to suppressed address', async ({ page }) => { /* … */ });
test('remove from suppression list requires confirmation', async ({ page }) => { /* … */ });
```

#### `templates.spec.ts`

```ts
test('studio lists templates with thumbnails', async ({ page }) => { /* … */ });
test('preview renders with sample data', async ({ page }) => { /* … */ });
test('test-send works from studio', async ({ page }) => { /* … */ });
```

#### `infra.spec.ts` — santé end-to-end

```ts
test('SMTP test from settings works', async ({ page }) => { /* … */ });
test('Listmonk iframe loads in less than 2s', async ({ page }) => { /* … */ });
test('webhook endpoint accepts a delivered event', async ({ request }) => {
  const res = await request.post('/api/mail/webhook/stalwart', {
    headers: { Authorization: `Bearer ${process.env.FEMIGLOW_STALWART_WEBHOOK_SECRET}` },
    data: { event: 'message.delivered', messageId: '<test@x>', queueId: '1', rcpt: 'a@b.c', ts: new Date().toISOString() },
  });
  expect(res.status()).toBe(200);
});
```

## §7 — Tests visuels (regression)

```ts
// playwright/specs/visual.spec.ts
test.describe('Visual snapshots', () => {
  test('Dashboard emails @desktop', async ({ page }) => {
    await page.goto('/admin/emails');
    await expect(page).toHaveScreenshot('dashboard.png', { maxDiffPixels: 100 });
  });

  test('Wizard step 1 @desktop', async ({ page }) => {
    await page.goto('/admin/emails/campaigns/new');
    await expect(page).toHaveScreenshot('wizard-step1.png');
  });

  test('Template preview - spring-welcome', async ({ page }) => {
    await page.goto('/admin/emails/templates/spring-welcome');
    const iframe = page.frameLocator('[data-testid="template-preview-iframe"]');
    await expect(page.locator('[data-testid="template-preview-iframe"]')).toHaveScreenshot('tpl-spring-welcome.png');
  });
});
```

## §8 — Contract tests (Stalwart / Listmonk schemas)

```ts
// Pour s'assurer que les schemas Zod parsent les payloads RÉELS des versions Stalwart/Listmonk en prod
describe('Contract: Stalwart webhook payloads', () => {
  it('parses delivered payload from Stalwart v0.16', () => {
    const fixture = require('./fixtures/stalwart-delivered.v0.16.json');
    expect(() => stalwartWebhookSchema.parse(fixture)).not.toThrow();
  });
  it('parses failed payload', () => { /* … */ });
});
```

Fixtures à capturer en stagiing avec `tcpdump` ou `stalwart-cli` quand on aura un envoi réel — documenté dans le runbook.

## §9 — Coverage targets

| Étage | Cible | Tooling |
|---|---|---|
| Statements coverage | ≥ 80 % global, ≥ 90 % sur `lib/mail/` | `jest --coverage` |
| E2E flow coverage | 100 % des chemins critiques (wizard happy, retry, suppression) | manuel + checklist |
| Visual regression | 5 pages + 3 templates ; review humain sur diff | Playwright + CI artifact |
| A11y | 0 violation axe sur 6 pages clés | jest-axe + Playwright AxeBuilder |
| Mutation testing | Optionnel : Stryker sur `lib/mail/render.ts`, `outbox.ts`, `webhooks/*` | manuel ponctuel |

## §10 — CI integration

`.github/workflows/test.yml` (étendre l'existant) :

```yaml
jobs:
  test:
    steps:
      - run: pnpm install
      - run: pnpm test:unit -- --coverage
      - run: pnpm test:integration
      - run: pnpm test:e2e --project=emails-chromium
      - uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/ }
```

Garde-fous CI :
- Tests `lib/mail/` doivent passer (bloquant).
- E2E peuvent flaky sur Listmonk iframe → 2 retries auto.
- Visual regression : diff > 100 px bloquant, attente review humaine.

## §11 — Patterns à éviter

- ❌ Mocker `nodemailer` au niveau global — préférer un transport `jest-mock` réinjecté via `getTransporter`.
- ❌ Tests qui dépendent de timing réel (`setTimeout(2000)`) — utiliser `jest.useFakeTimers()`.
- ❌ Tests qui parlent à la vraie DB Postgres locale du dev — utiliser une DB de test (testcontainers ou pg-mem).
- ❌ Snapshot inline géant sur HTML render — préférer `toMatchSnapshot()` fichier séparé.
- ❌ Réutiliser le même `idempotency_key` entre tests — toujours `${test.id}-${Date.now()}`.

## §12 — Maintenance & flakiness

- Test E2E flaky > 3 fois en 7 jours → quarantine + ticket Linear.
- Visual diff faux positif → updater snapshot après review : `pnpm playwright test --update-snapshots`.
- MSW handlers obsolètes (Listmonk a changé l'API) → contract test bloque le merge → mise à jour fixtures.
- Couverture descend < 80 % → CI bloque.

## §13 — Références

- Pattern existant tests admin : `apps/web/src/test/`
- MSW docs : https://mswjs.io/docs/
- Playwright docs : https://playwright.dev/docs/
- jest-axe : https://github.com/nickcolley/jest-axe
- Liste exhaustive scénarios wizard : `06-wizard-specification.md` §3-8
