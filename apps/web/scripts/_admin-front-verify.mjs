/**
 * Vérification preview-based : on modifie via les routes ADMIN (vraie surface,
 * avec session) puis on vérifie l'effet sur le FRONT client (HTML /kit +
 * endpoints publics). Restaure l'état initial à la fin.
 *   node --env-file=.env scripts/_admin-front-verify.mjs
 */
const BASE = 'http://127.0.0.1:3001';
let cookie = '';
const results = [];
const pass = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    }),
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return res.ok && !!cookie;
}

const adm = (path, init = {}) =>
  fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers || {}), cookie, 'content-type': 'application/json' } });

async function kitHtml() {
  const res = await fetch(`${BASE}/kit`, { redirect: 'follow', headers: { accept: 'text/html' } });
  return res.text();
}
function noteFinalPrice(html) {
  const i = html.indexOf('coupon-welcome-final-price');
  if (i < 0) return null;
  const seg = html.slice(i, i + 200).replace(/<[^>]+>/g, ' ');
  const m = seg.match(/(\d{2,4})\s*(?:MAD|درهم)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  if (!(await login())) {
    console.error('LOGIN FAILED');
    process.exit(1);
  }
  // Warmup /kit (compile)
  for (let i = 0; i < 30; i += 1) {
    const r = await fetch(`${BASE}/kit`).catch(() => null);
    if (r && r.status === 200) break;
    await sleep(2000);
  }

  const list = await (await adm('/api/admin/coupons')).json();
  const byType = (t) => list.items.find((c) => c.type === t);
  const welcome = byType('welcome_auto');
  const rescue = byType('rescue');
  pass('SETUP', !!welcome && !!rescue, `welcome=${welcome?.id} rescue=${rescue?.id}`);

  // ── T1 : pause welcome → note absente ──────────────────────────────
  await adm(`/api/admin/coupons/${welcome.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'paused' }) });
  await sleep(1500);
  let html = await kitHtml();
  pass('T1 pause welcome → note absente', !html.includes('coupon-welcome-note'), `noteFound=${html.includes('coupon-welcome-note')}`);

  // ── T2 : réactiver welcome → note présente, 199 ────────────────────
  await adm(`/api/admin/coupons/${welcome.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'active' }) });
  await sleep(1500);
  html = await kitHtml();
  pass('T2 active welcome → note + 199', html.includes('coupon-welcome-note') && noteFinalPrice(html) === 199, `final=${noteFinalPrice(html)}`);

  // ── T3 : valeur -50 (5000) → prix 239 ──────────────────────────────
  await adm(`/api/admin/coupons/${welcome.id}`, { method: 'PATCH', body: JSON.stringify({ valueAmount: 5000 }) });
  await sleep(1500);
  html = await kitHtml();
  pass('T3 welcome -50 → /kit 239', noteFinalPrice(html) === 239, `final=${noteFinalPrice(html)}`);

  // ── T4 : restaurer -90 (9000) → prix 199 ───────────────────────────
  await adm(`/api/admin/coupons/${welcome.id}`, { method: 'PATCH', body: JSON.stringify({ valueAmount: 9000 }) });
  await sleep(1500);
  html = await kitHtml();
  pass('T4 restore welcome -90 → /kit 199', noteFinalPrice(html) === 199, `final=${noteFinalPrice(html)}`);

  // ── T5 : pause rescue → /api/coupons/rescue show:false ─────────────
  await adm(`/api/admin/coupons/${rescue.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'paused' }) });
  await sleep(800);
  let r = await (await fetch(`${BASE}/api/coupons/rescue`, { method: 'POST', headers: { cookie: 'fg_session_id=verif1' } })).json();
  pass('T5 pause rescue → show:false', r.show === false, JSON.stringify(r));

  // ── T6 : réactiver rescue + holdout 0 → show:true partout ──────────
  await adm(`/api/admin/coupons/${rescue.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'active' }) });
  await adm(`/api/admin/coupons/${rescue.id}`, { method: 'PATCH', body: JSON.stringify({ holdoutPct: 0 }) });
  await sleep(800);
  const shows = [];
  for (const s of ['a', 'b', 'c', 'd']) {
    const rr = await (await fetch(`${BASE}/api/coupons/rescue`, { method: 'POST', headers: { cookie: `fg_session_id=h0_${s}` } })).json();
    shows.push(rr.show);
  }
  pass('T6 rescue holdout 0 → show:true partout', shows.every((x) => x === true), JSON.stringify(shows));

  // ── T7 : restaurer holdout 20 ──────────────────────────────────────
  await adm(`/api/admin/coupons/${rescue.id}`, { method: 'PATCH', body: JSON.stringify({ holdoutPct: 20 }) });
  await sleep(500);
  const after = (await (await adm(`/api/admin/coupons/${rescue.id}`)).json()).coupon;
  pass('T7 restore rescue holdout 20', after.holdoutPct === 20, `holdout=${after.holdoutPct}`);

  const ok = results.every((r2) => r2.ok);
  console.log(`\n=== ${results.filter((r2) => r2.ok).length}/${results.length} PASS ===`);
  process.exit(ok ? 0 : 2);
}
main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
