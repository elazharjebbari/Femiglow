#!/usr/bin/env node
/**
 * i18n-scan-fr — Détecteur de fuites françaises sur les routes non-FR.
 *
 * Phase 8C.1 (cf. docs/i18n-strategy-2026-05/PHASE-8-FINITION-100PCT.md).
 *
 * Industrialise le scan ad-hoc utilisé en Phase 7. Pour chaque route et chaque
 * locale non-défaut (ar, en), récupère le HTML rendu, retire le contenu
 * `<script>`/`<style>` (= flight-data sérialisé React, NON visible), extrait le
 * texte visible, et signale tout token français (mots-fonction + diacritiques)
 * hors liste blanche de termes de marque.
 *
 * Usage :
 *   node scripts/i18n-scan-fr.mjs                  # base http://localhost:3000, routes par défaut
 *   node scripts/i18n-scan-fr.mjs --base http://localhost:3000
 *   node scripts/i18n-scan-fr.mjs --routes /,/kit  # sous-ensemble
 *   node scripts/i18n-scan-fr.mjs --locales ar     # une seule locale
 *   node scripts/i18n-scan-fr.mjs --json           # sortie JSON (CI)
 *
 * Sortie : rapport lisible + `exit 1` si une fuite est trouvée (gate CI).
 *
 * Prérequis : un serveur Next (prod `next start` ou preview) écoute sur --base.
 * En CI : démarrer le serveur, attendre le 200, puis lancer ce script.
 */

// --- Configuration -----------------------------------------------------------

const DEFAULT_BASE = process.env.I18N_SCAN_BASE ?? 'http://localhost:3000';

/** Routes (sans préfixe locale) scannées par défaut. */
const DEFAULT_ROUTES = [
  '/',
  '/kit',
  '/journal',
  '/maison',
  '/contact',
  '/rituel',
];

/** Locales non-défaut à vérifier (le FR est la référence, jamais scannée). */
const DEFAULT_LOCALES = ['ar', 'en'];

/**
 * Tokens français à haute valeur de signal (mots-fonction + marqueurs).
 * Aucun n'est un mot anglais courant en tant que mot entier → scan /en valide.
 * On matche en frontière de mot, insensible à la casse.
 */
const FR_TOKENS = [
  'vous', 'votre', 'vos', 'avec', 'pour', 'sans', 'dans', 'nous', 'notre',
  'est', 'sont', 'une', 'des', 'les', 'aux', 'plus', 'jour', 'soir', 'main',
  'mains', 'geste', 'gestes', 'livraison', 'offerte', 'offert', 'rituel',
  'ongles', 'cinq', 'minutes', 'japonaise', 'paiement', 'questions',
  'réponses', 'transcription', 'détail', 'confidentialité', 'cookies',
  'vernis', 'classique', 'dénigrer', 'initiées', 'reprendraient', 'habitude',
  'casse', 'partagé', 'économisez', 'mentions', 'légales', 'générales',
  'commander', 'découvrir', 'lecture', 'lectures',
];

/**
 * Liste blanche : termes (de marque/technique) qui apparaissent légitimement
 * dans une phrase AR/EN. On retire ces SEGMENTS du texte avant scan pour éviter
 * les faux positifs (ex. la transcription AR contient « clean girl » ; un prix
 * affiche « MAD » ; les noms de produits restent en latin).
 */
const WHITELIST_PHRASES = [
  'clean girl',
  'Polish & Shine',
  'Cosmos Organic',
  'EVE Vegan',
  'Step 4',
  'FemiGlow',
  'Paste',
  'Powder',
  'INCI',
  'MAD',
  'DHL',
  'Rabat',
  'Souss-Massa',
];

/**
 * Homographes FR↔autre-locale : tokens FR qui sont AUSSI des mots valides dans
 * la locale cible → à ignorer pour cette locale (sinon faux positifs). Ex. en
 * anglais « minutes »/« questions » sont légitimes. L'arabe n'a pas
 * d'homographe latin, donc rien à exclure pour `ar`.
 */
