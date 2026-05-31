# Page Object Model — Playwright

Standardisation des POM pour TOUS les tests E2E. **Aucune** spec ne contient de selector
DOM brut sauf justification explicite (composants 3rd-party).

## 1. Principe

> Le Page Object encapsule la connaissance d'une page (selectors, actions composites). Les
> specs E2E sont en termes de **comportement utilisateur**, pas d'éléments DOM.

```
spec :   await widget.sendMessage('Bonjour');
            └──┬──┘    └─────┬─────┘
              POM         méthode haute niveau

vs.

spec :   await page.locator('textarea[data-testid="composer"]').fill('Bonjour');
         await page.locator('button[aria-label="Envoyer"]').click();
         └─────────────────── implementation details ────────────────┘ ❌
```

## 2. Pattern de base

```typescript
// e2e/pom/chat-widget.pom.ts
import { Page, Locator, expect } from '@playwright/test';

export class ChatWidgetPOM {
  constructor(public readonly page: Page) {}

  // Locators (functions, lazy)
  launcher() { return this.page.getByRole('button', { name: /ouvrir le chat/i }); }
  panel() { return this.page.getByRole('region', { name: /assistant femiglow/i }); }
  closeButton() { return this.page.getByRole('button', { name: /fermer le chat/i }); }
  composer() { return this.page.getByRole('textbox', { name: /votre message/i }); }
  sendButton() { return this.page.getByRole('button', { name: /envoyer/i }); }
  messageList() { return this.page.getByRole('log', { name: /historique/i }); }
  cannedSuggestions() { return this.page.getByRole('list', { name: /suggestions/i }); }
  cannedPill(label: string | RegExp) {
    return this.cannedSuggestions().getByRole('button', { name: label });
  }
  leadFormBubble() { return this.panel().getByRole('form', { name: /vos coordonnées/i }); }

  // Actions composites
  async open() {
    await this.launcher().click();
    await expect(this.panel()).toBeVisible();
  }
  async close() {
    await this.closeButton().click();
    await expect(this.panel()).not.toBeVisible();
  }
  async sendMessage(text: string) {
    await this.composer().fill(text);
    await this.sendButton().click();
  }
  async clickCannedPill(label: string | RegExp) {
    await this.cannedPill(label).click();
  }
  async waitForAssistantReply(opts: { timeout?: number } = {}) {
    // Le dernier message doit être rôle 'assistant' et le panneau ne pas être en état 'streaming'
    await this.page.waitForFunction(
      () => {
        const last = document.querySelectorAll('[role="listitem"][data-role="assistant"]');
        return last.length > 0 && !document.querySelector('[data-streaming="true"]');
      },
      { timeout: opts.timeout ?? 30_000 },
    );
  }
  async lastAssistantMessage() {
    return this.messageList()
      .getByRole('listitem')
      .filter({ has: this.page.locator('[data-role="assistant"]') })
      .last();
  }
  async fillLeadForm({ firstName, phone, consent = true }: { firstName: string; phone: string; consent?: boolean }) {
    const form = this.leadFormBubble();
    await form.getByLabel(/prénom/i).fill(firstName);
    await form.getByLabel(/téléphone/i).fill(phone);
    if (consent) await form.getByLabel(/j'accepte/i).check();
    await form.getByRole('button', { name: /envoyer|me rappeler/i }).click();
  }
}
```

## 3. Catalogue des POM

### 3.1 POM visiteur

| POM | Fichier | Pages couvertes |
|-----|---------|------------------|
| `ChatWidgetPOM` | `chat-widget.pom.ts` | Widget global (launcher + panel) |
| `LeadFormPOM` | `lead-form.pom.ts` | Form bubble + validation |
| `KitPagePOM` | `kit-page.pom.ts` | Page /kit pour contexte |
| `JournalPagePOM` | `journal-page.pom.ts` | Pages article pour test multi-page |

### 3.2 POM admin

