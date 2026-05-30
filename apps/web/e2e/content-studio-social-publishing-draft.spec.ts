/**
 * S2.3 phase e — E2E happy path for "Brouillon Postiz" mode.
 *
 * Uses dry-run as the provider (no external Postiz call in CI): the
 * adapter supports draft mode and produces a /draft/ permalink. The
 * spec asserts on UI feedback + DB row shape (publishMode='draft',
 * content_post.status untouched, audit event emitted).
 */
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

interface SeedIds {
  suffix: string;
  ideaId: string;
  briefId: string;
  draftId: string;
  postId: string;
  mediaId: string;
  bindingId: string;
}

test('envoie un post Content Studio en brouillon Postiz depuis l interface admin', async ({ page }) => {
  await cleanupPlaywrightFixtures();
  const ids = await seedApprovedInstagramPost();
  page.on('dialog', (dialog) => dialog.accept());

  try {
    // /admin/content-studio redirige vers v2 quand CONTENT_STUDIO_V2_DEFAULT=true ;
    // le module legacy (panneau « Publication directe » + « Brouillon Postiz »)
    // reste accessible sur /admin/content-studio-legacy (URL de rollback stable).
    await page.goto('/admin/content-studio-legacy');
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: 'Studio contenu' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: `Playwright brouillon draft ${ids.suffix}` }),
    ).toBeVisible();
    const publishingPanel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Publication directe', exact: true }) })
      .last();
    await expect(publishingPanel.locator('select').first()).toBeEnabled();
    await expect(publishingPanel.getByText('publiable')).toBeVisible();

    // S2.3 phase e: switch to draft mode
    await publishingPanel.getByRole('radio', { name: /Brouillon Postiz/i }).check();
    await expect(
      publishingPanel.getByText(/n[’']apparaîtra pas sur le réseau social/i),
    ).toBeVisible();

    await publishingPanel.getByRole('button', { name: /Envoyer comme brouillon/i }).click();

    await expect(page.getByText(/[Bb]rouillon envoyé/)).toBeVisible();
    await expect(publishingPanel.getByText('published').first()).toBeVisible();

    await expectDraftJobInDb(ids.postId);
  } finally {
    await cleanupSeed(ids);
  }
});

async function cleanupPlaywrightFixtures() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await tx`delete from content_post where id like 'cp_pwd_%'`;
      await tx`delete from content_brand_review where draft_id like 'cd_pwd_%'`;
      await tx`delete from content_asset_binding where draft_id like 'cd_pwd_%'`;
      await tx`delete from content_draft where id like 'cd_pwd_%'`;
      await tx`delete from content_brief where id like 'cb_pwd_%'`;
      await tx`delete from content_idea where id like 'ci_pwd_%'`;
      await tx`delete from media where id like 'me_pwd_%'`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

