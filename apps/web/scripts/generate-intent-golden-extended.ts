/**
 * CHA-231 — Générateur synthétique du golden-set étendu.
 *
 * Génère ~1500 utterances par combinaison de templates, couvre les
 * variantes typographiques (élisions, politesse, abréviations) que
 * la regex `intent.ts` doit attraper sans appel LLM.
 *
 * Output : `tests/golden/intent-extended.json` (committé).
 *
 * Usage :
 *   pnpm tsx scripts/generate-intent-golden-extended.ts
 *
 * Le résultat est consommé par `intent.golden-extended.test.ts` qui
 * applique un seuil ≥ 95 % par intent commercial fort (purchase,
 * callback, negotiation, wholesaler) et ≥ 85 % global. CI bloquant.
 *
 * Stratégie templates :
 *   - chaque intent a 1+ liste de phrases CANONIQUES (verbes / objets)
 *   - on combine avec ADVERBES, POLITESSE, ÉLISIONS, TYPOS
 *   - on dé-duplique en fin
 *
 * Pour enrichir avec des datasets externes (MASSIVE, Bitext, DODa),
 * voir `scripts/sync-intent-datasets.ts`.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Lang = 'fr' | 'ar' | 'ar-MA' | 'en';

interface Row {
  text: string;
  language: Lang;
  expectedIntent: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Helpers — combinatoire de templates
// ---------------------------------------------------------------------------

function cross<A, B>(as: A[], bs: B[], join: (a: A, b: B) => string): string[] {
  const out: string[] = [];
  for (const a of as) for (const b of bs) out.push(join(a, b));
  return out;
}

function uniq(rows: Row[]): Row[] {
  const seen = new Map<string, Row>();
  for (const r of rows) {
    const key = `${r.language}|${r.text.trim().toLowerCase()}|${r.expectedIntent}`;
    if (!seen.has(key)) seen.set(key, { ...r, text: r.text.trim() });
  }
  return [...seen.values()];
}

/**
 * PRNG déterministe (mulberry32) — pour stratifier sans flakiness CI.
 * Seed fixe : la génération est 100 % reproductible commit-à-commit.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0xfe71_91ce); // FemiGlow seed

/** Sample up to N entries from `rows` deterministically. */
function sample<T>(rows: T[], n: number): T[] {
  if (rows.length <= n) return rows.slice();
  const indexed = rows.map((r, i) => ({ r, k: rng() }));
  indexed.sort((a, b) => a.k - b.k);
  return indexed.slice(0, n).map((x) => x.r);
}

// ---------------------------------------------------------------------------
// PURCHASE-INTENT (FR) — 250+ variantes
// ---------------------------------------------------------------------------
const FR_MODALS = [
  'je veux',
  'je voudrais',
  'je souhaite',
  'je peux',
  'je vais',
  'j’aimerais',
  "j'aimerais",
  'je voulais',
  'on veut',
  'on voudrait',
];
const FR_ADVERBS = ['', 'donc ', 'bien ', 'vraiment ', 'au fait ', 'finalement ', 'tout simplement '];
const FR_VERBS_ACT = ['commander', 'acheter', 'prendre', 'payer', 'finaliser ma commande'];
const FR_ELISIONS = ['', "l'", 'l’', 'le ', 'les '];
const FR_POLITESSE = ['', ' svp', ' stp', ' s’il vous plaît', ' s’il te plaît', ' please', ' merci'];
const FR_OBJECTS = ['', ' le kit', ' votre kit', ' ce kit', ' ce produit', ' un exemplaire', " l'article"];
const FR_PUNCT = ['', '.', '!', '?', ' !', ' ?'];

