import { describe, expect, it } from 'vitest';
import { detectChannel, isAttributionChannel } from './channel-detector';

const NOW = new Date('2026-05-15T12:00:00Z');

function det(url: string, referrer?: string) {
  return detectChannel({ url, referrer, now: NOW });
}

describe('detectChannel — click IDs (priorité absolue)', () => {
  it('gclid → google_ads', () => {
    const t = det('https://femiglow-maroc.com/?gclid=abc');
    expect(t.channel).toBe('google_ads');
    expect(t.is_paid).toBe(true);
    expect(t.click_id_field).toBe('gclid');
    expect(t.click_id).toBe('abc');
  });
  it('gbraid → google_ads', () => {
    expect(det('https://x.com/?gbraid=xyz').click_id_field).toBe('gbraid');
  });
  it('wbraid → google_ads', () => {
    expect(det('https://x.com/?wbraid=zzz').click_id_field).toBe('wbraid');
  });
  it('fbclid → meta', () => {
    const t = det('https://x.com/?fbclid=fb1');
    expect(t.channel).toBe('meta');
    expect(t.click_id_field).toBe('fbclid');
  });
  it('ttclid → tiktok', () => {
    expect(det('https://x.com/?ttclid=tt1').channel).toBe('tiktok');
  });
  it('sccid → snap', () => {
    expect(det('https://x.com/?sccid=sn1').channel).toBe('snap');
  });
  it('ScCid → snap (casse officielle Snap)', () => {
    const t = det('https://x.com/?ScCid=sn2');
    expect(t.channel).toBe('snap');
    expect(t.click_id_field).toBe('sccid');
    expect(t.click_id).toBe('sn2');
  });
  it('epik → pinterest', () => {
    expect(det('https://x.com/?epik=p1').channel).toBe('pinterest');
  });
  it('msclkid → bing_ads', () => {
    expect(det('https://x.com/?msclkid=b1').channel).toBe('bing_ads');
  });
  it('gclid + fbclid coexistants → gclid gagne (priorité)', () => {
    expect(det('https://x.com/?gclid=g&fbclid=f').channel).toBe('google_ads');
  });
});

describe('detectChannel — UTM paid', () => {
  it('utm_source=google + utm_medium=cpc → google_ads', () => {
    const t = det('https://x.com/?utm_source=google&utm_medium=cpc&utm_campaign=brand');
    expect(t.channel).toBe('google_ads');
    expect(t.is_paid).toBe(true);
    expect(t.utm?.campaign).toBe('brand');
    expect(t.click_id).toBeUndefined();
  });
  it('utm_source=instagram + utm_medium=paid → meta (IG = Meta)', () => {
    expect(det('https://x.com/?utm_source=instagram&utm_medium=paid').channel).toBe('meta');
  });
  it('utm_source=tiktok + utm_medium=cpv → tiktok', () => {
    expect(det('https://x.com/?utm_source=tiktok&utm_medium=cpv').channel).toBe('tiktok');
  });
  it('utm_source=google + utm_medium=organic → fallback (utm non paid)', () => {
    // medium "organic" pas dans le regex paid → on tombe sur direct si pas de referrer
    expect(det('https://x.com/?utm_source=google&utm_medium=organic').channel).toBe('direct');
  });
});

describe('detectChannel — email & newsletter', () => {
  it('utm_medium=email → email', () => {
    const t = det('https://x.com/?utm_medium=email&utm_source=listmonk');
    expect(t.channel).toBe('email');
    expect(t.is_paid).toBe(false);
  });
  it('utm_source=newsletter → email', () => {
    expect(det('https://x.com/?utm_source=newsletter').channel).toBe('email');
  });
});

describe('detectChannel — referrer fallback', () => {
  it('referrer Google → organic', () => {
    expect(det('https://x.com/', 'https://google.com/search?q=femiglow').channel).toBe('organic');
  });
  it('referrer Bing → organic', () => {
    expect(det('https://x.com/', 'https://www.bing.com/search?q=foo').channel).toBe('organic');
  });
  it('referrer Facebook (sans fbclid) → social_organic', () => {
    expect(det('https://x.com/', 'https://www.facebook.com/page/femiglow').channel).toBe(
      'social_organic',
    );
  });
  it('referrer YouTube → social_organic', () => {
    expect(det('https://x.com/', 'https://www.youtube.com/').channel).toBe('social_organic');
  });
  it('referrer inconnu → direct', () => {
    expect(det('https://x.com/', 'https://random-blog.example.com/').channel).toBe('direct');
  });
});

describe('detectChannel — fallback', () => {
  it('aucun signal → direct', () => {
    const t = det('https://femiglow-maroc.com/kit');
    expect(t.channel).toBe('direct');
    expect(t.is_paid).toBe(false);
    expect(t.landing_path).toBe('/kit');
  });
  it('referrer malformé → ignoré, retourne direct', () => {
    expect(det('https://x.com/', 'not_a_url').channel).toBe('direct');
  });
});

describe('isAttributionChannel guard', () => {
  it('reconnaît les canaux valides', () => {
    expect(isAttributionChannel('google_ads')).toBe(true);
    expect(isAttributionChannel('direct')).toBe(true);
  });
  it('rejette les autres strings', () => {
    expect(isAttributionChannel('foobar')).toBe(false);
    expect(isAttributionChannel('')).toBe(false);
  });
});
