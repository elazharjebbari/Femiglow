/* eslint-disable no-console -- diagnostic ops read-only. */
/**
 * Diagnostic READ-ONLY du pipeline analytics : quels event_name existent
 * réellement en base vs ce que l'agrégation attend. Preuve pour l'audit.
 */
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('NO_DATABASE_URL'); return; }
  const sql = postgres(url);

  const total = await sql`select count(*)::int n,
    count(*) filter (where consent_snapshot->>'analytics_storage' = 'granted')::int granted,
    min(received_at) first, max(received_at) last
    from tracking_events_log`;
  console.log('TOTAL', JSON.stringify(total[0]));

  console.log('--- DISTINCT event_name (90j) par volume ---');
  const names = await sql`
    select event_name, count(*)::int n,
      count(*) filter (where consent_snapshot->>'analytics_storage' = 'granted')::int granted
    from tracking_events_log
    where received_at > now() - interval '90 days'
    group by event_name order by n desc limit 60`;
  for (const r of names) console.log(`${r.event_name}\t${r.n}\t(granted ${r.granted})`);

  console.log('--- Présence des events FUNNEL-CRITIQUES (90j) ---');
  const crit = ['page_view','view_item','scroll_depth','scroll_depth_50','cta_impression',
    'cta_click','pack_cta_click','video_cta_click','composition_post_cta_click','add_to_cart',
    'begin_checkout','checkout_intent','add_shipping_info','address_completed','add_payment_info',
    'lead_capture','generate_lead','purchase','purchase_server','view_cart'];
  const found = await sql`
    select event_name, count(*)::int n from tracking_events_log
    where received_at > now() - interval '90 days' and event_name = any(${sql.array(crit)})
    group by event_name`;
  const map = new Map(found.map((r) => [r.event_name, r.n]));
  for (const name of crit) console.log(`${map.has(name) ? '✓' : '✗ ABSENT'}\t${name}\t${map.get(name) ?? 0}`);

  console.log('--- page_view : volume + page_route distinctes ---');
  const pv = await sql`select count(*)::int n, count(distinct page_route)::int routes,
    count(*) filter (where page_route is null or page_route = '')::int null_route
    from tracking_events_log where event_name='page_view' and received_at > now() - interval '90 days'`;
  console.log('PAGE_VIEW', JSON.stringify(pv[0]));
  const routes = await sql`select page_route, count(*)::int n from tracking_events_log
    where event_name='page_view' and received_at > now() - interval '90 days'
    group by page_route order by n desc limit 10`;
  for (const r of routes) console.log(`route ${r.page_route ?? '(null)'}\t${r.n}`);

  await sql.end();
  console.log('INTROSPECT_OK');
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
