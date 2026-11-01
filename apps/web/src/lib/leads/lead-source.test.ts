import { describe, expect, it } from 'vitest';

import { classifyLeadSource, referrerHost, SOURCE_CAPTURE_SINCE } from './lead-source';

const now = new Date(SOURCE_CAPTURE_SINCE.getTime() + 1000);
const old = new Date('2026-10-20T10:00:00Z');
const source = (input: Parameters<typeof classifyLeadSource>[0]) => {
  const { channel, kind } = classifyLeadSource(input);
  return `${channel}/${kind}`;
};

describe('referrerHost', () => {
  it.each([
    ['https://www.google.com/search?q=x', 'google.com'],
    ['https://l.facebook.com/l.php?u=x', 'facebook.com'],
    ['http://m.facebook.com/', 'facebook.com'],
    ['android-app://com.instagram.android/', 'com.instagram.android'],
    ['pas une url', null],
    ['', null],
    [null, null],
  ])('%s', (input, expected) => {
    expect(referrerHost(input)).toBe(expected);
  });
});

describe('annonces', () => {
  it.each([
    ['Google Search', { gclid: 'a', referrer: 'https://www.google.co.ma/' }, 'google_search/paid'],
    ['YouTube', { gclid: 'a', referrer: 'https://www.youtube.com/' }, 'youtube/paid'],
    ['YouTube par UTM', { gclid: 'a', utm: { utm_source: 'youtube' } }, 'youtube/paid'],
    ['Google sans site', { gclid: 'a' }, 'google_other/paid'],
    ['Google Display', { gclid: 'a', referrer: 'https://randomblog.ma/' }, 'google_other/paid'],
    ['Google iPhone', { utm: { gbraid: 'x' } }, 'google_other/paid'],
    ['Google iPhone web', { utm: { wbraid: 'x' }, referrer: 'https://google.com/' }, 'google_search/paid'],
    ['UTM Google', { utm: { utm_source: 'google', utm_medium: 'cpc' } }, 'google_other/paid'],
    ['UTM Google + recherche', { utm: { utm_source: 'google', utm_medium: 'cpc' }, referrer: 'https://www.google.com/' }, 'google_search/paid'],
    ['TikTok', { utm: { ttclid: 'x' } }, 'tiktok/paid'],
    ['Snapchat', { utm: { sccid: 'x' } }, 'snapchat/paid'],
    ['Bing', { utm: { msclkid: 'x' } }, 'bing/paid'],
    ['Instagram UTM', { utm: { utm_source: 'ig', utm_medium: 'paid' } }, 'instagram/paid'],
    ['Facebook UTM', { utm: { utm_source: 'fb', utm_medium: 'paid' } }, 'facebook/paid'],
    ['Meta précisé par le site', { utm: { utm_source: 'meta', utm_medium: 'paid' }, referrer: 'https://instagram.com/' }, 'instagram/paid'],
    ['Meta sans site', { utm: { utm_source: 'meta', utm_medium: 'paid' } }, 'meta_other/paid'],
    ['Messenger', { utm: { utm_source: 'msg', utm_medium: 'paid' } }, 'meta_other/paid'],
    ['Meta : clic et campagne', { utm: { fbclid: 'x', utm_content: 'A-1' }, referrer: 'https://instagram.com/' }, 'instagram/paid'],
    ['TikTok UTM', { utm: { utm_source: 'tiktok', utm_medium: 'cpc' } }, 'tiktok/paid'],
  ])('%s', (_name, input, expected) => {
    expect(source({ createdAt: now, ...input })).toBe(expected);
  });
});

