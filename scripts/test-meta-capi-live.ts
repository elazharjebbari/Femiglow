/**
 * Test live du pixel Meta CAPI via l'API de tracking FemiGlow.
 *
 * Ce script envoie des événements via /api/track (le chemin production normal)
 * qui dispatche à tous les providers activés, dont Meta.
 *
 * PRÉREQUIS :
 *   - Le provider Meta doit être activé en DB (status='enabled')
 *   - Le CAPI token doit être configuré
 *   - Le serveur FemiGlow doit tourner
 *
 * UTILISATION :
 *   npx tsx scripts/test-meta-capi-live.ts [--enable-meta]
 *
 * Options :
 *   --enable-meta   Active le provider Meta en DB avant les tests
 */

import { db, memoryStore, schema } from '../apps/web/src/lib/db/client';
import { listTrackingProviders, updateTrackingProvider } from '../apps/web/src/lib/db/queries/tracking/providers';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const EVENTS = [
  {
    name: 'PageView — Page d\'accueil',
    event: 'page_view',
  },
  {
    name: 'ViewContent — Fiche produit',
    event: 'view_item',
    params: { currency: 'MAD', value: 399, items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }] },
  },
  {
    name: 'AddToCart — Ajout au panier',
    event: 'add_to_cart',
    params: { currency: 'MAD', value: 399, items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }] },
  },
  {
    name: 'InitiateCheckout — Début checkout',
    event: 'begin_checkout',
    params: { currency: 'MAD', value: 399, items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }] },
  },
  {
    name: 'Purchase — Conversion achat',
    event: 'purchase',
    params: { currency: 'MAD', value: 399, transaction_id: `order-meta-test-${Date.now()}`, items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }] },
  },
  {
    name: 'Lead — Formulaire contact',
    event: 'generate_lead',
    params: { content_name: 'Formulaire contact' },
  },
];

async function enableMetaProvider() {
  const drizzle = db();
  if (!drizzle) {
    console.error('❌ Pas de connexion DB disponible. Ce script doit tourner avec la DB.');
    process.exit(1);
  }
  const providers = await listTrackingProviders();
  const meta = providers.find(p => p.kind === 'meta');
  if (!meta) {
    console.error('❌ Provider meta non trouvé en DB.');
    process.exit(1);
  }
  if (meta.status === 'enabled') {
    console.log('✅ Provider meta déjà activé.');
    return;
  }
  await updateTrackingProvider(meta.id, { status: 'enabled' });
  console.log('✅ Provider meta activé.');
}

async function sendTrackEvent(event: string, params?: Record<string, unknown>) {
  const eventId = `meta-test-${event}-${Date.now()}`;
  const payload = {
    events: [{
      event,
      event_id: eventId,
      consent: {
        ad_storage: 'granted',
        analytics_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        functional_storage: 'granted',
      },
      page: {
        url: 'https://femiglow-maroc.com/',
        path: '/',
        title: 'FemiGlow — Meta CAPI Test',
        referrer: '',
        locale: 'fr-MA',
      },
      user: {
        anonymous_id: `meta_test_${Date.now()}`,
        session_id: `meta_sess_${Date.now()}`,
      },
      ...(params ? { params } : {}),
    }],
  };

  const res = await fetch(`${BASE_URL}/api/track`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return { status: res.status, data, eventId };
}

async function main() {
  const args = process.argv.slice(2);
  const shouldEnable = args.includes('--enable-meta');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  META CAPI — Test via /api/track                           ║');
  console.log('║  Pixel ID : 2179682406197934                               ║');
  console.log('║  Test Code : TEST11989                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (shouldEnable) {
    console.log('🔑 Activation du provider Meta...');
    await enableMetaProvider();
    console.log('');
  }

  // Check providers
  console.log('📋 Vérification des providers activés...');
  const providers = await listTrackingProviders();
  const enabled = providers.filter(p => p.status === 'enabled');
  for (const p of enabled) {
    console.log(`   ${p.kind}: ${p.status} | pixel: ${p.pixelId ?? '—'} | capiToken: ${p.capiToken ? '✅' : '❌'} | testCode: ${p.testEventCode ?? '—'}`);
  }
  console.log('');

  const meta = providers.find(p => p.kind === 'meta');
  if (!meta || meta.status !== 'enabled') {
    console.error('❌ Provider meta non activé. Utilisez --enable-meta ou activez-le via l\'admin UI.');
    process.exit(1);
  }

  console.log(`Envoi de ${EVENTS.length} événements de test via /api/track...\n`);

  const results: Array<{ name: string; success: boolean; status: number }> = [];

  for (const tc of EVENTS) {
    process.stdout.write(`→ ${tc.name}... `);
    try {
      const { status, data, eventId } = await sendTrackEvent(tc.event, tc.params);
      const accepted = data?.results?.[0]?.status === 'accepted' || data?.accepted > 0;
      const icon = status === 200 ? '✅' : '❌';
      console.log(`${icon} HTTP ${status} | event_id: ${eventId}`);
      if (data?.results) {
        for (const r of data.results) {
          console.log(`   ${r.provider ?? r.kind ?? '?'}: ${r.status ?? '—'} ${r.error ?? ''}`);
        }
      }
      results.push({ name: tc.name, success: status === 200, status });
    } catch (err) {
      console.log(`❌ Erreur: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ name: tc.name, success: false, status: 0 });
    }
    await new Promise(resolve => setTimeout(resolve, 300));
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

  if (meta.testEventCode) {
    console.log(`\n📝 Test Event Code: ${meta.testEventCode}`);
    console.log('   Vérifiez dans Meta Events Manager (onglet Test Events):');
    console.log('   https://business.facebook.com/events_manager');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});