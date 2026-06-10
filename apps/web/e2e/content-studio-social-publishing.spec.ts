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

test('publie un post Content Studio en dry-run depuis l interface admin', async ({ page }) => {
  await cleanupPlaywrightFixtures();
  const ids = await seedApprovedInstagramPost();
  page.on('dialog', (dialog) => dialog.accept());

  try {
    // /admin/content-studio redirige vers v2 (CONTENT_STUDIO_V2_DEFAULT=true) ;
    // le module v1 (panneau « Publication directe ») vit sur l'URL legacy stable.
    await page.goto('/admin/content-studio-legacy');
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: 'Studio contenu' })).toBeVisible();
    await expect(page.getByRole('heading', { name: `Playwright publication directe ${ids.suffix}` })).toBeVisible();
    const publishingPanel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Publication directe', exact: true }) }).last();
    await expect(publishingPanel.getByRole('heading', { name: 'Publication directe', exact: true })).toBeVisible();
    await expect(publishingPanel.locator('select').first()).toBeEnabled();
    await expect(publishingPanel.locator('select').first()).toContainText('Instagram dry-run');
    await expect(publishingPanel.getByText('publiable')).toBeVisible();

    await publishingPanel.getByRole('button', { name: 'Publier maintenant' }).click();

    await expect(page.getByText('Publication dry-run effectuée.')).toBeVisible();
    await expect(publishingPanel.getByText('published').first()).toBeVisible();

    await expectPublishedDryRun(ids.postId);
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
      await tx`delete from content_post where id like 'cp_pw_%'`;
      await tx`delete from content_brand_review where draft_id like 'cd_pw_%'`;
      await tx`delete from content_asset_binding where draft_id like 'cd_pw_%'`;
      await tx`delete from content_draft where id like 'cd_pw_%'`;
      await tx`delete from content_brief where id like 'cb_pw_%'`;
      await tx`delete from content_idea where id like 'ci_pw_%'`;
      await tx`delete from media where id like 'me_pw_%'`;
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
    ideaId: `ci_pw_${suffix}`,
    briefId: `cb_pw_${suffix}`,
    draftId: `cd_pw_${suffix}`,
    postId: `cp_pw_${suffix}`,
    mediaId: `me_pw_${suffix}`,
    bindingId: `cab_pw_${suffix}`,
  };
  const now = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into content_idea (
          id, pillar, objective, platform, format, prompt, status, created_at, updated_at
        ) values (
          ${ids.ideaId}, 'education', 'engagement', 'instagram', 'post',
          ${`Playwright publication directe ${suffix}`}, 'generated', ${now}, ${now}
        )
      `;
      await tx`
        insert into content_brief (
          id, idea_id, angle, cta, media_direction, constraints_json, version, created_at
        ) values (
          ${ids.briefId}, ${ids.ideaId}, 'Routine peau sensible validée',
          'Découvrir le kit FemiGlow', 'Packshot clair sur fond neutre',
          ${JSON.stringify({ e2e: true })}::jsonb, 1, ${now}
        )
      `;
      await tx`
        insert into content_draft (
          id, brief_id, platform, format, variant_label, caption, hook, cta, alt_text,
          hashtags_json, status, score_total, created_at, updated_at
        ) values (
          ${ids.draftId}, ${ids.briefId}, 'instagram', 'post',
          ${`Playwright publication directe ${suffix}`},
          ${`Playwright publication directe ${suffix} - routine testée en staging.`},
          'Routine peau sensible', 'Découvrir le kit FemiGlow',
          'Packshot FemiGlow pour test de publication dry-run',
          ${JSON.stringify(['femiglow', 'skincare'])}::jsonb, 'approved', 96, ${now}, ${now}
        )
      `;
      await tx`
        insert into content_brand_review (
          id, draft_id, status, score_total, score_json, violations_json, rules_version, created_at
        ) values (
          ${`cbr_pw_${suffix}`}, ${ids.draftId}, 'pass', 96,
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
          ${ids.mediaId}, 'image', 'external', ${`playwright-social-${suffix}`},
          'https://cdn.femiglow.test/e2e/social-publishing.jpg', 'social-publishing.jpg',
          1024, 'image/jpeg', 1080, 1080, ${JSON.stringify([])}::jsonb,
          'Image e2e publication directe', 'ready', 'inline', 'viewport', false,
          ${JSON.stringify({ contentStudio: true, e2e: true })}::jsonb, ${now}, ${now}
        )
      `;
      await tx`
        insert into content_asset_binding (
          id, draft_id, media_id, role, crop_json, created_at
        ) values (
          ${ids.bindingId}, ${ids.draftId}, ${ids.mediaId}, 'primary_image',
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

async function expectPublishedDryRun(postId: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for this e2e assertion.');
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const jobs = await sql<{ id: string; status: string }[]>`
      select id, status from social_publish_job where post_id = ${postId} order by created_at desc
    `;
    expect(jobs[0]?.status).toBe('published');

    const publications = await sql<{ id: string; provider: string; platform: string }[]>`
      select id, provider, platform from social_publication where post_id = ${postId}
    `;
    expect(publications).toHaveLength(1);
    expect(publications[0]).toMatchObject({ provider: 'dry_run', platform: 'instagram' });
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