function genPurchaseFr(): Row[] {
  const out: Row[] = [];
  // Combinaison modal + verbe + politesse
  for (const m of FR_MODALS) {
    for (const adv of FR_ADVERBS) {
      for (const v of FR_VERBS_ACT) {
        for (const obj of FR_OBJECTS) {
          for (const pol of FR_POLITESSE) {
            for (const p of FR_PUNCT) {
              out.push({
                text: `${m} ${adv}${v}${obj}${pol}${p}`,
                language: 'fr',
                expectedIntent: 'purchase-intent',
              });
            }
          }
        }
      }
    }
  }
  // Élisions « je veux l'acheter » (CHA-230 v6)
  for (const m of ['je veux', 'je voudrais', 'je peux', "j'aimerais", 'on veut']) {
    for (const e of ["l'", 'l’']) {
      for (const v of ['acheter', 'commander', 'prendre', 'payer']) {
        for (const pol of ['', ' svp', ' stp', ' please']) {
          out.push({
            text: `${m} ${e}${v}${pol}`,
            language: 'fr',
            expectedIntent: 'purchase-intent',
          });
        }
      }
    }
  }
  // Verbes seuls (impératif/infinitif)
  for (const v of ['commander', 'acheter', 'order', 'buy', 'achat', 'tlb', 'tleb']) {
    out.push({ text: v, language: 'fr', expectedIntent: 'purchase-intent' });
    out.push({ text: `${v}!`, language: 'fr', expectedIntent: 'purchase-intent' });
    out.push({ text: `${v} svp`, language: 'fr', expectedIntent: 'purchase-intent' });
    out.push({ text: `${v} stp`, language: 'fr', expectedIntent: 'purchase-intent' });
  }
  // « achat » avec compléments (CHA-230 v5)
  for (const obj of ['', ' du kit', ' du produit']) {
    for (const pol of ['', ' svp', ' stp', ' please', ' s’il vous plaît']) {
      out.push({ text: `achat${obj}${pol}`, language: 'fr', expectedIntent: 'purchase-intent' });
      out.push({ text: `pour achat${obj}${pol}`, language: 'fr', expectedIntent: 'purchase-intent' });
      out.push({ text: `pour acheter${obj}${pol}`, language: 'fr', expectedIntent: 'purchase-intent' });
      out.push({ text: `faire un achat${obj}${pol}`, language: 'fr', expectedIntent: 'purchase-intent' });
      out.push({ text: `finaliser mon achat${pol}`, language: 'fr', expectedIntent: 'purchase-intent' });
      out.push({ text: `valider mon achat${pol}`, language: 'fr', expectedIntent: 'purchase-intent' });
    }
  }
  // « passer / faire / valider une commande »
  for (const v of ['passer', 'faire', 'valider']) {
    for (const det of ['une', 'la']) {
      for (const pol of ['', ' svp', ' stp']) {
        out.push({
          text: `je veux ${v} ${det} commande${pol}`,
          language: 'fr',
          expectedIntent: 'purchase-intent',
        });
        out.push({
          text: `${v} ${det} commande${pol}`,
          language: 'fr',
          expectedIntent: 'purchase-intent',
        });
      }
    }
  }
  // Formulaire / envoyer le kit
  for (const v of ['envoyez', 'envoie', 'envoyer']) {
    out.push({ text: `${v}-moi le kit`, language: 'fr', expectedIntent: 'purchase-intent' });
    out.push({ text: `${v} moi le kit svp`, language: 'fr', expectedIntent: 'purchase-intent' });
  }
  out.push({ text: 'donnez-moi le formulaire', language: 'fr', expectedIntent: 'purchase-intent' });
  out.push({ text: 'tu as un formulaire ?', language: 'fr', expectedIntent: 'purchase-intent' });
  return out;
}

// ---------------------------------------------------------------------------
// CALLBACK-REQUEST (FR)
// ---------------------------------------------------------------------------
function genCallbackFr(): Row[] {
  const verbs = ['rappelez-moi', 'rappelez moi', 'pouvez-vous me rappeler', 'rappelle-moi', 'appelez-moi'];
  const time = ['', ' demain', ' cet après-midi', ' ce soir', ' dans la journée', ' au plus vite'];
  const pol = ['', ' svp', ' stp', ' s’il vous plaît', ' merci'];
  const out: Row[] = [];
  for (const v of verbs) {
    for (const t of time) {
      for (const p of pol) {
        out.push({ text: `${v}${t}${p}`, language: 'fr', expectedIntent: 'callback-request' });
      }
    }
  }
  out.push({ text: 'je préfère qu’on m’appelle', language: 'fr', expectedIntent: 'callback-request' });
  out.push({ text: 'pouvez-vous m’appeler ?', language: 'fr', expectedIntent: 'callback-request' });
  return out;
}

