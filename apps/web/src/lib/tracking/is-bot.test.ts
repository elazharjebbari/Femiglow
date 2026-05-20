import { describe, expect, it } from 'vitest';

import { isBotRequest } from './is-bot';

const HUMAN_UAS: readonly string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
  'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G998B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
];

const BOT_UAS: readonly string[] = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  'HeadlessChrome/120.0.6099.71',
  'Mozilla/5.0 ... Pingdom Bot',
  'Mozilla/5.0 (compatible; PingdomPageSpeed/1.0; +http://www.pingdom.com/pagespeed.html)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0) Chrome/119 Safari/537.36 Bot',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Lighthouse',
];

describe('isBotRequest', () => {
  it.each(HUMAN_UAS)('returns false for human UA: %s', (ua) => {
    expect(isBotRequest(ua)).toBe(false);
  });

  it.each(BOT_UAS)('returns true for bot UA: %s', (ua) => {
    expect(isBotRequest(ua)).toBe(true);
  });

  it('returns true for empty / nullish UA', () => {
    expect(isBotRequest('')).toBe(true);
    expect(isBotRequest(null)).toBe(true);
    expect(isBotRequest(undefined)).toBe(true);
  });

  it('returns true for non-string input', () => {
    expect(isBotRequest(123 as unknown as string)).toBe(true);
    expect(isBotRequest({} as unknown as string)).toBe(true);
  });

  it('is case-insensitive (Googlebot vs googlebot vs GOOGLEBOT)', () => {
    expect(isBotRequest('Googlebot')).toBe(true);
    expect(isBotRequest('googlebot')).toBe(true);
    expect(isBotRequest('GOOGLEBOT')).toBe(true);
  });
});
