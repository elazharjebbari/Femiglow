/**
 * CHA-SNAP — Script de test live du pixel Snapchat.
 *
 * Ce script envoie de vrais événements au pixel Snapchat en mode test
 * pour valider que le pixel est correctement configuré en production.
 *
 * UTILISATION :
 *   npx tsx scripts/test-snap-pixel-live.ts
 *
 * Le script envoie chaque événement mappé via l'API Conversions v3 de
 * Snapchat et affiche la réponse HTTP pour vérification manuelle dans
 * le Snap Ads Manager (Events Manager).
 *
 * PRÉREQUIS :
 *   - SNAP_CAPI_TOKEN configuré dans la table tracking_providers
 *   - Pixel ID : 9bd26a82-3ecf-42aa-a3de-85df14c74a11
 *
 * Après exécution, vérifiez dans Snap Ads Manager > Events Manager
 * que tous les événements apparaissent avec le bon nom et les bonnes
 * données (custom_data, user_data hashé).
 */

const SNAP_PIXEL_ID = '9bd26a82-3ecf-42aa-a3de-85df14c74a11';

// Remplacer par le vrai CAPI token (disponible dans Snap Ads Manager > Events Manager)
// ou laisser vide pour utiliser le token stocké en DB.
const SNAP_CAPI_TOKEN = process.env.SNAP_CAPI_TOKEN || '';

// Timestamp actuel en secondes
const now = Math.floor(Date.now() / 1000);

// Hash SHA-256 pour les PII
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalisation PII conforme à Snap
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
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
  const testPhone = '+212612345678';
  const testFirstName = 'Yasmine';
  const testLastName = 'El Amrani';
  const testCity = 'Casablanca';
  const testCountry = 'MA';

  const em = await sha256(normalizeEmail(testEmail));
  const ph = await sha256(normalizePhone(testPhone));
  const fn = await sha256(normalizeName(testFirstName));
  const ln = await sha256(normalizeName(testLastName));
  const ct = await sha256(normalizeName(testCity));
  const country = await sha256(normalizeName(testCountry));

  const baseUserData = {
    em: [em],
    ph: [ph],
    fn,
    ln,
    ct,
    country,
    client_ip_address: '102.0.0.0',
    client_user_agent: 'snap-pixel-test-script/1.0',
  };

  const baseUrl = 'https://femiglow-maroc.com';

  return [
    {
      name: '1. PAGE_VIEW — Affichage page produit',
      fgEvent: 'page_view',
      snapEvent: 'PAGE_VIEW',
      event: {
        event_name: 'PAGE_VIEW',
        event_time: now,
        event_id: `snap-test-pageview-${Date.now()}`,
        event_source_url: `${baseUrl}/kit`,
        action_source: 'website',
        user_data: {
          client_ip_address: '102.0.0.0',
          client_user_agent: 'snap-pixel-test-script/1.0',
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
          value: 290,
          item_ids: ['kit_fg_01'],
          number_items: 1,
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
          value: 290,
          item_ids: ['kit_fg_01'],
          number_items: 1,
        },
      },
    },
    {
      name: '4. START_CHECKOUT — Début checkout',
      fgEvent: 'checkout_intent',
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
          value: 290,
          item_ids: ['kit_fg_01'],
          number_items: 1,
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
          value: 290,
          payment_type: 'cod',
        },
      },
    },
    {
      name: '6. PURCHASE — Conversion achat',
      fgEvent: 'purchase',
      snapEvent: 'PURCHASE',
      event: {
        event_name: 'PURCHASE',
        event_time: now,
        event_id: `snap-test-purchase-${Date.now()}`,
        event_source_url: `${baseUrl}/checkout`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 290,
          item_ids: ['kit_fg_01'],
          number_items: 1,
          transaction_id: `order-snap-test-${Date.now()}`,
        },
      },
    },
    {
      name: '7. SIGN_UP — Lead généré (generate_lead)',
      fgEvent: 'generate_lead',
      snapEvent: 'SIGN_UP',
      event: {
        event_name: 'SIGN_UP',
        event_time: now,
        event_id: `snap-test-signup-${Date.now()}`,
        event_source_url: `${baseUrl}/kit`,
        action_source: 'website',
        user_data: baseUserData,
        custom_data: {
          currency: 'MAD',
          value: 0,
        },
      },
    },
    {
      name: '8. LEAD — Formulaire chat lead',
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
        },
      },
    },
    {
      name: '9. PURCHASE avec sccid — Attribution Snap',
      fgEvent: 'purchase',
      snapEvent: 'PURCHASE',
      event: {
        event_name: 'PURCHASE',
        event_time: now,
        event_id: `snap-test-attrib-${Date.now()}`,
        event_source_url: `${baseUrl}/kit?utm_source=snapchat&sccid=snap_click_test_123`,
        action_source: 'website',
        user_data: {
          ...baseUserData,
          sc_click_id: 'snap_click_test_123',
        },
        custom_data: {
          currency: 'MAD',
          value: 290,
          item_ids: ['kit_fg_01'],
          number_items: 1,
          transaction_id: `order-snap-attrib-${Date.now()}`,
        },
      },
    },
  ];
}

