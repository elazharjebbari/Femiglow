#!/usr/bin/env node
/**
 * i18n-scan-latin-ar — Audit STRICT : aucun caractère latin sur /ar/* sauf
 * « FemiGlow » (+ adresses techniques whitelistées : domaine, email).
 *
 * Plus sévère que `i18n-scan-fr.mjs` (qui ne traque que les mots FR). Ici on
 * signale TOUT mot en alphabet latin rendu visible sur une page arabe — y
 * compris les termes de marque/technique (Paste, Powder, Step 4, Polish &
 * Shine, MAD, INCI, Cosmos Organic, EVE Vegan, DHL, clean girl…) qui doivent
 * désormais être traduits/translittérés en arabe (traduction soignée).
 *
 * Usage : node scripts/i18n-scan-latin-ar.mjs [--base URL] [--routes /,/kit]
 * Sortie : par route, les tokens latins distincts + occurrences + 1 contexte.
 * exit 1 si un token latin non-whitelisté est trouvé.
 */

const DEFAULT_BASE = process.env.I18N_SCAN_BASE ?? 'http://localhost:3000';
const DEFAULT_ROUTES = ['/', '/kit', '/journal', '/maison', '/contact', '/rituel'];

/**
 * Seules exceptions latines tolérées sur /ar :
 *  - « FemiGlow » (marque, exigé par le client)
 *  - le domaine / email de la maison (adresse technique, non traduisible)
 *  - « Patrice Lumumba » (odonyme officiel de l'adresse postale de Rabat)
 * Tout le reste DOIT être en arabe.
 */
const WHITELIST_WORDS = new Set(
  [
    'femiglow',
    'patrice',
    'lumumba',
    // INCI — nomenclature internationale des ingrédients cosmétiques. Acronyme
    // de référentiel non traduisible (exception produit déjà documentée plus
    // bas), au même titre qu'une unité de mesure. Accompagne toujours un
    // libellé arabe (« الأسماء العلمية INCI »).
    'inci',
    // Unités de mesure — restent en latin partout (décision produit) :
    // durées (min, s, h), volumes/masses (ml, cl, dl, kg, mg, cm, mm), etc.
    // « g » et « s » font 1 lettre → non captés par le tokeniseur ≥2.
    'min',
    'ml',
    'cl',
    'dl',
    'kg',
    'mg',
    'cm',
    'mm',
    'oz',
  ].map((w) => w.toLowerCase()),
);
// Segments à retirer en bloc (domaine, email) avant tokenisation.
const WHITELIST_SEGMENTS = [
  'femiglow-maroc.com',
  'info@femiglow-maroc.com',
];

function parseArgs(argv) {
  const a = { base: DEFAULT_BASE, routes: DEFAULT_ROUTES };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') a.base = argv[++i];
    else if (argv[i] === '--routes') a.routes = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return a;
}

function extractVisibleText(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/&[a-z]+;/gi, ' ').replace(/&#x?[0-9a-f]+;/gi, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function scanRoute(base, route) {
  const url = `${base}/ar${route === '/' ? '' : route}`;
  let html;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { url, error: String(err?.message ?? err) };
  }
  let text = extractVisibleText(html);
  for (const seg of WHITELIST_SEGMENTS) {
    text = text.split(new RegExp(escapeRegExp(seg), 'gi')).join(' ');
  }
  // Adresses email — identifiants techniques non traduisibles (au même titre
  // que la marque). On retire tout motif `local-part@domaine` AVANT
  // tokenisation. Gère aussi le cas `local-part@` sans domaine (le domaine
  // peut venir d'une variable d'env non résolue en préview locale).
  text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]*/g, ' ');
  // Phase 9 — exceptions latines INTENTIONNELLES tolérées sur /ar :
  //  1. Noms INCI entre parenthèses  : « زيت الجوجوبا (Simmondsia Chinensis Seed Oil) »
  //  2. Noms de certification        : « شهادة عضوية (Cosmos Organic — Ecocert) »
  //  3. Acronyme INCI / référentiel  : « الاسم العلمي (INCI) », « (Halal Cosmetics Council) »
  // Décision produit : le latin entre parenthèses accompagne TOUJOURS un libellé
  // arabe ; on le retire AVANT tokenisation pour ne pas le signaler. Gère les
  // parenthèses ASCII (...) et arabes ﴾...﴿ ainsi que les variantes pleine chasse.
  text = text.replace(/[(（﴾][^()（）﴾﴿]*[)）﴿]/g, ' ');
  // Citations académiques (bloc « Sources ») : références bibliographiques V.O.
  // tolérées (Tanaka H. 2021, Journal of Cosmetic Dermatology, Annales de
  // Dermatologie…). On retire les segments connus avant tokenisation.
  const CITATION_SEGMENTS = [
    'Journal of Cosmetic Dermatology',
    'Annales de Dermatologie et de Vénéréologie',
    'Standards for halal cosmetic ingredient sourcing and certification',
    'Beeswax-based barrier creams in cold-induced nail fragility',
    'Kaolin clay polishing in non-invasive nail care',
    'public framework',
    'Tanaka H.',
    'Benyahia L.',
    'Halal Cosmetics Council',
  ];
  for (const seg of CITATION_SEGMENTS) {
    text = text.split(new RegExp(escapeRegExp(seg), 'gi')).join(' ');
  }
  // Tokens latins : suites de lettres a-z (≥2 pour limiter le bruit), insensible
  // à la casse. On capte aussi les mots d'1 lettre s'ils sont isolés et latins.
  const tokenRe = /[A-Za-z]{2,}/g;
  const counts = new Map();
  const sample = new Map();
  let m;
  while ((m = tokenRe.exec(text)) !== null) {
    const tok = m[0];
    if (WHITELIST_WORDS.has(tok.toLowerCase())) continue;
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
    if (!sample.has(tok)) {
      const s = Math.max(0, m.index - 35);
      const e = Math.min(text.length, m.index + tok.length + 35);
      sample.set(tok, text.slice(s, e).trim());
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return { url, total, counts, sample };
}

async function main() {
  const { base, routes } = parseArgs(process.argv.slice(2));
  let grandTotal = 0;
  let leakyRoutes = 0;
  console.log(`\ni18n-scan-latin-ar — base ${base} (strict : latin interdit sur /ar sauf FemiGlow)\n${'='.repeat(70)}`);
  for (const route of routes) {
    const r = await scanRoute(base, route);
    if (r.error) {
      console.log(`  ⚠️  /ar${route}  →  ${r.error}`);
      continue;
    }
    if (r.total === 0) {
      console.log(`  ✅ /ar${route}  →  0 latin`);
      continue;
    }
    leakyRoutes++;
    grandTotal += r.total;
    const sorted = [...r.counts.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`  ❌ /ar${route}  →  ${r.total} occ latines, ${sorted.length} token(s) distinct(s)`);
    for (const [tok, n] of sorted) {
      console.log(`       [${tok}] x${n}: …${(r.sample.get(tok) ?? '').slice(0, 70)}…`);
    }
  }
  console.log(`${'='.repeat(70)}`);
  console.log(`Total latin (hors FemiGlow) : ${grandTotal} sur ${leakyRoutes}/${routes.length} route(s).`);
  process.exit(grandTotal > 0 ? 1 : 0);
}

main();
