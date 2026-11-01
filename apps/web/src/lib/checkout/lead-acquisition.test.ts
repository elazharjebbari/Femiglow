import { describe, expect, it } from 'vitest';

import {
  googleAdsWebhookNote,
  isGoogleAdsLead,
  utmFromRequestSignals,
} from './lead-acquisition';

describe('isGoogleAdsLead', () => {
  it.each([
    ['gclid', { gclid: 'abc' }],
    ['gbraid (iPhone)', { utm: { gbraid: 'x' } }],
    ['wbraid (iPhone)', { utm: { wbraid: 'x' } }],
    ['UTM Google cpc', { utm: { utm_source: 'google', utm_medium: 'cpc' } }],
    ['casse différente', { utm: { utm_source: 'Google', utm_medium: 'CPC' } }],
    ['UTM Google sans support', { utm: { utm_source: 'google' } }],
  ])('%s : Google Ads', (_name, lead) => {
    expect(isGoogleAdsLead(lead)).toBe(true);
  });

  it.each([
    ['sans donnée', {}],
    ['valeurs nulles', { gclid: null, utm: null }],
    ['Meta', { utm: { utm_source: 'facebook', utm_medium: 'paid' } }],
    ['Google gratuit', { utm: { utm_source: 'google', utm_medium: 'organic' } }],
    ['e-mail Google', { utm: { utm_source: 'google', utm_medium: 'email' } }],
    ['autre site contenant google', { utm: { utm_source: 'mygoogle.blog' } }],
  ])('%s : pas Google Ads', (_name, lead) => {
    expect(isGoogleAdsLead(lead)).toBe(false);
  });
});

describe('googleAdsWebhookNote', () => {
  it('avec campagne', () => {
    expect(googleAdsWebhookNote({ gclid: 'a', utm: { utm_campaign: 'kit-maroc' } })).toBe(
      'source:Google Ads campagne:kit-maroc',
    );
  });

  it('auto-tagging seul : Google Ads, sans campagne inventée', () => {
    expect(googleAdsWebhookNote({ gclid: 'a' })).toBe('source:Google Ads');
  });

  it('hors Google Ads : rien', () => {
    expect(googleAdsWebhookNote({ utm: { utm_source: 'tiktok' } })).toBeNull();
  });
});

describe('utmFromRequestSignals', () => {
  it('garde UTM et clics publicitaires', () => {
    expect(
      utmFromRequestSignals({
        utm: { source: 'google', campaign: 'kit' },
        clickIds: { gbraid: 'g', fbclid: 'f' },
      }),
    ).toEqual({ utm_source: 'google', utm_campaign: 'kit', gbraid: 'g', fbclid: 'f' });
  });

  it('rien à conserver : undefined', () => {
    expect(utmFromRequestSignals({ utm: {}, clickIds: {} })).toBeUndefined();
  });
});