describe('organique', () => {
  it.each([
    ['Google Search', 'https://www.google.com/', 'google_search/organic'],
    ['Google Maroc', 'https://www.google.co.ma/', 'google_search/organic'],
    ['YouTube', 'https://youtube.com/', 'youtube/organic'],
    ['Instagram', 'https://instagram.com/', 'instagram/organic'],
    ['application Instagram', 'android-app://com.instagram.android/', 'instagram/organic'],
    ['Facebook', 'https://l.facebook.com/', 'facebook/organic'],
    ['Threads', 'https://threads.net/', 'meta_other/organic'],
    ['TikTok', 'https://www.tiktok.com/', 'tiktok/organic'],
    ['Snapchat', 'https://www.snapchat.com/', 'snapchat/organic'],
    ['Google, autre service', 'https://tagassistant.google.com/', 'google_other/organic'],
    ['Bing', 'https://www.bing.com/', 'bing/organic'],
    ['DuckDuckGo', 'https://duckduckgo.com/', 'other_search/organic'],
    ['autre site', 'https://blog-beaute.ma/', 'other_site/organic'],
    ['WhatsApp', 'https://wa.me/', 'whatsapp/organic'],
  ])('%s', (_name, referrer, expected) => {
    expect(source({ createdAt: now, referrer })).toBe(expected);
  });

  it('un UTM gratuit reste organique', () => {
    expect(
      source({ createdAt: now, utm: { utm_source: 'instagram', utm_medium: 'social' } }),
    ).toBe('instagram/organic');
  });
});

describe('IA', () => {
  it.each([
    ['ChatGPT', 'https://chatgpt.com/', 'chatgpt/ai'],
    ['ChatGPT ancien', 'https://chat.openai.com/', 'chatgpt/ai'],
    ['Perplexity', 'https://www.perplexity.ai/', 'ai_other/ai'],
    ['Claude', 'https://claude.ai/', 'ai_other/ai'],
    ['Gemini, pas Google', 'https://gemini.google.com/', 'ai_other/ai'],
    ['Copilot, pas Bing', 'https://copilot.microsoft.com/', 'ai_other/ai'],
  ])('%s', (_name, referrer, expected) => {
    expect(source({ createdAt: now, referrer })).toBe(expected);
  });

  it('UTM ajouté par ChatGPT', () => {
    expect(source({ createdAt: now, utm: { utm_source: 'chatgpt.com' } })).toBe('chatgpt/ai');
  });

  it('reconnue aussi sur un ancien lead : le site d’origine suffit', () => {
    expect(source({ createdAt: old, referrer: 'https://chatgpt.com/' })).toBe('chatgpt/ai');
  });
});

describe('ne devine jamais', () => {
  it.each([
    ['ancien lead Google : annonce possible', 'https://www.google.com/', 'google_search/unknown'],
    ['ancien lead Instagram', 'https://instagram.com/', 'instagram/unknown'],
    ['ancien lead YouTube', 'https://youtube.com/', 'youtube/unknown'],
  ])('%s', (_name, referrer, expected) => {
    expect(source({ createdAt: old, referrer })).toBe(expected);
  });

  it('`fbclid` seul existe aussi sur les liens gratuits', () => {
    expect(
      source({ createdAt: now, utm: { fbclid: 'x' }, referrer: 'https://instagram.com/' }),
    ).toBe('instagram/unknown');
  });

  it('ancien lead sans site d’origine : non tracé, pas direct', () => {
    expect(source({ createdAt: old })).toBe('unknown/unknown');
  });

  it('ancien lead dont le référent est le site lui-même', () => {
    expect(source({ createdAt: old, referrer: 'https://femiglow-maroc.com/kit' })).toBe(
      'unknown/unknown',
    );
  });

  it('nouveau lead sans aucune trace : direct', () => {
    expect(source({ createdAt: now })).toBe('direct/direct');
    expect(source({ createdAt: now, referrer: 'https://femiglow-maroc.com/kit' })).toBe(
      'direct/direct',
    );
  });

  it('campagne et site conservés pour le détail', () => {
    expect(
      classifyLeadSource({
        createdAt: now,
        gclid: 'a',
        utm: { utm_campaign: ' kit-maroc ' },
        referrer: 'https://www.google.com/search',
      }),
    ).toEqual({ channel: 'google_search', kind: 'paid', campaign: 'kit-maroc', site: 'google.com' });
  });
});
