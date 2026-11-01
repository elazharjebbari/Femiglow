import { describe, expect, it } from 'vitest';

import { trafficWebhookFields } from './traffic-fields';

const createdAt = new Date('2026-11-02T10:00:00Z');
const fields = (
  over: Parameters<typeof trafficWebhookFields>[0] extends infer T ? Partial<T> : never,
  context?: string,
) => trafficWebhookFields({ createdAt, ...over }, context);

describe('trafficWebhookFields', () => {
  it.each([
    ['Instagram payant', { utm: { utm_source: 'ig', utm_medium: 'paid' } }, 'Instagram'],
    ['Facebook payant', { utm: { utm_source: 'fb', utm_medium: 'paid' } }, 'Facebook'],
    ['Meta autres', { utm: { utm_source: 'an', utm_medium: 'paid' } }, 'Facebook'],
    ['YouTube', { referrer: 'https://www.youtube.com/' }, 'YouTube'],
    ['Google Search', { referrer: 'https://www.google.com/' }, 'Google'],
    ['Google Ads', { gclid: 'abc' }, 'Google'],
    ['TikTok', { utm: { ttclid: 'x' } }, 'TikTok'],
    ['Snapchat', { utm: { sccid: 'x' } }, 'Snapchat'],
    ['ChatGPT', { referrer: 'https://chatgpt.com/' }, 'IA'],
    ['Autre IA', { referrer: 'https://www.perplexity.ai/' }, 'IA'],
    ['WhatsApp', { utm: { utm_source: 'whatsapp' } }, 'Whatsapp'],
    ['Pinterest', { utm: { epik: 'x' } }, 'Autre'],
    ['autre site', { referrer: 'https://exemple.ma/' }, 'Website'],
    ['accès direct', {}, 'Website'],
  ])('%s', (_name, input, source) => {
    expect(fields(input).source).toBe(source);
  });

  it('détaille canal, type et campagne', () => {
    expect(
      fields({ utm: { utm_source: 'ig', utm_medium: 'paid', utm_campaign: 'kit-angle-a' } })
        .source_channel,
    ).toBe('Instagram · Payant · kit-angle-a');
  });

  it('UTM Google sans support : payant, comme sur la note Google Ads', () => {
    expect(fields({ utm: { utm_source: 'google' } }).source_channel).toBe(
      'Google (autres) · Payant',
    );
  });

  it('accès direct : pas de type redondant', () => {
    expect(fields({}).source_channel).toBe('Accès direct');
  });

  it('une campagne longue ne dépasse pas la limite et garde le contexte', () => {
    const { source_channel } = fields(
      { utm: { utm_source: 'ig', utm_medium: 'paid', utm_campaign: 'c'.repeat(200) } },
      'abandon',
    );
    expect(source_channel).toHaveLength(60);
    expect(source_channel.endsWith(' · abandon')).toBe(true);
  });
});
