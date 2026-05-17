/**
 * CHA-SNAP — Script de test live du pixel Snapchat (v3 CAPI).
 *
 * Envoie directement à l'API Snap Conversions v3 pour valider que chaque
 * événement mappé est accepté avec le bon format (action_source, user_data,
 * custom_data, dedup).
 *
 * UTILISATION :
 *   SNAP_CAPI_TOKEN=your_token npx tsx scripts/test-snap-capi-live.ts
 *
 * Le token se trouve dans l'admin UI ou via l'API reveal-token.
 * Pixel ID : 9bd26a82-3ecf-42aa-a3de-85df14c74a11
 * Test Event Code : TEST11989
 */

const SNAP_PIXEL_ID = '9bd26a82-3ecf-42aa-a3de-85df14c74a11';
const SNAP_CAPI_TOKEN = process.env.SNAP_CAPI_TOKEN || '';
const TEST_EVENT_CODE = 'SNAP-TEST-001';

const now = Math.floor(Date.now() / 1000);

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface SnapEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: string;
  user_data: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
}

interface TestCase {
  name: string;
  fgEvent: string;
  snapEvent: string;
  event: SnapEvent;
}

async function buildTestCases(): Promise<TestCase[]> {
  const testEmail = 'snap-test@femiglow.ma';
  const testPhone = '+212600000000';
  const testFirstName = 'Sara';
  const testLastName = 'El Amrani';
  const testCity = 'Casablanca';
  const testCountry = 'MA';

  const em = await sha256(testEmail.trim().toLowerCase());
  const ph = await sha256(testPhone.replace(/[^0-9+]/g, ''));
  const fn = await sha256(testFirstName.trim().toLowerCase());
  const ln = await sha256(testLastName.trim().toLowerCase());
  const ct = await sha256(testCity.trim().toLowerCase());
  const country = await sha256(testCountry.trim().toLowerCase());

  const baseUserData = {
    em: [em],
    ph: [ph],
    fn: [fn],
    ln: [ln],
    ct,
    country,
    client_ip_address: '197.230.0.0',
    client_user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
  };

  const baseUrl = 'https://femiglow-maroc.com';

  return [
    {
      name: '1. PAGE_VIEW — Page d\'accueil',
      fgEvent: 'page_view',
      snapEvent: 'PAGE_VIEW',
      event: {
        event_name: 'PAGE_VIEW',
        event_time: now,
        event_id: `snap-test-pageview-${Date.now()}`,
        event_source_url: `${baseUrl}/`,
        action_source: 'website',
        user_data: {
          client_ip_address: '197.230.0.0',
          client_user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
        custom_data: {
          client_deduplication_id: `snap-test-pageview-${Date.now()}`,
        },
      },
    },
    {
      name: '2. VIEW_CONTENT — Fiche produit',
      fgEvent: 'view_item',
      snapEvent: 'VIEW_CONTENT',
      event: {
        event_name: 'VIEW_CONTENT',
        event_time: now,
        event_id: `snap-test-viewcontent-${Date.now()}`,
        event_source_url: `${baseUrl}/kit`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 399,
          content_ids: ['kit_fg_01'],
          content_category: 'beauty',
          number_items: 1,
          client_deduplication_id: `snap-test-viewcontent-${Date.now()}`,
          uuid_c1: 'anon_snap_test',
        },
      },
    },
    {
      name: '3. ADD_CART — Ajout au panier',
      fgEvent: 'add_to_cart',
      snapEvent: 'ADD_CART',
      event: {
        event_name: 'ADD_CART',
        event_time: now,
        event_id: `snap-test-addcart-${Date.now()}`,
        event_source_url: `${baseUrl}/kit`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 399,
          content_ids: ['kit_fg_01'],
          content_category: 'beauty',
          number_items: 1,
          client_deduplication_id: `snap-test-addcart-${Date.now()}`,
          uuid_c1: 'anon_snap_test',
        },
      },
    },
    {
      name: '4. START_CHECKOUT — Début checkout',
      fgEvent: 'begin_checkout',
      snapEvent: 'START_CHECKOUT',
      event: {
        event_name: 'START_CHECKOUT',
        event_time: now,
        event_id: `snap-test-startcheckout-${Date.now()}`,
        event_source_url: `${baseUrl}/checkout`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 399,
          content_ids: ['kit_fg_01'],
          content_category: 'beauty',
          number_items: 1,
          client_deduplication_id: `snap-test-startcheckout-${Date.now()}`,
          uuid_c1: 'anon_snap_test',
        },
      },
    },
    {
      name: '5. ADD_BILLING — Infos paiement',
      fgEvent: 'add_payment_info',
      snapEvent: 'ADD_BILLING',
      event: {
        event_name: 'ADD_BILLING',
        event_time: now,
        event_id: `snap-test-addbilling-${Date.now()}`,
        event_source_url: `${baseUrl}/checkout`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 399,
          payment_type: 'cod',
          client_deduplication_id: `snap-test-addbilling-${Date.now()}`,
          uuid_c1: 'anon_snap_test',
        },
      },
    },
    {
      name: '6. PURCHASE — Conversion achat (avec attribution Snap)',
      fgEvent: 'purchase',
      snapEvent: 'PURCHASE',
      event: {
        event_name: 'PURCHASE',
        event_time: now,
        event_id: `snap-test-purchase-${Date.now()}`,
        event_source_url: `${baseUrl}/merci`,
        action_source: 'website',
        user_data: {
          ...baseUserData,
          sc_click_id: 'snap_click_test_attribution_123',
        },
        custom_data: {
          currency: 'MAD',
          value: 399,
          content_ids: ['kit_fg_01'],
          content_category: 'beauty',
          number_items: 1,
          transaction_id: `order-snap-test-${Date.now()}`,
          client_deduplication_id: `snap-test-purchase-${Date.now()}`,
          uuid_c1: 'anon_snap_test',
        },
      },
    },
    {
      name: '7. SIGN_UP — Inscription',
      fgEvent: 'sign_up',
      snapEvent: 'SIGN_UP',
      event: {
        event_name: 'SIGN_UP',
        event_time: now,
        event_id: `snap-test-signup-${Date.now()}`,
        event_source_url: `${baseUrl}/`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 0,
          client_deduplication_id: `snap-test-signup-${Date.now()}`,
          uuid_c1: 'anon_snap_test',
        },
      },
    },
    {
      name: '8. LEAD — Chat lead form submit',
      fgEvent: 'chat_lead_form_submit',
      snapEvent: 'LEAD',
      event: {
        event_name: 'LEAD',
        event_time: now,
        event_id: `snap-test-lead-${Date.now()}`,
        event_source_url: `${baseUrl}/kit`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 0,
          client_deduplication_id: `snap-test-lead-${Date.now()}`,
          uuid_c1: 'anon_snap_test',
        },
      },
    },
  ];
}