async function seedApprovedInstagramPost(): Promise<SeedIds> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for this e2e seed.');

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ids: SeedIds = {
    suffix,
    ideaId: `ci_pwd_${suffix}`,
    briefId: `cb_pwd_${suffix}`,
    draftId: `cd_pwd_${suffix}`,
    postId: `cp_pwd_${suffix}`,
    mediaId: `me_pwd_${suffix}`,
    bindingId: `cab_pwd_${suffix}`,
  };
  const now = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into content_idea (
          id, pillar, objective, platform, format, prompt, status, created_at, updated_at
        ) values (
          ${ids.ideaId}, 'education', 'engagement', 'instagram', 'post',
          ${`Playwright brouillon draft ${suffix}`}, 'generated', ${now}, ${now}
        )
      `;
      await tx`
        insert into content_brief (
          id, idea_id, angle, cta, media_direction, constraints_json, version, created_at
        ) values (
          ${ids.briefId}, ${ids.ideaId}, 'Routine peau sensible (draft mode)',
          'Découvrir le kit FemiGlow', 'Packshot clair sur fond neutre',
          ${JSON.stringify({ e2e: true, mode: 'draft' })}::jsonb, 1, ${now}
        )
      `;
      await tx`
        insert into content_draft (
          id, brief_id, platform, format, variant_label, caption, hook, cta, alt_text,
          hashtags_json, status, score_total, created_at, updated_at
        ) values (
          ${ids.draftId}, ${ids.briefId}, 'instagram', 'post',
          ${`Playwright brouillon draft ${suffix}`},
          ${`Playwright brouillon draft ${suffix} - test mode brouillon Postiz.`},
          'Routine peau sensible', 'Découvrir le kit FemiGlow',
          'Packshot FemiGlow pour test de brouillon dry-run',
          ${JSON.stringify(['femiglow', 'draft'])}::jsonb, 'approved', 96, ${now}, ${now}
        )
      `;
      await tx`
        insert into content_brand_review (
          id, draft_id, status, score_total, score_json, violations_json, rules_version, created_at
        ) values (
          ${`cbr_pwd_${suffix}`}, ${ids.draftId}, 'pass', 96,
          ${JSON.stringify({ tone: 96 })}::jsonb, ${JSON.stringify([])}::jsonb, 'e2e', ${now}
        )
      `;
      await tx`
        insert into content_post (
          id, draft_id, status, utm_json, created_at, updated_at
        ) values (
          ${ids.postId}, ${ids.draftId}, 'approved', ${JSON.stringify({ e2e: true })}::jsonb,
          ${now}, ${now}
        )
      `;
      await tx`
        insert into media (
          id, kind, source, slug, original_url, original_filename, original_size_bytes,
          original_mime, original_width, original_height, palette, alt, status,
          quality_profile, loading_strategy, is_hero, overrides, created_at, updated_at
        ) values (
          ${ids.mediaId}, 'image', 'external', ${`playwright-draft-${suffix}`},
          'https://cdn.femiglow.test/e2e/draft.jpg', 'draft.jpg',
          1024, 'image/jpeg', 1080, 1080, ${JSON.stringify([])}::jsonb,
          'Image e2e draft mode', 'ready', 'inline', 'viewport', false,
          ${JSON.stringify({ contentStudio: true, e2e: true })}::jsonb, ${now}, ${now}
        )
      `;
      await tx`
        insert into content_asset_binding (
          id, draft_id, media_id, role, crop_json, created_at
        ) values (
          ${ids.bindingId}, ${ids.draftId}, ${ids.mediaId}, 'primary',
          ${JSON.stringify({})}::jsonb, ${now}
        )
      `;
    });
  } catch (error) {
    await sql.end({ timeout: 1 });
    await cleanupSeed(ids);
    throw error;
  }

  await sql.end({ timeout: 1 });
  return ids;
}

async function expectDraftJobInDb(postId: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for this e2e assertion.');
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const jobs = await sql<{ id: string; status: string; mode: string | null }[]>`
      select id, status, content_json->>'publishMode' as mode
      from social_publish_job
      where post_id = ${postId}
      order by created_at desc
    `;
    expect(jobs[0]?.status).toBe('published');
    expect(jobs[0]?.mode).toBe('draft');

    // content_post.status must remain 'approved' (draft does not flip it).
    const post = await sql<{ status: string }[]>`
      select status from content_post where id = ${postId}
    `;
    expect(post[0]?.status).toBe('approved');

    // Audit event emitted
    const events = await sql<{ action: string; resource_id: string | null }[]>`
      select action, resource_id from audit_events
      where action = 'social.draft_created' and resource_id = ${postId}
    `;
    expect(events.length).toBeGreaterThanOrEqual(1);

    // Publication permalink is the dry-run /draft/ URL
    const publications = await sql<{ permalink: string | null }[]>`
      select permalink from social_publication where post_id = ${postId}
    `;
    expect(publications[0]?.permalink).toContain('/draft/');
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function cleanupSeed(ids: SeedIds) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await tx`delete from audit_events where resource_id = ${ids.postId}`;
      await tx`delete from social_publication where post_id = ${ids.postId}`;
      await tx`delete from social_publish_event where job_id in (select id from social_publish_job where post_id = ${ids.postId})`;
      await tx`delete from social_publish_job where post_id = ${ids.postId}`;
      await tx`delete from content_asset_binding where draft_id = ${ids.draftId}`;
      await tx`delete from content_post where id = ${ids.postId}`;
      await tx`delete from content_brand_review where draft_id = ${ids.draftId}`;
      await tx`delete from content_draft where id = ${ids.draftId}`;
      await tx`delete from content_brief where id = ${ids.briefId}`;
      await tx`delete from content_idea where id = ${ids.ideaId}`;
      await tx`delete from media where id = ${ids.mediaId}`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}