| POM | Fichier | Pages couvertes |
|-----|---------|------------------|
| `AdminLoginPOM` | `admin-login.pom.ts` | `/admin/login` |
| `AdminLeadsListPOM` | `admin-leads-list.pom.ts` | `/admin/chat/leads` |
| `AdminLeadDetailPOM` | `admin-lead-detail.pom.ts` | `/admin/chat/leads/[id]` |
| `AdminConversationsListPOM` | `admin-conversations-list.pom.ts` | `/admin/chat/conversations` |
| `AdminConversationDetailPOM` | `admin-conversation-detail.pom.ts` | `/admin/chat/conversations/[id]` |
| `AdminFAQListPOM` | `admin-faq-list.pom.ts` | `/admin/chat/faq` |
| `AdminFAQEditPOM` | `admin-faq-edit.pom.ts` | `/admin/chat/faq/new`, `/[id]` |
| `AdminCannedListPOM` | `admin-canned-list.pom.ts` | `/admin/chat/suggestions` |
| `AdminCannedEditPOM` | `admin-canned-edit.pom.ts` | `/admin/chat/suggestions/new`, `/[id]` |
| `AdminProvidersListPOM` | `admin-providers-list.pom.ts` | `/admin/chat/providers` |
| `AdminProviderEditPOM` | `admin-provider-edit.pom.ts` | `/admin/chat/providers/new`, `/[id]` |
| `AdminInstructionsListPOM` | `admin-instructions-list.pom.ts` | `/admin/chat/instructions` |
| `AdminInstructionEditPOM` | `admin-instruction-edit.pom.ts` | `/admin/chat/instructions/new` |
| `AdminAnalyticsPOM` | `admin-analytics.pom.ts` | `/admin/chat/analytics` |
| `AdminKpisPOM` | `admin-kpis.pom.ts` | `/admin/chat/kpis` |
| `AdminSystemPOM` | `admin-system.pom.ts` | `/admin/chat/system` |
| `AdminCarePOM` | `admin-care.pom.ts` | `/admin/chat/care` |

## 4. Exemple complet — `AdminLeadsListPOM`

```typescript
// e2e/pom/admin-leads-list.pom.ts
import { Page, expect } from '@playwright/test';

export class AdminLeadsListPOM {
  constructor(public readonly page: Page) {}

  async goto() {
    await this.page.goto('/admin/chat/leads');
    await expect(this.page.getByRole('heading', { name: /leads/i })).toBeVisible();
  }

  table() { return this.page.getByRole('table', { name: /liste leads/i }); }
  searchInput() { return this.page.getByRole('searchbox', { name: /rechercher/i }); }
  statusFilter() { return this.page.getByRole('combobox', { name: /statut/i }); }
  dateFilterFrom() { return this.page.getByLabel(/du/i); }
  dateFilterTo() { return this.page.getByLabel(/au/i); }
  exportCsvButton() { return this.page.getByRole('button', { name: /exporter csv/i }); }

  row(phone: string) {
    return this.table().getByRole('row').filter({ hasText: phone });
  }

  async search(query: string) {
    await this.searchInput().fill(query);
    await this.searchInput().press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: 'pending' | 'contacted' | 'converted' | 'dismissed') {
    await this.statusFilter().selectOption(status);
  }

  async openRow(phone: string) {
    await this.row(phone).getByRole('link', { name: /ouvrir|voir/i }).click();
  }

  async setOutcome(phone: string, outcome: 'converted' | 'dismissed') {
    const row = this.row(phone);
    await row.getByRole('combobox', { name: /outcome/i }).selectOption(outcome);
    await this.page.waitForResponse((r) =>
      r.url().includes('/api/admin/chat/leads/') && r.url().endsWith('/outcome'),
    );
  }

  async exportCsv(): Promise<string> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportCsvButton().click(),
    ]);
    const path = await download.path();
    return path ? require('fs').readFileSync(path, 'utf8') : '';
  }

  async expectRowCount(count: number) {
    await expect(this.table().getByRole('row')).toHaveCount(count + 1); // +1 header
  }
}
```

