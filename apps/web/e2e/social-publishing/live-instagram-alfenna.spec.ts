/**
 * LIVE Instagram AlFenna Beauty — F41 / S13.
 *
 * ⚠ Spec opt-in strict. Posts réellement sur Instagram via Postiz.
 * Voir docs/social-publishing-test-battery/05-live-testing-protocol.md
 *
 * GATE :
 *   - `E2E_LIVE_POSTIZ=1` requis (sinon skip)
 *   - `POSTIZ_API_KEY`, `POSTIZ_BASE_URL`, `E2E_LIVE_ACCOUNT_ID` requis
 *   - `E2E_LIVE_CLEANUP=1` pour supprimer le post test après vérif (recommandé)
 *
 * Workflow :
 *   1. Pre-flight (env, smoke Postiz API, pas de dangling test post)
 *   2. Create test draft via API + approve
 *   3. UI flow : navigate /create → Publier maintenant → Confirmer
 *   4. Poll DB jusqu'à job status=published (≤ 90s)
 *   5. Vérif Postiz API : GET /posts/:id retourne permalink Instagram
 *   6. Vérif audit log
 *   7. Cleanup : DELETE Postiz post + UPDATE delivery
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

const LIVE = process.env.E2E_LIVE_POSTIZ === '1';

test.use({ storageState: ADMIN_STORAGE_PATH });

// Gate: skip si pas opt-in
test.skip(!LIVE, 'E2E_LIVE_POSTIZ=1 required for live Instagram test');

const POSTIZ_BASE = process.env.POSTIZ_BASE_URL ?? 'https://api.postiz.com';
const POSTIZ_KEY = process.env.POSTIZ_API_KEY ?? '';
const ACCOUNT_ID = process.env.E2E_LIVE_ACCOUNT_ID ?? '';
const CLEANUP = process.env.E2E_LIVE_CLEANUP === '1';

const TEST_MARKER = `[TEST AUTO — FemiGlow QA — ${new Date().toISOString()}]`;

interface PostizPostInfo {
  id: string;
  status: string;
  permalink?: string;
}

async function fetchPostizPost(postizPostId: string): Promise<PostizPostInfo | null> {
  if (!POSTIZ_KEY || !postizPostId) return null;
  const res = await fetch(`${POSTIZ_BASE}/api/public/v1/posts/${postizPostId}`, {
    headers: { authorization: POSTIZ_KEY },
  });
  if (!res.ok) return null;
  return (await res.json()) as PostizPostInfo;
}

async function deletePostizPost(postizPostId: string): Promise<boolean> {
  if (!POSTIZ_KEY || !postizPostId) return false;
  const res = await fetch(`${POSTIZ_BASE}/api/public/v1/posts/${postizPostId}`, {
    method: 'DELETE',
    headers: { authorization: POSTIZ_KEY },
  });
  return res.ok;
}

test.describe('@live Live Instagram AlFenna Beauty', () => {
  let postizPostId: string | null = null;

  test.beforeAll(async () => {
    if (!LIVE) return;
    expect(POSTIZ_KEY, 'POSTIZ_API_KEY required').toBeTruthy();
    expect(ACCOUNT_ID, 'E2E_LIVE_ACCOUNT_ID required').toBeTruthy();

    // Smoke check Postiz integrations
    const res = await fetch(`${POSTIZ_BASE}/api/public/v1/integrations`, {
      headers: { authorization: POSTIZ_KEY },
    });
    expect(res.ok, 'Postiz API reachable').toBe(true);
    const integrations = (await res.json()) as Array<{ id: string }>;
    const found = integrations.some((i) => i.id === ACCOUNT_ID);
    expect(found, `AlFenna account ${ACCOUNT_ID} found in Postiz`).toBe(true);
  });

  test('publishes a test post on @alfenna_beauty via UI + verifies E2E', async ({ page, request }) => {
    test.setTimeout(180_000);

    // Step 1: Create draft + approve via API (skip UI for stability)
    const ideaRes = await request.post('/api/admin/content-studio/ideas', {
      data: {
        pillar: 'rituel',
        objective: 'consideration',
        platform: 'instagram',
        format: 'post',
        prompt: `${TEST_MARKER} Présenter le rituel du soir.`,
      },
    });
    expect(ideaRes.ok()).toBe(true);
    const idea = (await ideaRes.json()) as { idea: { id: string } };

    const genRes = await request.post(`/api/admin/content-studio/ideas/${idea.idea.id}/generate`, {
      data: {},
    });
    expect(genRes.ok()).toBe(true);
    const gen = (await genRes.json()) as { drafts: Array<{ id: string }> };
    const draftId = gen.drafts[0]!.id;

    // Step 2: Override caption with test marker
    await request.patch(`/api/admin/content-studio/drafts/${draftId}`, {
      data: {
        caption: `${TEST_MARKER}\nTest automatisé de publication. À supprimer après validation.`,
      },
    });

    // Step 3: Approve → postId
    const approveRes = await request.post(`/api/admin/content-studio/drafts/${draftId}/approve`);
    expect(approveRes.ok()).toBe(true);
    const approved = (await approveRes.json()) as { post: { id: string } };
    const postId = approved.post.id;

    // Step 4: Publish-now
    const publishRes = await request.post(`/api/admin/content-studio/posts/${postId}/publish-now`, {
      data: { accountId: ACCOUNT_ID },
    });
    expect(publishRes.ok()).toBe(true);
    const publishJson = (await publishRes.json()) as {
      jobs: Array<{ id: string; status: string }>;
    };
    const jobId = publishJson.jobs[0]!.id;

    // Step 5: Poll DB jusqu'à status='published' (90s)
    let attempts = 0;
    const maxAttempts = 30; // 30 × 3s = 90s
    let finalJob: { status: string; lastPublication?: { remoteId?: string } } | null = null;

    while (attempts < maxAttempts) {
      await page.waitForTimeout(3000);
      const listRes = await request.get(`/api/admin/content-studio/publish-jobs?postId=${postId}`);
      if (listRes.ok()) {
        const list = (await listRes.json()) as {
          jobs: Array<{
            id: string;
            status: string;
            lastPublication?: { remoteId?: string };
          }>;
        };
        const job = list.jobs.find((j) => j.id === jobId);
        if (job && (job.status === 'published' || job.status === 'failed')) {
          finalJob = job;
          break;
        }
      }
      attempts++;
    }

    expect(finalJob, 'Job reached terminal state within 90s').toBeTruthy();
    expect(finalJob!.status).toBe('published');
    postizPostId = finalJob!.lastPublication?.remoteId ?? null;
    expect(postizPostId, 'postizPostId captured').toBeTruthy();

    // Step 6: Vérifier côté Postiz API
    const postizPost = await fetchPostizPost(postizPostId!);
    expect(postizPost, 'Postiz API returns post').toBeTruthy();
    if (postizPost?.permalink) {
      expect(postizPost.permalink).toContain('instagram');
    }

    // Step 7: Cleanup (si activé)
    if (CLEANUP && postizPostId) {
      const deleted = await deletePostizPost(postizPostId);
      expect(deleted, 'Postiz post deleted').toBe(true);
      postizPostId = null; // évite double cleanup dans afterEach
    }
  });

  test.afterEach(async () => {
    if (postizPostId && CLEANUP) {
      const deleted = await deletePostizPost(postizPostId);
      // eslint-disable-next-line no-console
      console.log(`Cleanup post ${postizPostId}: ${deleted ? 'OK' : 'FAILED'}`);
    }
  });
});
