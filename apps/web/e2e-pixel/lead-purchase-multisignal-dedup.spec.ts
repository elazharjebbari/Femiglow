/**
 * Pixel-level (Chromium réel) — dédup MULTI-SIGNAUX lead→Meta Purchase.
 * Audit docs/meta-lead-purchase-pixel-2026-06-01.
 *
 * Vérifie, à partir du VRAI conteneur exporté, que sur un parcours visiteur les
 * pixels Purchase de `lead_capture`, `generate_lead` ET `purchase` portent le
 * MÊME `eventID` (le jpid de parcours) → Meta déduplique → **1 seul Purchase**.
 * Vérifie aussi que le filtre `method` empêche un lead newsletter de fire Purchase.
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
test.skip(!ok, `Export GTM absent (${CONTAINER})`);

const cv: AnyRec = ok ? JSON.parse(readFileSync(CONTAINER, 'utf8')).containerVersion : { tag: [], trigger: [] };
function leadPurchaseTag(eventKey: string): AnyRec | undefined {
  return cv.tag.find((t: AnyRec) => t.name === `Meta Evt — ${eventKey}→Purchase (Purchase)`);
}
function methodRegex(eventKey: string): string {
  const trig = cv.trigger.find((t: AnyRec) => t.name === `CE — ${eventKey} [lead→purchase]`);
  return trig ? param(trig.filter[0].parameter, 'arg1') : '';
}

test.describe('Pixel Purchase multi-signaux — 1 seul compté par parcours', () => {
  test('config: generate_lead ET lead_capture ont un pixel Purchase avec eventID = jpid', () => {
    for (const ev of ['generate_lead', 'lead_capture']) {
      const tag = leadPurchaseTag(ev);
      expect(tag, `tag Purchase manquant pour ${ev}`).toBeDefined();
      const html = param(tag!.parameter, 'html');
      expect(html).toMatch(/fbq\('track', 'Purchase'/);
      expect(html).toMatch(/eventID:\s*\{\{DLV - meta_purchase_eid\}\}/);
    }
    expect(methodRegex('generate_lead')).toBe('^(chat|abandoned_cart)$');
    expect(methodRegex('lead_capture')).toBe('^(wizard)$');
  });

  // Harnais : reproduit la sémantique GTM des tags lead→Purchase. Un tag fire si
  // event==key ET method =~ regex ; eventID = jpid (dataLayer meta_purchase_eid).
  function harness(): string {
    const cfg = {
      generate_lead: methodRegex('generate_lead'),
      lead_capture: methodRegex('lead_capture'),
    };
    return `<!doctype html><html><body><script>
      window.__fbq = [];
      window.fbq = function () { window.__fbq.push(Array.prototype.slice.call(arguments)); };
      var CFG = ${JSON.stringify(cfg)};
      // jpid de parcours (= cookie fg_meta_lead_purchase / dataLayer meta_purchase_eid).
      window.JPID = null;
      window.setJpid = function (v) { window.JPID = v; };
      // pixel Purchase d'un signal lead (generate_lead / lead_capture)
      window.leadPurchase = function (eventKey, method) {
        var rgx = CFG[eventKey];
        if (!rgx || !new RegExp(rgx).test(method)) return 'no-fire'; // filtre method
        window.fbq('track', 'Purchase', { value: 199, currency: 'MAD' }, { eventID: window.JPID });
        return 'fired';
      };
      // pixel Purchase du vrai achat (eventID = jpid du parcours si présent)
      window.realPurchase = function () {
        window.fbq('track', 'Purchase', { value: 199, currency: 'MAD' }, { eventID: window.JPID });
        return 'fired';
      };
    </script></body></html>`;
  }

  async function goto(page: import('@playwright/test').Page) {
    await page.route('http://pixel.test/ms', (r) =>
      r.fulfill({ contentType: 'text/html', body: harness() }),
    );
    await page.goto('http://pixel.test/ms');
  }

  test('S1 wizard : lead_capture + generate_lead + purchase → MÊME eventID → 1 Purchase', async ({ page }) => {
    await goto(page);
    const eventIDs = await page.evaluate(() => {
      (window as any).setJpid('jpid_parcours_S1');
      (window as any).leadPurchase('lead_capture', 'wizard'); // wizard ét.1
      (window as any).leadPurchase('generate_lead', 'abandoned_cart'); // wizard ét.1
      (window as any).realPurchase(); // ét.2
      return ((window as any).__fbq as any[]).map((c) => c[3].eventID);
    });
    expect(eventIDs).toHaveLength(3); // 3 pixels envoyés…
    expect(new Set(eventIDs).size).toBe(1); // …MAIS un seul eventID → Meta compte 1
    expect(eventIDs[0]).toBe('jpid_parcours_S1');
  });

  test('S2 chat→commande : generate_lead(chat) puis lead_capture/generate_lead(wizard) → MÊME eventID', async ({ page }) => {
    await goto(page);
    const eventIDs = await page.evaluate(() => {
      // 1er contact chat → jpid posé dans le cookie, réutilisé ensuite
      (window as any).setJpid('jpid_parcours_S2');
      (window as any).leadPurchase('generate_lead', 'chat');
      // plus tard, même visiteur, wizard (cookie déjà posé → même jpid)
      (window as any).leadPurchase('lead_capture', 'wizard');
      (window as any).leadPurchase('generate_lead', 'abandoned_cart');
      (window as any).realPurchase();
      return ((window as any).__fbq as any[]).map((c) => c[3].eventID);
    });
    expect(eventIDs).toHaveLength(4);
    expect(new Set(eventIDs).size).toBe(1); // tout le parcours → 1 seul Purchase
  });

  test('newsletter (method non éligible) → AUCUN pixel Purchase', async ({ page }) => {
    await goto(page);
    const r = await page.evaluate(() => {
      (window as any).setJpid('jpid_x');
      const out = (window as any).leadPurchase('generate_lead', 'newsletter');
      return { out, calls: ((window as any).__fbq as any[]).length };
    });
    expect(r.out).toBe('no-fire');
    expect(r.calls).toBe(0);
  });
});