// ---------------------------------------------------------------------------
// NEGOTIATION (FR)
// ---------------------------------------------------------------------------
function genNegotiationFr(): Row[] {
  const stems = [
    'faites moi un rabais',
    'faites-moi un rabais',
    'vous pouvez baisser le prix',
    'un geste commercial',
    'une remise',
    'un effort commercial',
    'un code promo',
    'une réduction',
    'un prix spécial',
    'négocier le prix',
    'une remise svp',
    'pouvez-vous baisser',
    'baisser le tarif',
  ];
  const pol = ['', ' svp', ' stp', ' s’il vous plaît', ' please'];
  const punct = ['', ' ?', '.', ' !'];
  return cross(cross(stems, pol, (a, b) => `${a}${b}`), punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'fr' as Lang,
    expectedIntent: 'negotiation',
  }));
}

// ---------------------------------------------------------------------------
// WHOLESALER (FR)
// ---------------------------------------------------------------------------
function genWholesalerFr(): Row[] {
  const stems = [
    'je suis grossiste',
    'je suis revendeur',
    'je suis distributeur',
    "j'ai un institut",
    'je veux 100 boîtes',
    'je veux 50 kits',
    'pour mon salon de beauté',
    'achat en gros',
    'grosse quantité',
    'commande en gros volume',
    'tarif grossiste',
    'je cherche un partenariat',
  ];
  const punct = ['', '.', ' svp', ', je veux 100 boîtes pour mon institut', ' pour Casablanca'];
  return cross(stems, punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'fr' as Lang,
    expectedIntent: 'wholesaler',
  }));
}

// ---------------------------------------------------------------------------
// PRICING (FR)
// ---------------------------------------------------------------------------
function genPricingFr(): Row[] {
  const stems = [
    "c'est combien",
    'combien coûte',
    'combien ça coûte',
    'quel est le prix',
    'le prix du kit',
    'votre tarif',
    'le tarif',
    'ça vaut combien',
    'combien le kit',
    'quel est le tarif',
  ];
  const pol = ['', ' svp', ' stp', ' please'];
  const punct = ['', ' ?', '.', ' ?'];
  return cross(cross(stems, pol, (a, b) => `${a}${b}`), punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'fr' as Lang,
    expectedIntent: 'pricing',
  }));
}

// ---------------------------------------------------------------------------
// SHIPPING (FR)
// ---------------------------------------------------------------------------
function genShippingFr(): Row[] {
  const stems = [
    'quel délai pour Marrakech',
    'quel délai pour Casablanca',
    'vous livrez à Tanger',
    'vous livrez où',
    'délai de livraison',
    'temps de livraison',
    'tracking de la commande',
    'suivi du colis',
    'la livraison se fait en combien',
    'délai pour Rabat',
    'temps de livraison Marrakech',
  ];
  const pol = ['', ' svp', ' stp', ' s’il vous plaît'];
  const punct = ['', ' ?', '.'];
  return cross(cross(stems, pol, (a, b) => `${a}${b}`), punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'fr' as Lang,
    expectedIntent: 'shipping',
  }));
}

// ---------------------------------------------------------------------------
// INGREDIENT (FR)
// ---------------------------------------------------------------------------
function genIngredientFr(): Row[] {
  const stems = [
    'la composition',
    'la formule',
    'les ingrédients',
    'c’est quoi dedans',
    'quels sont les ingrédients',
    'composition du kit',
    'votre produit contient quoi',
    'liste INCI',
    'matières premières',
  ];
  const punct = ['', ' ?', '.', ' svp'];
  return cross(stems, punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'fr' as Lang,
    expectedIntent: 'ingredient',
  }));
}

