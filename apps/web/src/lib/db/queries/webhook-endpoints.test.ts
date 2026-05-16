import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  createWebhookEndpoint,
  getWebhookEndpoint,
  listWebhookEndpoints,
  updateWebhookEndpoint,
  rotateWebhookSecret,
  revealWebhookSecret,
  setWebhookSecret,
  deleteWebhookEndpoint,
} from './webhook-endpoints';

beforeEach(() => {
  resetMemoryStore();
  process.env.WEBHOOK_SECRET_KEY = 'k'.repeat(32);
});

describe('queries.webhook-endpoints', () => {
  it('crée et expose le secret en clair une fois', async () => {
    const { endpoint, plainSecret } = await createWebhookEndpoint({
      url: 'https://api.partner.com/hook',
      events: ['lead.created'],
    });
    expect(endpoint.id).toMatch(/^we_/);
    expect(plainSecret.length).toBeGreaterThan(20);
    expect(endpoint.active).toBe(true);
  });

  it('liste exclut les soft-deleted', async () => {
    const a = await createWebhookEndpoint({
      url: 'https://api.partner.com/a',
      events: ['lead.created'],
    });
    await createWebhookEndpoint({
      url: 'https://api.partner.com/b',
      events: ['lead.created'],
    });
    await deleteWebhookEndpoint(a.endpoint.id);
    const rows = await listWebhookEndpoints();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).not.toBe(a.endpoint.id);
  });

  it('rotateWebhookSecret régénère un secret différent', async () => {
    const created = await createWebhookEndpoint({
      url: 'https://api.partner.com/hook',
      events: ['lead.created'],
    });
    const rotated = await rotateWebhookSecret(created.endpoint.id);
    expect(rotated.plainSecret).not.toBe(created.plainSecret);
    expect(rotated.endpoint.encryptedSecret).not.toBe(created.endpoint.encryptedSecret);
  });

  it('révèle et remplace un secret custom sans le stocker en clair', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.partner.com/hook',
      events: ['lead.created'],
    });
    await setWebhookSecret(endpoint.id, 'baiti-custom-secret-2026');
    const updated = await getWebhookEndpoint(endpoint.id);
    expect(updated?.encryptedSecret).not.toContain('baiti-custom-secret-2026');
    await expect(revealWebhookSecret(endpoint.id)).resolves.toBe('baiti-custom-secret-2026');
  });

  it('updateWebhookEndpoint patch active=false', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.partner.com/hook',
      events: ['lead.created'],
    });
    const updated = await updateWebhookEndpoint(endpoint.id, { active: false });
    expect(updated.active).toBe(false);
  });

  it('getWebhookEndpoint retourne null pour soft-deleted', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.partner.com/hook',
      events: ['lead.created'],
    });
    await deleteWebhookEndpoint(endpoint.id);
    expect(await getWebhookEndpoint(endpoint.id)).toBeNull();
  });
});