Spec associée :

```typescript
// e2e/admin/chat-admin-leads-outcome.spec.ts
import { test, expect } from '@playwright/test';
import { AdminLeadsListPOM } from '../pom/admin-leads-list.pom';
import { loginAsAdmin } from '../helpers/auth-admin';
import { seedLeads } from '../helpers/seed-leads';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await seedLeads([
    { firstName: 'Leila', phone: '0600123456', status: 'pending' },
    { firstName: 'Yasmine', phone: '0600654321', status: 'contacted' },
  ]);
});

test('admin can update lead outcome and see refreshed status', async ({ page }) => {
  const leads = new AdminLeadsListPOM(page);
  await leads.goto();

  await leads.expectRowCount(2);

  await leads.setOutcome('0600123456', 'converted');

  await expect(leads.row('0600123456')).toContainText(/converti/i);
});
```

## 5. POM — Bonnes pratiques

### 5.1 Locators **lazy** (function), pas eager

```typescript
// ✅ bon — locator construit au moment de l'appel
launcher() { return this.page.getByRole('button', { name: /ouvrir/i }); }

// ❌ mauvais — locator capturé à la construction du POM
constructor(public page: Page) {
  this.launcher = page.getByRole('button', { name: /ouvrir/i }); // peut être stale
}
```

### 5.2 Actions composites encapsulent l'attente

```typescript
// ✅ bon
async open() {
  await this.launcher().click();
  await expect(this.panel()).toBeVisible();  // attente intégrée
}

// ❌ mauvais
async open() {
  await this.launcher().click();  // race condition côté caller
}
```

### 5.3 Pas de logique métier dans le POM

Le POM **n'interprète pas** : il **expose**. La logique d'assertion reste dans la spec :

```typescript
// ✅ dans la spec
expect(await leads.row('0600123456').textContent()).toContain('converti');

// ❌ dans le POM
async isLeadConverted(phone: string) {
  const txt = await this.row(phone).textContent();
  return txt?.includes('converti') ?? false; // = logique de spec
}
```

Exception : helpers de récupération typés (`async getLastMessageText(): Promise<string>`).

### 5.4 Multi-locale support

```typescript
class ChatWidgetPOM {
  launcher() {
    return this.page.getByRole('button', {
      name: this.page.locator('[data-locale="ar-MA"]').isVisible() ? /افتح/ : /ouvrir/i,
    });
  }
}
```

Ou plus simple — utiliser des `data-test-id` stable par locale (compromis acceptable pour
les selectors qui changent radicalement entre langues).

## 6. Tests des POM (méta)

Les POM eux-mêmes doivent avoir des smoke tests :

```typescript
// e2e/pom/chat-widget.pom.spec.ts (rare, optionnel)
test.describe('ChatWidgetPOM smoke', () => {
  test('all locators resolve on a freshly loaded page', async ({ page }) => {
    await page.goto('/kit');
    const w = new ChatWidgetPOM(page);
    await expect(w.launcher()).toBeVisible();
    await w.open();
    await expect(w.composer()).toBeVisible();
    await expect(w.sendButton()).toBeVisible();
  });
});
```

## 7. Helpers transverses

```
e2e/helpers/
├── auth-admin.ts         // login admin via API (raccourcis pour beforeEach)
├── seed-conversation.ts  // crée une session+messages via Drizzle direct
├── seed-leads.ts
├── reset-db.ts           // TRUNCATE entre tests si nécessaire
├── network-throttle.ts   // throttle 4G slow/fast
├── wait-for-stream.ts    // wait que /api/chat/message SSE ait reçu end
├── intercept-webhook.ts  // capture POST sur lead-webhook
└── locale-switch.ts      // change locale via cookie/header
```

## 8. Versioning POM

- **Stable name policy** : un POM ne change pas de nom de méthode sans deprecation period
- **Major change** = breaking → mise à jour de toutes les specs en même temps (PR atomique)
- **Owner** : un référent par POM, listé dans le header du fichier
