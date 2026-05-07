import { test, expect } from '@playwright/test';

test.describe('admin security headers', () => {
  test('/admin/login expose noindex + no-store', async ({ request }) => {
    const res = await request.get('/admin/login');
    const robots = res.headers()['x-robots-tag'] ?? '';
    const cache = res.headers()['cache-control'] ?? '';
    expect(robots).toContain('noindex');
    expect(cache).toContain('no-store');
  });

  test('/admin redirect avant exposition de contenu', async ({ request }) => {
    const res = await request.get('/admin', { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    const loc = res.headers()['location'] ?? '';
    expect(loc).toMatch(/\/admin\/login/);
  });
});
