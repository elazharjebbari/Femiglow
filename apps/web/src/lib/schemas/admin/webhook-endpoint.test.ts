import { describe, it, expect } from 'vitest';
import { webhookEndpointInputSchema } from './webhook-endpoint';

describe('webhookEndpointInputSchema', () => {
  it('accepte une URL HTTPS publique', () => {
    const result = webhookEndpointInputSchema.safeParse({
      url: 'https://api.partner.com/hook',
      events: ['lead.created'],
    });
    expect(result.success).toBe(true);
  });

  it('rejette HTTP', () => {
    const result = webhookEndpointInputSchema.safeParse({
      url: 'http://api.partner.com/hook',
      events: ['lead.created'],
    });
    expect(result.success).toBe(false);
  });

  it('rejette les IPs privées', () => {
    const result = webhookEndpointInputSchema.safeParse({
      url: 'https://192.168.1.1/hook',
      events: ['lead.created'],
    });
    expect(result.success).toBe(false);
  });

  it('rejette localhost', () => {
    const result = webhookEndpointInputSchema.safeParse({
      url: 'https://localhost:3000/hook',
      events: ['lead.created'],
    });
    expect(result.success).toBe(false);
  });

  it('exige au moins un événement', () => {
    const result = webhookEndpointInputSchema.safeParse({
      url: 'https://api.partner.com/hook',
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejette un événement inconnu', () => {
    const result = webhookEndpointInputSchema.safeParse({
      url: 'https://api.partner.com/hook',
      events: ['unknown.event'],
    });
    expect(result.success).toBe(false);
  });
});