// ---------------------------------------------------------------------------
// ROUTINE (FR)
// ---------------------------------------------------------------------------
function genRoutineFr(): Row[] {
  const stems = [
    'comment utiliser',
    'comment ça marche',
    'la routine',
    'le rituel',
    'combien de fois par jour',
    'matin et soir',
    'application',
    'posologie',
    'comment l’appliquer',
    'étapes du rituel',
  ];
  const punct = ['', ' ?', '.'];
  return cross(stems, punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'fr' as Lang,
    expectedIntent: 'routine',
  }));
}

// ---------------------------------------------------------------------------
// ORDER-STATUS (FR)
// ---------------------------------------------------------------------------
function genOrderStatusFr(): Row[] {
  const stems = [
    'où est ma commande',
    'j’ai déjà commandé',
    "j'ai déjà commandé",
    'j’ai passé une commande la semaine dernière',
    'suivi de ma commande',
    'ma commande',
    'ma commande est où',
    'numéro de suivi',
    'état de ma commande',
    'j’ai commandé hier',
  ];
  const punct = ['', ' ?', '.', ' svp'];
  return cross(stems, punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'fr' as Lang,
    expectedIntent: 'order-status',
  }));
}

// ---------------------------------------------------------------------------
// GREETING (FR / AR / AR-MA / EN)
// ---------------------------------------------------------------------------
function genGreetings(): Row[] {
  const fr = ['Bonjour', 'bonjour', 'Salut', 'Coucou', 'Bonsoir', 'Hello', 'Hi'];
  const ar = ['السلام عليكم', 'مرحبا', 'أهلا'];
  const arMA = ['salam', 'salem', 'sbah lkhir', 'asslama', 'salam aleykoum'];
  const en = ['hello', 'hi', 'hi there', 'good evening'];
  return [
    ...fr.map((t) => ({ text: t, language: 'fr' as Lang, expectedIntent: 'greeting' })),
    ...ar.map((t) => ({ text: t, language: 'ar' as Lang, expectedIntent: 'greeting' })),
    ...arMA.map((t) => ({ text: t, language: 'ar-MA' as Lang, expectedIntent: 'greeting' })),
    ...en.map((t) => ({ text: t, language: 'en' as Lang, expectedIntent: 'greeting' })),
  ];
}

// ---------------------------------------------------------------------------
// PURCHASE-INTENT — Darija (AR-MA)
// ---------------------------------------------------------------------------
function genPurchaseArMA(): Row[] {
  const stems = [
    'bghit nshri',
    'bghit nshri kit',
    'bghit nshri kit dyalkom',
    'bghit ntleb',
    'bghit ntleb kit',
    'kifach ntleb',
    'kifach nshri',
    'kifach n3mel commande',
    'ndir commande',
    'nshri kit',
    'bghit nakhdo',
    'bghit nakhod',
  ];
  const punct = ['', ' afak', ' khouya', ' bro', '!', '?'];
  return cross(stems, punct, (a, b) => `${a}${b}`).map((text) => ({
    text,
    language: 'ar-MA' as Lang,
    expectedIntent: 'purchase-intent',
  }));
}

// ---------------------------------------------------------------------------
// PURCHASE-INTENT — Arabe MSA
// ---------------------------------------------------------------------------
function genPurchaseAr(): Row[] {
  return [
    'أريد أن أطلب',
    'أريد أن أشتري',
    'أريد الطقم',
    'أريد الكيت',
    'كيف أطلب',
    'كيف أشتري',
    'أطلبه',
    'اشتريه',
    'أريد شراء الكيت',
    'أريد طلب الطقم',
  ].map((text) => ({ text, language: 'ar' as Lang, expectedIntent: 'purchase-intent' }));
}

