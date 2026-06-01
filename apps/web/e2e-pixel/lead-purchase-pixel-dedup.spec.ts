/**
 * Pixel-level (navigateur réel Chromium) — anti-doublon lead→Meta Purchase.
 * Audit meta-lead-as-purchase-2026-06-01.
 *
 * On charge le VRAI conteneur GTM exporté (`draft/container.production.*.json`)
 * et on rejoue, dans un vrai navigateur, la sémantique du trigger de blocage :
 *  - le pixel Meta `Purchase` du vrai achat est BLOQUÉ quand le cookie
 *    `fg_meta_lead_purchase` est posé (un lead a déjà compté en CAPI) → 0 doublon ;
 *  - sans cookie, il fire 1× avec `eventID` = event_id du dataLayer → dédup
 *    native Pixel↔CAPI (la CAPI envoie le MÊME event_id côté serveur, cf. Fix A).
 *
 * Le comportement testé est DÉRIVÉ de l'artefact exporté (nom de cookie, regex,
 * event), pas codé en dur → si l'exporter change la règle, le test suit.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const CONTAINER = path.resolve(
  process.cwd(),
  '../../draft/container.production.lead-purchase-bridge.json',
);

type AnyRec = Record<string, any>;
const param = (arr: AnyRec[], key: string) => arr.find((p) => p.key === key)?.value;

const ok = existsSync(CONTAINER);
test.skip(!ok, `Export GTM absent (${CONTAINER}) — lancer scripts/export-active-plan.ts`);

// ── Parse de l'artefact réel → règle de blocage du pixel Purchase ──────────
const cv: AnyRec = ok ? JSON.parse(readFileSync(CONTAINER, 'utf8')).containerVersion : { tag: [], trigger: [], variable: [] };
const purchaseTag: AnyRec | undefined = cv.tag.find((t: AnyRec) => /Meta Evt — purchase/i.test(t.name));
const blockId: string | undefined = purchaseTag?.blockingTriggerId?.[0];
const blk: AnyRec | undefined = cv.trigger.find((t: AnyRec) => t.triggerId === blockId);
const evName: string = blk ? param(blk.customEventFilter[0].parameter, 'arg1') : '';
const cookieTpl: string = blk ? param(blk.filter[0].parameter, 'arg0') : '';
const regex: string = blk ? param(blk.filter[0].parameter, 'arg1') : '';
const cookieVarName = cookieTpl.replace(/^\{\{|\}\}$/g, '');
const cookieVar: AnyRec | undefined = cv.variable.find((v: AnyRec) => v.name === cookieVarName);
const cookieName: string = cookieVar ? param(cookieVar.parameter, 'name') : '';
const pixelHtml: string = purchaseTag ? param(purchaseTag.parameter, 'html') : '';

// URL réelle (origine http) servie via page.route → `document.cookie` autorisé
// (impossible avec setContent/data: qui ont une origine opaque).
const HARNESS_URL = 'http://pixel.test/harness';
async function gotoHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.route(HARNESS_URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: harness(cookieName, regex, evName) }),
  );
  await page.goto(HARNESS_URL);
}

/** Mini-moteur GTM fidèle, injecté dans la page (fbq mocké, règle BLK réelle). */
function harness(cookie: string, rgx: string, ev: string): string {
  return `<!doctype html><html><body><script>
    window.__fbq = [];
    window.fbq = function () { window.__fbq.push(Array.prototype.slice.call(arguments)); };
    // Sémantique GTM du tag "Meta Evt — purchase" :
    //   firingTrigger = CE — ${ev}  |  blockingTrigger = BLK (cookie =~ /${rgx}/)
    //   → fire SAUF si le cookie est présent.
    window.gtmPurchase = function (event, eventId) {
      if (event !== ${JSON.stringify(ev)}) return 'no-match';
      var m = document.cookie.match(new RegExp('(?:^|; )' + ${JSON.stringify(cookie)} + '=([^;]*)'));
      var cookieVal = m ? decodeURIComponent(m[1]) : '';
      var blocked = new RegExp(${JSON.stringify(rgx)}).test(cookieVal);
      if (blocked) return 'blocked';
      window.fbq('track', 'Purchase', { value: 199, currency: 'MAD' }, { eventID: eventId });
      return 'fired';
    };
  </script></body></html>`;
}

test.describe('Pixel Meta Purchase — anti-doublon (navigateur réel)', () => {
  test('config: le pixel Purchase est bloquable par cookie + porte un eventID (dédup native)', () => {
    expect(blockId, 'le tag Meta purchase doit avoir un blockingTriggerId').toBeTruthy();
    expect(evName).toBe('purchase');
    expect(cookieName).toBe('fg_meta_lead_purchase');
    expect(regex).toBe('.+');
    expect(pixelHtml).toMatch(/eventID:\s*\{\{DLV - event_id\}\}/);
  });

  test('A. SANS cookie → le pixel Purchase fire 1× avec eventID = event_id client', async ({ page }) => {
    await gotoHarness(page);
    const r = await page.evaluate(() => (window as any).gtmPurchase('purchase', 'evt_client_A'));
    expect(r).toBe('fired');
    const calls = await page.evaluate(() => (window as any).__fbq as any[]);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('track');
    expect(calls[0][1]).toBe('Purchase');
    expect(calls[0][3].eventID).toBe('evt_client_A');
  });

  test('B. cookie fg_meta_lead_purchase posé (lead déjà compté) → pixel Purchase BLOQUÉ (0 doublon)', async ({ page }) => {
    await gotoHarness(page);
    // reproduit markLeadAsPurchaseCookie() : `${cookieName}=1; path=/; max-age=...; SameSite=Lax`
    await page.evaluate((n) => {
      document.cookie = `${n}=1; path=/; max-age=86400; SameSite=Lax`;
    }, cookieName);
    const r = await page.evaluate(() => (window as any).gtmPurchase('purchase', 'evt_client_B'));
    expect(r).toBe('blocked');
    const calls = await page.evaluate(() => (window as any).__fbq as any[]);
    expect(calls).toHaveLength(0); // le Purchase du lead (CAPI) reste le seul compté
  });

  test('C. dédup native : le pixel envoie eventID = event_id du dataLayer (= celui de la CAPI)', async ({ page }) => {
    await gotoHarness(page);
    await page.evaluate(() => (window as any).gtmPurchase('purchase', 'evt_shared_42'));
    const calls = await page.evaluate(() => (window as any).__fbq as any[]);
    // Fix A : pour un achat normal, la CAPI serveur envoie le MÊME event_id client
    // → Pixel(eventID) == CAPI(event_id) → Meta compte 1 seul Purchase.
    expect(calls[0][3].eventID).toBe('evt_shared_42');
  });
});
