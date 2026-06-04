/**
 * Smoke — la couche MSW emailing répond sur chaque endpoint nominal,
 * et la grille `emailsFailWith` injecte bien les échecs (W0).
 *
 * Tourne en jsdom (défaut) comme la smoke coupons : les handlers utilisent des
 * chemins RELATIFS `/api/...` (convention repo, pour matcher les fetch relatifs
 * des composants admin) ; jsdom fournit `location.origin` contre lequel MSW
 * résout chemins de handler ET fetch — un env `node` n'a pas d'origine et
 * casserait le matching.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';
import {
  emailsHandlers,
  emailsFailWith,
  makeSearchResult,
  makeSummary,
} from '@/test/msw/emails-handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const json = (path: string, init?: RequestInit) =>
  fetch(path, init).then(async (r) => ({ status: r.status, body: await r.json() }));

const jsonPost = (path: string, payload: unknown = {}) =>
  json(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

describe('MSW emails-handlers (smoke)', () => {
  // CKP-MSW-EMAIL-001
  it('001 transactional/search → rows + total + window', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await jsonPost('/api/admin/emails/transactional/search', {
      filters: [],
      pagination: { limit: 50, offset: 0 },
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows[0]).toHaveProperty('toEmail');
    expect(body).toHaveProperty('total');
    expect(body.window).toBe('matched');
  });

  // CKP-MSW-EMAIL-002
  it('002 transactional/summary reflète la fenêtre demandée', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await json('/api/admin/emails/transactional/summary?window=24h');
    expect(status).toBe(200);
    expect(body.window).toBe('24h');
    expect(body).toHaveProperty('delivered');
    expect(body).toHaveProperty('queued');
    expect(body).toHaveProperty('failed');
    expect(body).toHaveProperty('hardBounced');
    expect(body.sparkline).toHaveLength(12);
  });

  // CKP-MSW-EMAIL-003
  it('003 transactional/bulk-retry compte les ids fournis', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await jsonPost('/api/admin/emails/transactional/bulk-retry', {
      ids: ['a', 'b', 'c'],
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ retried: 3, skipped: 0, skippedIds: [] });
  });

  // CKP-MSW-EMAIL-004
  it('004 transactional/bulk-suppress compte les ids fournis', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await jsonPost('/api/admin/emails/transactional/bulk-suppress', {
      ids: ['a', 'b'],
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ suppressed: 2, skipped: 0 });
  });

  // CKP-MSW-EMAIL-005
  it('005 views GET liste + POST renvoie une vue custom', async () => {
    server.use(...emailsHandlers);
    const list = await json('/api/admin/emails/views?scope=transactional');
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ scope: 'transactional', isSystem: true });

    const created = await jsonPost('/api/admin/emails/views', {
      name: 'Ma vue',
      scope: 'transactional',
      filterState: { filters: {} },
    });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: 'Ma vue', isSystem: false });
  });

  // CKP-MSW-EMAIL-006
  it('006 views PATCH + DELETE', async () => {
    server.use(...emailsHandlers);
    const patched = await json('/api/admin/emails/views/view_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Renommée' }),
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: 'view_1', name: 'Renommée' });

    const deleted = await json('/api/admin/emails/views/view_1', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ ok: true });
  });

  // CKP-MSW-EMAIL-007
  it('007 audiences GET liste (avec snapshotCount) + POST create', async () => {
    server.use(...emailsHandlers);
    const list = await json('/api/admin/emails/audiences');
    expect(list.status).toBe(200);
    expect(list.body[0]).toHaveProperty('snapshotCount');
    expect(list.body[0]).toHaveProperty('slug');

    const created = await jsonPost('/api/admin/emails/audiences', { slug: 'vip', name: 'VIP' });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ slug: 'vip', name: 'VIP' });
    expect(created.body).toHaveProperty('rules');
  });

  // CKP-MSW-EMAIL-008
  it('008 audiences GET/PATCH/DELETE by id', async () => {
    server.use(...emailsHandlers);
    const got = await json('/api/admin/emails/audiences/aud_1');
    expect(got.status).toBe(200);
    expect(got.body.id).toBe('aud_1');

    const patched = await json('/api/admin/emails/audiences/aud_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Renommée' }),
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: 'aud_1', name: 'Renommée' });

    const deleted = await json('/api/admin/emails/audiences/aud_1', { method: 'DELETE' });
    expect(deleted.body).toEqual({ ok: true });
  });

  // CKP-MSW-EMAIL-009
  it('009 audiences preview-size → size + durationMs', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await jsonPost('/api/admin/emails/audiences/preview-size', {
      rules: { op: 'and', conditions: [] },
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ size: 1234 });
    expect(body).toHaveProperty('durationMs');
  });

  // CKP-MSW-EMAIL-010
  it('010 audiences preview-sample → samples + size', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await jsonPost('/api/admin/emails/audiences/preview-sample', {
      rules: { op: 'and', conditions: [] },
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.samples)).toBe(true);
    expect(body.samples[0]).toHaveProperty('email');
    expect(body).toHaveProperty('size');
  });

  // CKP-MSW-EMAIL-011
  it('011 audiences snapshot → snapshotId + status + size', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await jsonPost('/api/admin/emails/audiences/aud_1/snapshot', {});
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'done', audienceId: 'aud_1' });
    expect(body).toHaveProperty('snapshotId');
    expect(body).toHaveProperty('size');
  });

  // CKP-MSW-EMAIL-012
  it('012 templates GET liste + POST create', async () => {
    server.use(...emailsHandlers);
    const list = await json('/api/admin/emails/templates');
    expect(list.status).toBe(200);
    expect(list.body[0]).toHaveProperty('slug');
    expect(list.body[0]).toHaveProperty('subjectTmpl');

    const created = await jsonPost('/api/admin/emails/templates', { slug: 'promo', name: 'Promo' });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ slug: 'promo', name: 'Promo' });
  });

  // CKP-MSW-EMAIL-013
  it('013 templates autocomplete → templates[{slug,name,source}]', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await json('/api/admin/emails/templates/autocomplete');
    expect(status).toBe(200);
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates[0]).toMatchObject({ source: 'system' });
    expect(body.templates.some((t: { source: string }) => t.source === 'custom')).toBe(true);
  });

  // CKP-MSW-EMAIL-014
  it('014 templates starters → liste avec htmlSource', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await json('/api/admin/emails/templates/starters');
    expect(status).toBe(200);
    expect(body[0]).toHaveProperty('htmlSource');
    expect(body[0]).toHaveProperty('id');
  });

  // CKP-MSW-EMAIL-015
  it('015 templates GET/DELETE by id', async () => {
    server.use(...emailsHandlers);
    const got = await json('/api/admin/emails/templates/tpl_1');
    expect(got.status).toBe(200);
    expect(got.body.id).toBe('tpl_1');
    expect(got.body).toHaveProperty('htmlSource');

    const deleted = await json('/api/admin/emails/templates/tpl_1', { method: 'DELETE' });
    expect(deleted.body).toEqual({ ok: true });
  });

  // CKP-MSW-EMAIL-016
  it('016 templates preview → subject + preheader + html + variablesResolved', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await jsonPost('/api/admin/emails/templates/tpl_1/preview', {
      htmlSource: '<html><body>x</body></html>',
    });
    expect(status).toBe(200);
    expect(body).toHaveProperty('subject');
    expect(body).toHaveProperty('preheader');
    expect(body).toHaveProperty('html');
    expect(Array.isArray(body.variablesResolved)).toBe(true);
  });

  // CKP-MSW-EMAIL-017
  it('017 templates versions GET liste + POST save', async () => {
    server.use(...emailsHandlers);
    const list = await json('/api/admin/emails/templates/tpl_1/versions');
    expect(list.status).toBe(200);
    expect(list.body[0]).toHaveProperty('versionNumber');

    const saved = await jsonPost('/api/admin/emails/templates/tpl_1/versions', {
      subjectTmpl: 'S',
      htmlSource: '<html><body>twenty chars min here…</body></html>',
      commitMessage: 'maj',
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ commitMessage: 'maj' });
    expect(saved.body).toHaveProperty('versionNumber');
  });

  // CKP-MSW-EMAIL-018
  it('018 automation events-catalog → events[]', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await json('/api/admin/emails/automation/events-catalog');
    expect(status).toBe(200);
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events[0]).toMatchObject({ category: expect.any(String) });
    expect(body.events.some((e: { name: string }) => e.name === 'lead.created')).toBe(true);
  });

  // CKP-MSW-EMAIL-019
  it('019 health → level + checks + timestamp', async () => {
    server.use(...emailsHandlers);
    const { status, body } = await json('/api/admin/emails/health');
    expect(status).toBe(200);
    expect(body.level).toBe('ok');
    expect(body.checks).toHaveProperty('smtpConfigured');
    expect(body.checks).toHaveProperty('db');
    expect(body).toHaveProperty('timestamp');
  });

  // CKP-MSW-EMAIL-020
  it('020 mail/unsubscribe POST(JSON) + GET(HTML)', async () => {
    server.use(...emailsHandlers);
    const post = await fetch('/api/mail/unsubscribe?t=tok', { method: 'POST' });
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ ok: true });

    const get = await fetch('/api/mail/unsubscribe?t=tok');
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toContain('text/html');
    expect(await get.text()).toContain('Désinscription');
  });

  // CKP-MSW-EMAIL-021
  it('021 webhooks stalwart + listmonk → { ok: true }', async () => {
    server.use(...emailsHandlers);
    const stalwart = await jsonPost('/api/mail/webhook/stalwart', { event: 'delivery.delivered' });
    expect(stalwart.status).toBe(200);
    expect(stalwart.body).toEqual({ ok: true });

    const listmonk = await jsonPost('/api/mail/webhook/listmonk', { event: 'subscriber.unsubscribed' });
    expect(listmonk.status).toBe(200);
    expect(listmonk.body).toEqual({ ok: true });
  });

  // CKP-MSW-EMAIL-022
  it('022 emailsFailWith.unauthorized override le nominal (use() séparé postérieur)', async () => {
    server.use(...emailsHandlers);
    server.use(emailsFailWith.unauthorized('/api/admin/emails/audiences', 'get'));
    const res = await fetch('/api/admin/emails/audiences');
    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
  });

  // CKP-MSW-EMAIL-023
  it('023 emailsFailWith.validation → 422 { error, issues }', async () => {
    server.use(...emailsHandlers);
    server.use(emailsFailWith.validation('/api/admin/emails/audiences', 'post', 'slug invalide'));
    const { status, body } = await jsonPost('/api/admin/emails/audiences', { slug: '!' });
    expect(status).toBe(422);
    expect(body.error).toBe('slug invalide');
    expect(body).toHaveProperty('issues');
  });

  // CKP-MSW-EMAIL-024
  it('024 emailsFailWith.serverError → 500 { ok:false }', async () => {
    server.use(...emailsHandlers);
    server.use(emailsFailWith.serverError('/api/admin/emails/transactional/summary', 'get'));
    const { status, body } = await json('/api/admin/emails/transactional/summary?window=1h');
    expect(status).toBe(500);
    expect(body).toMatchObject({ ok: false });
  });

  // CKP-MSW-EMAIL-025
  it('025 emailsFailWith.network → fetch rejette', async () => {
    server.use(...emailsHandlers);
    server.use(emailsFailWith.network('/api/admin/emails/health', 'get'));
    await expect(fetch('/api/admin/emails/health')).rejects.toThrow();
  });

  // CKP-MSW-EMAIL-026
  it('026 emailsFailWith.hang ne répond pas (AbortSignal annule)', async () => {
    server.use(...emailsHandlers);
    server.use(emailsFailWith.hang('/api/admin/emails/health', 'get'));
    await expect(
      fetch('/api/admin/emails/health', { signal: AbortSignal.timeout(50) }),
    ).rejects.toThrow();
  });

  // CKP-MSW-EMAIL-027
  it('027 helpers makeSearchResult / makeSummary façonnent une réponse override', async () => {
    server.use(
      http.post('/api/admin/emails/transactional/search', () =>
        HttpResponse.json(makeSearchResult({ total: 999, window: 'truncated' })),
      ),
      http.get('/api/admin/emails/transactional/summary', () =>
        HttpResponse.json(makeSummary({ delivered: 7777 })),
      ),
    );
    const search = await jsonPost('/api/admin/emails/transactional/search', {
      filters: [],
      pagination: { limit: 50, offset: 0 },
    });
    expect(search.body).toMatchObject({ total: 999, window: 'truncated' });
    const summary = await json('/api/admin/emails/transactional/summary?window=1h');
    expect(summary.body.delivered).toBe(7777);
  });
});