// ---------------------------------------------------------------------------
// ANTI-PATTERNS (à NE PAS détecter comme purchase-intent)
// Ces lignes sont "rejected" — on les ajoute pour vérifier négateurs.
// ---------------------------------------------------------------------------
function genNegatives(): Row[] {
  return [
    { text: "j'ai déjà acheté", language: 'fr', expectedIntent: 'order-status' },
    { text: 'j’ai déjà acheté hier', language: 'fr', expectedIntent: 'order-status' },
    { text: "j'ai acheté la semaine dernière", language: 'fr', expectedIntent: 'order-status' },
    { text: "j'ai déjà commandé", language: 'fr', expectedIntent: 'order-status' },
    { text: 'ma commande est en retard', language: 'fr', expectedIntent: 'order-status' },
    { text: 'où est ma commande', language: 'fr', expectedIntent: 'order-status' },
  ];
}

// ---------------------------------------------------------------------------
// Assemblage final
// ---------------------------------------------------------------------------
/** Quotas par intent — équilibrer le golden set. */
const QUOTA_BY_INTENT: Record<string, number> = {
  'purchase-intent': 350, // intent commercial fort, le plus critique
  'callback-request': 80,
  negotiation: 100,
  wholesaler: 50,
  pricing: 80,
  shipping: 80,
  ingredient: 30,
  routine: 30,
  'order-status': 40,
  greeting: 18,
};

function build(): Row[] {
  // Purchase-intent : on stratifie par langue pour garantir la couverture
  // multilingue (sinon le sampling FR écrase AR/AR-MA).
  const purchaseFr = uniq(genPurchaseFr());
  const purchaseArMA = uniq(genPurchaseArMA());
  const purchaseAr = uniq(genPurchaseAr());

  // 1. Génère brut (combinatoire sans limite)
  const buckets: Record<string, Row[]> = {
    'callback-request': uniq(genCallbackFr()),
    negotiation: uniq(genNegotiationFr()),
    wholesaler: uniq(genWholesalerFr()),
    pricing: uniq(genPricingFr()),
    shipping: uniq(genShippingFr()),
    ingredient: uniq(genIngredientFr()),
    routine: uniq(genRoutineFr()),
    'order-status': uniq([...genOrderStatusFr(), ...genNegatives()]),
    greeting: uniq(genGreetings()),
  };

  // 2. Sample chaque bucket à son quota
  const out: Row[] = [];
  // Purchase-intent stratifié : tous AR/AR-MA + sample FR
  out.push(...purchaseArMA); // 12-50 cas darija
  out.push(...purchaseAr); // ~10 cas arabe MSA
  const remainingPurchase = Math.max(0, QUOTA_BY_INTENT['purchase-intent'] - purchaseArMA.length - purchaseAr.length);
  out.push(...sample(purchaseFr, remainingPurchase));

  for (const [intent, quota] of Object.entries(QUOTA_BY_INTENT)) {
    if (intent === 'purchase-intent') continue;
    const bucket = buckets[intent] ?? [];
    out.push(...sample(bucket, quota));
  }
  return uniq(out);
}

function main(): void {
  const rows = build();
  const countByIntent: Record<string, number> = {};
  const countByLanguage: Record<string, number> = {};
  for (const r of rows) {
    countByIntent[r.expectedIntent] = (countByIntent[r.expectedIntent] ?? 0) + 1;
    countByLanguage[r.language] = (countByLanguage[r.language] ?? 0) + 1;
  }
  const fixture = {
    version: 1,
    exportedAt: new Date().toISOString(),
    _note:
      'Generated by scripts/generate-intent-golden-extended.ts. Combinatoire de templates pour CHA-231. Inspiré de MASSIVE/Bitext/DODa — sync via scripts/sync-intent-datasets.ts.',
    countByLanguage,
    countByIntent,
    rows,
  };
  const outPath = resolve(process.cwd(), 'tests/golden/intent-extended.json');
  writeFileSync(outPath, JSON.stringify(fixture, null, 2), 'utf8');
  console.log(`[generate-intent-golden-extended] wrote ${rows.length} rows → ${outPath}`);
  console.log(`  countByIntent: ${JSON.stringify(countByIntent)}`);
  console.log(`  countByLanguage: ${JSON.stringify(countByLanguage)}`);
}

main();