async function sendEvent(testCase: TestCase): Promise<{ status: number; body: string }> {
  const url = `https://tr.snapchat.com/v3/${SNAP_PIXEL_ID}/events?access_token=${encodeURIComponent(SNAP_CAPI_TOKEN)}`;
  const payload = {
    data: [testCase.event],
    // Test event code pour valider en Snap Events Manager
    ...(SNAP_CAPI_TOKEN ? { test_event_code: 'SNAP-PIXEL-TEST' } : {}),
  };

  console.log(`\n→ ${testCase.name}`);
  console.log(`  Événement FemiGlow : ${testCase.fgEvent}`);
  console.log(`  Événement Snap     : ${testCase.snapEvent}`);
  console.log(`  event_id           : ${testCase.event.event_id}`);

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
      console.log(`  Réponse: ${body.slice(0, 200)}`);
    }

    return { status, body };
  } catch (err) {
    console.log(`  ❌ Erreur réseau: ${err instanceof Error ? err.message : String(err)}`);
    return { status: 0, body: String(err) };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  CHA-SNAP — Test live du pixel Snapchat                    ║');
  console.log('║  Pixel ID : 9bd26a82-3ecf-42aa-a3de-85df14c74a11           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  if (!SNAP_CAPI_TOKEN) {
    console.error('❌ SNAP_CAPI_TOKEN manquant. Définissez la variable d\'environnement :');
    console.error('   SNAP_CAPI_TOKEN=your_token npx tsx scripts/test-snap-pixel-live.ts');
    console.error();
    console.error('Le token se trouve dans Snap Ads Manager > Events Manager > Pixel > Conversions API > Access Token.');
    process.exit(1);
  }

  const testCases = await buildTestCases();

  console.log(`Envoi de ${testCases.length} événements de test au pixel Snap...\n`);

  const results: Array<{ name: string; success: boolean; status: number }> = [];

  for (const tc of testCases) {
    const result = await sendEvent(tc);
    results.push({
      name: tc.name,
      success: result.status >= 200 && result.status < 300,
      status: result.status,
    });
    // Délai entre les événements pour éviter le rate limiting
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
    console.log('   3. Le pixel est en mode "Live" (pas "Test" uniquement)');
    console.log('   4. Le domaine est autorisé dans Snap Ads Manager');
  } else {
    console.log('\n✅ Tous les événements ont été envoyés avec succès !');
    console.log('\nProchaine étape : vérifiez dans Snap Ads Manager > Events Manager');
    console.log('que les événements apparaissent avec les bons noms et données.');
  }
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});