const LOCALE_HOMOGRAPHS = {
  en: new Set(['minutes', 'questions']),
};

// --- Args --------------------------------------------------------------------

function parseArgs(argv) {
  const args = { base: DEFAULT_BASE, routes: DEFAULT_ROUTES, locales: DEFAULT_LOCALES, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') args.base = argv[++i];
    else if (a === '--routes') args.routes = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--locales') args.locales = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--json') args.json = true;
  }
  return args;
}

// --- Extraction texte visible ------------------------------------------------

/** Retire scripts/styles (flight-data non visible) puis les balises. */
function extractVisibleText(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  // <title> est dans <head> mais reste « visible » (onglet/SEO) → on le garde.
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/&[a-z]+;/gi, ' ').replace(/&#x?[0-9a-f]+;/gi, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** Retire les segments whitelistés (insensible à la casse). */
function stripWhitelist(text) {
  let t = text;
  for (const phrase of WHITELIST_PHRASES) {
    t = t.split(new RegExp(escapeRegExp(phrase), 'gi')).join(' ');
  }
  return t;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Frontière de mot tolérante (lettres latines accentuées + apostrophe typo). */
function findToken(text, token) {
  // (?<![A-Za-zÀ-ÿ’]) … (?![A-Za-zÀ-ÿ’])
  const re = new RegExp(`(?<![A-Za-zÀ-ÿ’])${escapeRegExp(token)}(?![A-Za-zÀ-ÿ’])`, 'gi');
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const s = Math.max(0, m.index - 45);
    const e = Math.min(text.length, m.index + token.length + 45);
    hits.push(text.slice(s, e).trim());
  }
  return hits;
}

// --- Scan --------------------------------------------------------------------

async function scanRoute(base, locale, route) {
  const url = `${base}/${locale}${route === '/' ? '' : route}`;
  let html;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { url, error: String(err?.message ?? err) };
  }
  const visible = stripWhitelist(extractVisibleText(html));
  const skip = LOCALE_HOMOGRAPHS[locale] ?? new Set();
  const tokens = {};
  let total = 0;
  for (const tok of FR_TOKENS) {
    if (skip.has(tok)) continue;
    const hits = findToken(visible, tok);
    if (hits.length) {
      tokens[tok] = hits;
      total += hits.length;
    }
  }
  return { url, total, tokens };
}

async function main() {
  const { base, routes, locales, json } = parseArgs(process.argv.slice(2));
  const results = [];
  for (const locale of locales) {
    for (const route of routes) {
      results.push({ locale, route, ...(await scanRoute(base, locale, route)) });
    }
  }

  const leaks = results.filter((r) => r.total > 0);
  const errors = results.filter((r) => r.error);

  if (json) {
    console.log(JSON.stringify({ base, results }, null, 2));
  } else {
    console.log(`\ni18n-scan-fr — base ${base}\n${'='.repeat(60)}`);
    for (const r of results) {
      if (r.error) {
        console.log(`  ⚠️  ${r.locale}${r.route}  →  ${r.error}`);
      } else if (r.total > 0) {
        console.log(`  ❌ ${r.locale}${r.route}  →  ${r.total} fuite(s) FR, ${Object.keys(r.tokens).length} token(s)`);
        for (const [tok, hits] of Object.entries(r.tokens)) {
          console.log(`       [${tok}] x${hits.length}: …${hits[0].slice(0, 80)}…`);
        }
      } else {
        console.log(`  ✅ ${r.locale}${r.route}  →  0`);
      }
    }
    const totalLeaks = leaks.reduce((n, r) => n + r.total, 0);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total : ${totalLeaks} fuite(s) sur ${leaks.length}/${results.length} route(s).`);
    if (errors.length) console.log(`Erreurs réseau : ${errors.length} (serveur démarré sur ${base} ?).`);
  }

  // Gate CI : échec si fuite OU si toutes les routes sont en erreur (serveur absent).
  if (leaks.length > 0) process.exit(1);
  if (errors.length === results.length) process.exit(2);
  process.exit(0);
}

main();
