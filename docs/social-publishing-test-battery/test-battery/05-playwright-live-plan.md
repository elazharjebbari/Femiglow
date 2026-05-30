# Playwright Live plan

## Une spec, un scénario : S13

`e2e/social-publishing/live-instagram-alfenna.spec.ts`

## Gating
- `E2E_LIVE_POSTIZ=1` requis
- Marqué `@live`
- `--workers=1`
- `--grep @live`

## Structure spec

```ts
import { expect, test } from '@playwright/test';

const SKIP = process.env.E2E_LIVE_POSTIZ !== '1';

test.skip(SKIP, 'E2E_LIVE_POSTIZ=1 required');

test.use({ workers: 1, storageState: ADMIN_STORAGE_PATH });

test.describe('Live Instagram AlFenna Beauty @live', () => {
  let postizPostId: string | null = null;

  test.beforeAll(async () => {
    // Pre-flight: vars + Postiz smoke + dangling test check
    assertEnv(['POSTIZ_API_KEY', 'E2E_LIVE_ACCOUNT_ID']);
    await ensureNoDanglingTestPosts();
    await syncPostizIntegrations();
  });

  test('publish-now on AlFenna IG end-to-end', async ({ page, request }) => {
    // 1. Create test draft via API
    const { postId } = await createTestPost(request);

    // 2. Drive UI flow
    await page.goto(`/admin/content-studio-v2/create?draft=${postId}`);
    await page.getByTestId('approve-draft-button').click();
    await page.getByRole('button', { name: /Options de publication/i }).click();
    await page.getByRole('menuitem', { name: /Publier maintenant/i }).click();
    await page.getByRole('button', { name: /Confirmer/i }).click();
    await expect(page.getByText(/Publication lancée/i)).toBeVisible();

    // 3. Wait DB
    const job = await waitForJobPublished(request, postId, 90_000);
    postizPostId = job.lastPublication?.remoteId ?? null;
    expect(postizPostId).toBeTruthy();

    // 4. Verify Postiz
    const postizPost = await fetchPostizPost(postizPostId);
    expect(postizPost.status).toMatch(/SENT|PUBLISHED/);
    expect(postizPost.permalink).toContain('instagram.com');

    // 5. Verify audit log
    const audits = await fetchAudits(request, postId, 'social.publish.published');
    expect(audits.length).toBe(1);
  });

  test.afterEach(async () => {
    if (postizPostId && process.env.E2E_LIVE_CLEANUP === '1') {
      await deletePostizPost(postizPostId);
      console.log('Cleaned up Postiz post', postizPostId);
    }
  });
});
```

## Pre-flight checks

```bash
# scripts/live-preflight.sh
#!/bin/bash
set -e
[ "$E2E_LIVE_POSTIZ" = "1" ] || { echo "E2E_LIVE_POSTIZ=1 required"; exit 1; }
[ -n "$POSTIZ_API_KEY" ] || { echo "POSTIZ_API_KEY missing"; exit 1; }
[ -n "$E2E_LIVE_ACCOUNT_ID" ] || { echo "E2E_LIVE_ACCOUNT_ID missing"; exit 1; }
curl -s -H "Authorization: $POSTIZ_API_KEY" "$POSTIZ_BASE_URL/api/public/v1/integrations" | jq '.[] | .id' | grep -q "$E2E_LIVE_ACCOUNT_ID" || { echo "Account not found in Postiz"; exit 1; }
```

## Cleanup recovery

Voir `05-live-testing-protocol.md` section 6.

## Commande live

```bash
export E2E_LIVE_POSTIZ=1
export POSTIZ_API_KEY=...
export E2E_LIVE_ACCOUNT_ID=...
export E2E_LIVE_CLEANUP=1

./scripts/live-preflight.sh && \
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/live-instagram-alfenna.spec.ts \
  --grep @live --workers=1 --reporter=list
```
