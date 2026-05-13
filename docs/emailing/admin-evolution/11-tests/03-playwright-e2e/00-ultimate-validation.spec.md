# Test ultime global — validation finale M5 complète

> File: `apps/web/e2e/m5-ultimate.spec.ts`
> Le test final qui valide TOUT le système end-to-end. Doit passer
> avant déclaration "M5 done".

## Scénario

Un admin réalise un parcours complet :

```
1. Se connecte
2. Crée une audience "Test VIP"
3. Vérifie le preview en live
4. Snapshot manuel l'audience
5. Crée une automation "Welcome flow test"
   - Trigger: lead.created
   - Audience filter: la précédente
   - Step 1: wait 10s
   - Step 2: send template welcome
   - Step 3: branch on opened
6. Active l'automation
7. Crée un lead (via la public API ou direct DB)
8. Attend 10s + ~30s pour cron tick
9. Vérifie sur la page transactional :
   - Email welcome envoyé
   - Recherche via Cmd-K l'email
   - Cliquer sur le détail
10. Vérifie sur la page automation runs :
    - Run created
    - Step 1 done
    - Step 2 done (outbox link visible)
    - Step 3 waiting_for_event
11. Simule un open event sur l'email
12. Re-tick automation
13. Vérifie : run advanced step 3.yes branch
14. Clean up : delete audience, delete automation
```

## Implémentation Playwright

```typescript
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('M5 — ultimate end-to-end', async ({ page, request }) => {
  test.setTimeout(120_000);  // 2min max

  // === 1. Already authenticated via storage state ===
  await page.goto('/admin/emails');
  await expect(page.getByRole('heading', { name: /emails/i }).first()).toBeVisible();

  // === 2. Create audience ===
  await page.goto('/admin/emails/audiences/new');
  await page.fill('input[name="name"]', 'Test VIP');
  await page.click('button:has-text("Continuer")');
  
  // Step 2 — rules
  await page.click('button:has-text("Ajouter un critère")');
  await page.click('text=Nombre de commandes');
  await page.selectOption('select[name="operator"]', 'gte');
  await page.fill('input[name="value"]', '1');
  
  // === 3. Preview live ===
  await expect(page.locator('text=/\\d+ contacts/')).toBeVisible({ timeout: 5_000 });
  
  await page.click('button:has-text("Continuer")');
  await page.click('button:has-text("Créer l\'audience")');
  
  // Detail page
  await expect(page).toHaveURL(/\/audiences\/[a-f0-9-]+$/);
  
  // === 4. Snapshot ===
  await page.click('button:has-text("Snapshot maintenant")');
  await expect(page.locator('text=Snapshot terminé')).toBeVisible({ timeout: 30_000 });
  
  // === 5. Create automation ===
  await page.goto('/admin/emails/automation/new');
  await page.fill('input[name="name"]', 'Welcome flow test');
  await page.click('button:has-text("Continuer")');
  
  // Trigger
  await page.click('text=Événement');
  await page.click('[data-testid="event-picker"]');
  await page.click('text=lead.created');
  await page.click('button:has-text("Continuer")');
  
  // Steps
  await page.click('button:has-text("Ajouter une étape")');
  await page.click('text=Wait');
  await page.fill('input[name="duration"]', '10s');
  // ... (autres steps)
  
  await page.click('button:has-text("Activer + Créer")');
  
  // === 6-7. Auto active. Trigger via direct DB insert ===
  // (utiliser API ou drizzle directe pour simuler lead.created)
  await request.post('/api/__test__/trigger-lead-created', {
    data: { email: 'test-ultimate@example.com' },
  });
  
  // === 8. Wait for cron tick ===
  await page.waitForTimeout(35_000);
  
  // === 9. Verify email sent ===
  await page.goto('/admin/emails/transactional');
  await page.keyboard.press('Meta+K');
  await page.fill('[role="combobox"]', 'to:test-ultimate@example.com');
  await page.keyboard.press('Enter');
  await expect(page.locator('text=welcome')).toBeVisible({ timeout: 5_000 });
  
  // === 10. Verify run state ===
  await page.goto('/admin/emails/automation');
  await page.click('text=Welcome flow test');
  await expect(page.locator('text=running')).toBeVisible();
  await page.click('text=test-ultimate@example.com');
  await expect(page.locator('text=Step 1 done')).toBeVisible();
  
  // === 11-13. Simulate opened event ===
  await request.post('/api/__test__/simulate-event', {
    data: { email: 'test-ultimate@example.com', event_name: 'email.opened' },
  });
  await page.waitForTimeout(35_000);
  await page.reload();
  await expect(page.locator('text=Step 3 advanced')).toBeVisible();
  
  // === 14. Clean up ===
  // (test cleanup via afterEach)
});

test.afterEach(async ({ request }) => {
  await request.delete('/api/__test__/cleanup-m5-test');
});
```

## Critères de réussite

- [ ] Tout le parcours passe en < 2 min
- [ ] 0 erreur console
- [ ] Toutes les transitions de status corrects
- [ ] Cleanup fait (pas d'audience/automation orpheline)

## Prérequis

- Storage state admin (via `global.setup.ts`)
- Endpoint `/api/__test__/*` activé en env staging only (env var
  `ENABLE_TEST_ENDPOINTS=1`)
- DB staging avec quelques leads/orders pour avoir des preview > 0

## Run

```bash
pnpm playwright test e2e/m5-ultimate.spec.ts
```

CI : déclenché manuellement après les autres tests E2E (séparé pour
ne pas bloquer la pipeline en cas de flakiness).