async function sendEvent(testCase: TestCase): Promise<{ status: number; body: string }> {
  const url = `https://tr.snapchat.com/v3/${SNAP_PIXEL_ID}/events?access_token=${encodeURIComponent(SNAP_CAPI_TOKEN)}`;
  const payload = {
    data: [testCase.event],
    test_event_code: TEST_EVENT_CODE,
  };

  console.log(`\n→ ${testCase.name}`);
  console.log(`  FemiGlow : ${testCase.fgEvent}`);
  console.log(`  Snap     : ${testCase.snapEvent}`);
  console.log(`  event_id : ${testCase.event.event_id}`);
  console.log(`  action_source : ${testCase.event.action_source}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    const status = response.status;

    if (response.ok) {
      console.log(`  ✅ HTTP ${status} — Succès`);
      try {
        const parsed = JSON.parse(body);
        if (parsed.errors?.length) {
          console.log(`  ⚠️  Erreurs Snap: ${JSON.stringify(parsed.errors)}`);
        }
      } catch {}
    } else {
      console.log(`  ❌ HTTP ${status} — Échec`);
      console.log(`  Réponse: ${body.slice(0, 300)}`);
    }

    return { status, body };
  } catch (err) {
    console.log(`  ❌ Erreur réseau: ${err instanceof Error ? err.message : String(err)}`);
    return { status: 0, body: String(err) };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  CHA-SNAP — Test live du pixel Snapchat (CAPI v3)           ║');
  console.log('║  Pixel ID : 9bd26a82-3ecf-42aa-a3de-85df14c74a11           ║');
  console.log('║  Test Code : SNAP-TEST-001                                 ║');
  console.log('║  action_source : website (v3 spec)                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  if (!SNAP_CAPI_TOKEN) {
    console.error('❌ SNAP_CAPI_TOKEN manquant. Définissez la variable d\'environnement :');
    console.error('   SNAP_CAPI_TOKEN=your_token npx tsx scripts/test-snap-capi-live.ts');
    process.exit(1);
  }

  console.log(`Token: ${SNAP_CAPI_TOKEN.slice(0, 8)}...${SNAP_CAPI_TOKEN.slice(-4)} (${SNAP_CAPI_TOKEN.length} chars)`);

  const testCases = await buildTestCases();

  console.log(`\nEnvoi de ${testCases.length} événements de test au pixel Snap (format CAPI v3)...\n`);

  const results: Array<{ name: string; success: boolean; status: number }> = [];

  for (const tc of testCases) {
    const result = await sendEvent(tc);
    results.push({
      name: tc.name,
      success: result.status >= 200 && result.status < 300,
      status: result.status,
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RÉSUMÉ                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const successes = results.filter(r => r.success).length;
  const failures = results.filter(r => !r.success).length;

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.name} (HTTP ${r.status})`);
  }

  console.log(`\n  Total : ${results.length} | Succès : ${successes} | Échecs : ${failures}`);

  if (failures > 0) {
    console.log('\n⚠️  Certains événements ont échoué. Vérifiez :');
    console.log('   1. Le CAPI token est valide et actif');
    console.log('   2. Le pixel ID est correct');
    console.log('   3. action_source = "website" (pas "WEB")');
    console.log('   4. Les hashes SHA-256 sont normalisés (lowercase, trim)');
    console.log('   5. Le domaine est autorisé dans Snap Ads Manager');
  } else {
    console.log('\n✅ Tous les événements ont été envoyés avec succès !');
    console.log('\nProchaine étape : vérifiez dans Snap Events Manager');
    console.log('que les événements apparaissent avec les bons noms et données.');
  }
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});