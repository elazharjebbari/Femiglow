/**
 * CHA-035 / CHA-161 / CHA-225 / CHA-230 — `intent.detect`.
 *
 * Heuristique légère qui classe un message visiteur dans un intent
 * éditorial. Ne remplace PAS un classifieur ML — sert seulement à :
 * - choisir un wording approprié dans la réponse,
 * - tracker le funnel (KPI),
 * - alimenter le re-rank RAG (filtrage tags `pricing` vs `routine`).
 * - alimenter `lead-decision` (déclenchement formulaire de capture).
 *
 * Architecture (v2 / CHA-225) :
 *  - Chaque pattern porte un POIDS qui contribue à un score par intent.
 *  - L'intent gagnant est celui avec le score cumulé le plus élevé,
 *    avec un seuil minimal (`MIN_CONFIDENCE_SCORE`) en deçà duquel on
 *    retombe sur 'misc' — utile pour éviter qu'un seul mot ambigu
 *    déclenche un faux positif (ex. "j'ai une commande" pour
 *    `purchase-intent` au lieu de `order-status`).
 *  - L'ordre des intents en cas d'égalité reste celui de la liste
 *    (priorité éditoriale), ce qui préserve la compatibilité.
 *
 * v3 / CHA-230 :
 *  - Élargit `purchase-intent` pour couvrir « commander » seul (sans
 *    préfixe « je veux ») — c'était la cause-racine du bug prod.
 *  - Ajoute `negotiation` (rabais, réduction, marchandage) → escalade
 *    humaine immédiate (politique commerciale : l'IA ne négocie pas).
 *  - Ajoute `wholesaler` (grande quantité, grossiste, distributeur) →
 *    escalade commerciale immédiate (l'IA ne fait pas de pricing volume).
 *
 * cf. docs/chat-assistant/03-backend.md §3.4
 *     docs/chat-assistant/18-instructions-knowledge-strategy.md §6
 *     docs/chat-assistant/CHA-225-classifier.md
 *     docs/chat-assistant/20-langchain-robustness-plan.md §2.6
 */

export type ChatIntent =
  | 'greeting'
  | 'pricing'
  | 'shipping'
  | 'routine'
  | 'ingredient'
  | 'order-status'
  | 'support'
  // CHA-161 — 8 nouveaux intents pour mieux qualifier les conversations
  | 'objection-price'
  | 'objection-doubt'
  | 'social-proof'
  | 'comparison'
  | 'b2b'
  | 'callback-request'
  | 'frustration'
  | 'after-hours'
  // CHA-225 — Intent d'achat explicite : on ne rate pas l'opportunité,
  // on déclenche le formulaire de capture lead dès le 1er tour.
  | 'purchase-intent'
  // CHA-230 — Tentative de négociation/marchandage (rabais, réduction,
  // promo). On escalade systématiquement vers l'humain : l'IA ne
  // négocie pas — ce serait inventer une politique commerciale.
  | 'negotiation'
  // CHA-230 — Demande de gros volume (grossiste, distributeur, revente,
  // institut/salon esthétique). On escalade vers le commercial — pricing
  // volume hors-périmètre IA.
  | 'wholesaler'
  | 'misc';

interface PatternRule {
  intent: ChatIntent;
  patterns: RegExp[];
  /**
   * Patterns "forts" qui valent 2× le score nominal. Utilisés pour les
   * formulations exclusives à un intent (ex. "je veux commander" pour
   * `purchase-intent` ne peut pas vouloir dire autre chose).
   */
  strong?: RegExp[];
  /**
   * Patterns "négateurs" qui invalident l'intent même si un pattern
   * principal a matché. Ex. "j'ai déjà commandé" → ne pas classifier
   * comme `purchase-intent`.
   */
  negate?: RegExp[];
}

/**
 * Score minimum pour qu'un intent gagne. En deçà, on retombe sur 'misc'.
 * Évite les faux positifs sur des messages qui ne contiennent qu'un
 * mot ambigu (ex. "j'ai une commande" tout seul → score 1, devient
 * 'misc' s'il n'y a pas de signal d'achat plus fort).
 */
const MIN_CONFIDENCE_SCORE = 1;

// Patterns multilingues (FR + AR-script + Darija FR-script).
const RULES: PatternRule[] = [
  {
    intent: 'greeting',
    patterns: [
      /\b(bonjour|salut|hello|hi|coucou|bonsoir)\b/i,
      /\b(salam|salem|sbah)\b/i,
      /(السلام|مرحبا|أهلا)/,
    ],
  },
  {
    intent: 'pricing',
    patterns: [
      // CHA-231 — `(?<![a-zA-Zà-ÿ])X(?![a-zA-Zà-ÿ])` simule \b en multilingue
      // (le \b natif JS échoue après les accents é/è/ç).
      /(?<![a-zA-Zà-ÿ])(prix|combien|coute|coûte|tarif|tarifs|cost|price|abordable|c['’]?est\s+combien|ça\s+vaut|ca\s+vaut)(?![a-zA-Zà-ÿ])/i,
      /\b(chhal|kifach taman|t9awim|bch7al)\b/i,
      /(سعر|ثمن|كم)/,
    ],
    // CHA-231 — anti-faux-positifs :
    // - « combien de fois » (routine) ne doit PAS être pricing
    // - « tarif de livraison » est OK comme pricing, mais
    //   « temps de livraison » est shipping (négation needed)
    negate: [
      /\bcombien\s+(de\s+)?(fois|temps)\b/i,
      /\btemps\s+de\s+livraison\b/i,
    ],
  },
  // CHA-230 — Négociation explicite (marchandage / demande de rabais).
  // Doit passer AVANT `objection-price` parce qu'une demande de
  // « réduction » contient le signal cherté ; on veut classer la
  // tentative de marchandage à part pour escalader vers humain.
  {
    intent: 'negotiation',
    // Patterns FORTS — formulations qui ne peuvent PAS vouloir dire autre
    // chose. Ce sont des demandes commerciales actives.
    strong: [
      // CHA-231 — `baisser le prix/tarif` est exclusif à la négociation.
      // On élargit avec « pouvez-vous baisser » même sans complément, et
      // on capture aussi « tarif » seul après « baisser » (sinon
      // « baisser le tarif » match seulement pricing via le mot « tarif »).
      /\b(rabais|remise|n[ée]goci(?:er|ation|ons|able)|baisser\s+(?:le\s+)?(?:prix|tarif|tarifs)|pouvez[-\s]?vous\s+baisser|geste\s+commercial|prix\s+sp[ée]cial|code\s+(?:promo|promotion|reduction|réduction))\b/i,
      /\b(faire\s+un\s+effort|effort\s+commercial|faire\s+un\s+prix)\b/i,
      // Darija : « tnzli/khessmi/3tini takhfid » — demandes explicites de remise.
      /\b(tnzli\s+(?:liya\s+)?(?:taman|prix|chwiya)|khessmi\s+(?:liya\s+)?chi|3tini\s+(?:wahd\s+)?(?:takhfid|tnzil|prix\s+special)|naqsalna|tkhfid|chi\s+takhfid)\b/i,
      // AR : تخفيض / تنزيل الثمن / عرض خاص (formulations de marchandage).
      /(تخفيض|تنزيل\s+الثمن|عرض\s+خاص|كود\s+(?:ترويج|تخفيض))/,
    ],
    patterns: [
      // Réduction/promo demandée explicitement (pas juste « c'est cher »).
      /\b(r[ée]duction|promo|promotion|tarif\s+(?:r[ée]duit|pr[ée]f[ée]rentiel))\b/i,
      // « moins cher / un meilleur prix » — souvent suivi d'une demande.
      /\b(moins\s+cher\s+que|meilleur\s+prix|prix\s+plus\s+bas)\b/i,
      // Marchandage darija (FR-script) — formes plus douces.
      /\b(promo|chi\s+promo)\b/i,
    ],
    // Anti-faux-positifs : si la phrase parle d'une promo passée
    // (« j'ai eu votre promo »), ce n'est pas une négociation.
    negate: [
      /\b(j['’]?ai\s+eu|j['’]?ai\s+vu)\s+(?:votre\s+|la\s+)?(?:promo|r[ée]duction|remise)\b/i,
    ],
  },
  // CHA-161 — Objection prix : pricing + signaux d'hésitation/cherté.
  {
    intent: 'objection-price',
    patterns: [
      /\b(trop cher|cher|abusif|abusé|c['’]est cher|hors budget|pas les moyens|réduction|promo|code promo|moins cher)\b/i,
      /\b(ghali|ghaliya|ma3andich flouss|takhfid|promo)\b/i,
      /(غالي|كثير|تخفيض)/,
    ],
  },
  // CHA-161 — Doute / efficacité : marche / vraiment / arnaque...
  {
    intent: 'objection-doubt',
    patterns: [
      /\b(ça marche|ca marche|vraiment efficace|preuve|prouvé|prouve|arnaque|scam|fake|miracle|trop beau|garantie|si ça marche pas|sinon)\b/i,
      /\b(wach kayn|ka ykhdem|3la s7i7|sahih)\b/i,
      /(فعالية|حقيقي|نصب)/,
    ],
  },
  // CHA-161 — Social proof : témoignages, avis, avant-après.
  {
    intent: 'social-proof',
    patterns: [
      /\b(avis|témoignages|temoignages|review|client|résultat|resultat|avant après|avant\/après|photo|insta|instagram|tiktok)\b/i,
      /\b(chhadat|nass jrebt|shadat dyal nass)\b/i,
      /(آراء|شهادات|نتائج)/,
    ],
  },
  // CHA-161 — Comparaison concurrent / autre marque (à décliner sans nommer).
  {
    intent: 'comparison',
    patterns: [
      /\b(comparé|compare|différence|difference|versus|vs|mieux que|à la place|alternative)\b/i,
      /\b(mou9arana|moqarana|fer9 bin)\b/i,
      /(مقارنة|الفرق)/,
    ],
  },
  // CHA-230 — Fournisseur / grossiste : volume explicite. Doit passer
  // AVANT `b2b` (qui couvre aussi des cas non-volume comme « salon »).
  // Cible : revendeurs, distributeurs, instituts qui veulent du volume.
  {
    intent: 'wholesaler',
    strong: [
      // NB : on utilise des lookarounds avec classe `[a-zA-Zà-ÿ]` parce que
      // le `\b` natif JS est ASCII et ne crée pas de frontière après les
      // lettres accentuées (« quantité » → `é` est non-word → `\b` échoue).
      // Le pattern `(?![a-zA-Zà-ÿ])` simule correctement la fin de mot
      // multilingue et matche aussi "quantité" en fin de phrase.
      /(?<![a-zA-Zà-ÿ])(grande\s+quantit[ée]s?|grosse\s+quantit[ée]s?|gros\s+volume|en\s+gros|achat\s+en\s+gros|grossiste)(?![a-zA-Zà-ÿ])/i,
      // CHA-231 — `revendeur` seul est un signal exclusif wholesaler.
      // On élargit aussi à `partenariat` (très utilisé par les pros).
      /(?<![a-zA-Zà-ÿ])(revendeur|revendeuse|revendeurs|revendre|revente|distribut(?:eur|rice|eurs|rices|ion)|fournisseur|partenariat)(?![a-zA-Zà-ÿ])/i,
      /(?<![a-zA-Zà-ÿ])(plusieurs\s+(?:dizaines|centaines|milliers|kits)|\d{2,}\s+(?:unit[ée]s?|pi[èe]ces?|kits?|bo[iî]tes?))(?![a-zA-Zà-ÿ])/i,
      // Institut/salon de beauté + professionnel(le) esthétique. On accepte
      // le « de l'esthétique » optionnel pour matcher « professionnelle de
      // l'esthétique » (formulation très courante chez les pros MA).
      /(?<![a-zA-Zà-ÿ])(institut\s+de\s+beaut[ée]|salon\s+de\s+beaut[ée]|professionnelle?\s+(?:de\s+l['’]?\s*)?(?:beaut[ée]|esth[ée]tique))(?![a-zA-Zà-ÿ])/i,
      // CHA-231 — « j'ai un institut » / « pour mon institut » → wholesaler
      // (b2b prend les cas génériques mais wholesaler est plus prioritaire
      // pour escalader vers commercial).
      /(?<![a-zA-Zà-ÿ])(j['’]?ai\s+un\s+(?:institut|salon|cabinet|spa)|pour\s+mon\s+(?:institut|salon|cabinet|spa))(?![a-zA-Zà-ÿ])/i,
      // AR : « بالجملة / كميات كبيرة / موزع / إعادة بيع ».
      /(بالجملة|كميات\s+كبيرة|موزع|إعادة\s+بيع|توزيع)/,
      // Darija FR-script : « b jomla / kamiya kbira / mwaza3 / 3awd l bi3 ».
      /\b(b\s+jomla|kamiya\s+kbira|mwaza3|3awd\s+l\s+bi3|bi3\s+jomla)\b/i,
    ],
    patterns: [
      // Volume implicite (« plusieurs unités », « plusieurs pièces »).
      /\b(plusieurs\s+(?:unit[ée]s?|pi[èe]ces?|kits?|exemplaires))\b/i,
      // Pharmacie professionnelle (vente en officine).
      /\b(pharmacie)\b/i,
    ],
  },
  // CHA-161 — B2B : revente, gros, salon, professionnel.
  {
    intent: 'b2b',
    patterns: [
      /\b(revente|revendre|grossiste|gros|distributeur|distribut|salon|esthétic|esthetic|professionn|institut|spa|cabinet)\b/i,
      /\b(b2b|whole sale|wholesale)\b/i,
      /\b(byi3|ti9niya|salon dyal)\b/i,
      /(جملة|موزع|محترف)/,
    ],
  },
  // CHA-161 — Demande explicite de rappel / contact humain.
  {
    intent: 'callback-request',
    // CHA-231 — patterns FORTS pour les demandes de rappel directes.
    // « rappelez-moi / rappele-moi / appelez-moi » sont des demandes
    // exclusivement transactionnelles → score 2 pour battre routine.
    strong: [
      // « rappelle-moi / rappelez moi / rappele moi » — toutes les
      // inflexions du verbe rappeler avec « moi » (avec ou sans tiret).
      /(?<![a-zA-Zà-ÿ])(rappel[a-zà-ÿ]{0,4})[\s-]+moi(?![a-zA-Zà-ÿ])/i,
      // « appelle-moi / appelez moi » — verbe appeler avec « moi ».
      /(?<![a-zA-Zà-ÿ])(appel[a-zà-ÿ]{0,4})[\s-]+moi(?![a-zA-Zà-ÿ])/i,
      // « pouvez-vous me rappeler/appeler » — formulation polie.
      /\bpouvez[-\s]?vous\s+me\s+(?:rappeler|appeler)\b/i,
      // « je veux/voudrais qu'on me rappelle » / « rappel téléphonique ».
      /\b(rappel\s+t[ée]l[ée]phonique|qu['’]on\s+me\s+rappelle)\b/i,
    ],
    patterns: [
      // CHA-231 — multilingual word boundary pour les inflexions
      // (rappelle, rappelez, rappellement, appel, appelez…).
      // Le `\w*` ne marche pas sur les accents donc on liste explicitement.
      /(?<![a-zA-Zà-ÿ])(rappel|rappelle|rappelez|rappele|rappeler|appel|appeler|appelez|appelle|t[ée]l[ée]phon[a-zà-ÿ]*|whats?app|conseill[a-zà-ÿ]*|humain|agent|live)(?![a-zA-Zà-ÿ])/i,
      /\b(parler\s+[àa]|parler\s+avec)\b/i,
      /\b(3yt liya|sift liya|kaykellem ma3aya|wahed humain|wahed insan)\b/i,
      /(اتصل|اتصلوا|واتساب|متصل)/,
    ],
  },
  // CHA-161 — Frustration / impatience : signaux émotionnels.
  // CHA-230 v7 — Élargi : énervé / inadmissible / personne ne répond /
  // marre / scandale / honteux / mécontent. Ces formulations sont
  // courantes en prod et doivent déclencher l'escalade humaine via
  // la règle frustration de `lead-decision`.
  {
    intent: 'frustration',
    // Patterns FORTS — formulations à charge émotionnelle exclusives
    // qui n'ont aucun autre sens raisonnable dans un contexte support.
    // CHA-230 v7 — On utilise les lookarounds `(?<![a-zA-Zà-ÿ])...(?![a-zA-Zà-ÿ])`
    // au lieu de `\b` pour les mots qui contiennent des accents : le `\b`
    // natif JS ne fonctionne pas correctement après une lettre non-ASCII
    // (« énervée », « décevant » → `é` n'est pas un word char → pas de boundary).
    strong: [
      /(?<![a-zA-Zà-ÿ])(inadmissible|inacceptable|scandaleux|scandale|honteux|honte)(?![a-zA-Zà-ÿ])/i,
      /(?<![a-zA-Zà-ÿ])([ée]nerv[ée]e?s?|en\s+col[èe]re|furieuse?s?|furieux)(?![a-zA-Zà-ÿ])/i,
      /(?<![a-zA-Zà-ÿ])(personne\s+ne\s+(r[ée]pond|me\s+r[ée]pond|me\s+rappelle|m['’]?aide))(?![a-zA-Zà-ÿ])/i,
      /\bj['’]?en\s+ai\s+marre\b/i,
      /\b(c['’]?est\s+(?:vraiment\s+)?(?:nul|n['’]?importe\s+quoi|une\s+honte))\b/i,
      /(?<![a-zA-Zà-ÿ])(c['’]?est\s+(?:vraiment\s+)?abus[ée]?)(?![a-zA-Zà-ÿ])/i,
    ],
    patterns: [
      /\b(j['’]ai déjà demandé|encore|toujours pas|pas de réponse|n['’]importe quoi|ça suffit|tu comprends pas|on tourne en rond)\b/i,
      /(?<![a-zA-Zà-ÿ])(m[ée]content[ée]?s?|pas\s+content[ée]?s?|d[ée]çue?s?|d[ée]cevant[ée]?s?)(?![a-zA-Zà-ÿ])/i,
      /\b(safi|baraka|kheliw|matb9awch)\b/i,
      /(يكفي|تكلم بصراحة|محتقن|متضايقة|متضايق)/,
    ],
  },
  {
    intent: 'shipping',
    // CHA-231 — patterns forts : « vous livrez à X / temps de livraison »
    // sont presque exclusivement shipping.
    strong: [
      /(?<![a-zA-Zà-ÿ])(vous\s+livrez|temps\s+de\s+livraison|d[ée]lai\s+de\s+livraison|livraison\s+(?:en\s+)?(?:combien|quand|sous))(?![a-zA-Zà-ÿ])/i,
      /(?<![a-zA-Zà-ÿ])(livrez\s+(?:[àa]|au|aux|en|sur)|livraison\s+(?:[àa]|au|aux|en|sur))(?![a-zA-Zà-ÿ])/i,
      /(?<![a-zA-Zà-ÿ])(livraison\s+gratuite|frais\s+de\s+livraison|frais\s+de\s+port)(?![a-zA-Zà-ÿ])/i,
    ],
    patterns: [
      // CHA-231 — multilingual word boundary (le `\b` natif ne matche
      // PAS après une lettre accentuée — « livré » → `é` non-word →
      // pas de boundary). On liste explicitement les inflexions courantes.
      /(?<![a-zA-Zà-ÿ])(livr[ée]e?s?|livre?z?|livraison|livrer|livrons|livraisons|exp[ée]di[a-zà-ÿ]*|d[ée]lai[a-zà-ÿ]*|delivery|shipping|colis|tracking)(?![a-zA-Zà-ÿ])/i,
      /\b(toussel|wsoul|delai dyal)\b/i,
      /(توصيل|ارسال|متى)/,
    ],
  },
  // CHA-225 — Intent d'achat explicite. Doit être détecté AVANT
  // `order-status` parce que les mots clés se recouvrent ("je veux
  // commander" contient "commande"). En cas d'ambiguïté, on préfère
  // déclencher le formulaire de capture lead plutôt que de partir
  // sur un suivi de commande.
  {
    intent: 'purchase-intent',
    // Patterns FORTS — formulations exclusives, score 2.
    strong: [
      // Phrases d'achat explicite qui ne peuvent PAS vouloir dire suivi.
      // CHA-230 v3 — On accepte jusqu'à 3 mots entre le modal et le verbe
      // d'action pour capter les insertions courantes :
      //   « je souhaite au fait commander »  (bug prod 2026-05-07)
      //   « je veux donc commander »
      //   « je voudrais vraiment bien commander »
      // On ajoute aussi `aimerais` / `voulais` (formulations polies).
      // Le `[a-zA-Zà-ÿ'’-]+` limite les insertions à des mots sans
      // ponctuation lourde, ce qui évite de chevaucher 2 phrases.
      // CHA-230 v6 — Le `(?:l['’])?` capte l'élision « l'acheter / l'commander »
      // (bug prod 2026-05-08 : « Je veux l'acheter » tombait en misc parce
      // que l'apostrophe casse le `[a-zA-Zà-ÿ'’-]+\s+` qui exigeait un
      // espace après le pronom).
      // CHA-231 — On ajoute `on` comme sujet alternatif (« on veut acheter
      // / on voudrait commander ») et `finaliser` au verbe d'action
      // (« finaliser ma commande / finaliser l'achat »). On élargit aussi
      // les inflexions du modal (veut/voudrait/voulons/voulez/aimerions...).
      /\b(je|on)\s+(veux|veut|voudrais|voudrait|voudrions|voudriez|souhaite|souhaitons|souhaitez|peux|peut|vais|va|aimerais|aimerait|aimerions|aimeriez|voulais|voulait|voulions|voulez)\s+(?:[a-zA-Zà-ÿ'’-]+\s+){0,3}(?:l['’])?(commander|acheter|prendre|payer|finaliser)\b/i,
      // Variante sans modal explicite : « j'aimerais ... commander » via
      // l'élision « j' » (cas où le tokenizer ne voit pas l'espace).
      /\bj['’]?aimerais\s+(?:[a-zA-Zà-ÿ'’-]+\s+){0,3}(?:l['’])?(commander|acheter|prendre|payer|finaliser)\b/i,
      // CHA-231 — « finaliser/valider/payer ma commande » : finalisation
      // active = purchase-intent (et non order-status). Le negate
      // ci-dessous a été affiné pour ne PAS tuer ce cas.
      /\b(finaliser|valider|effectuer|compl[ée]ter|payer)\s+(ma|une|cette|la|notre|leur)\s+commande\b/i,
      /\bfinaliser\s+(?:l['’]?)?(achat|paiement|commande)\b/i,
      /\b(j['’]?achète|j['’]?ach[eè]te|je\s+l['’]?achète|je\s+le\s+prends|je\s+les\s+prends)\b/i,
      /\b(passer|faire|valider)\s+(une\s+|la\s+)?commande\b/i,
      /\bok\s+je\s+(prends|commande|veux|achète)\b/i,
      // CHA-230 — Verbes d'action SEULS, sans préfixe « je veux ». Cas
      // reporté en prod : « commander » → ne matchait aucun pattern, on
      // tombait sur `misc` et le formulaire ne s'affichait pas.
      // On les classe en STRONG parce qu'à l'impératif/infinitif, ces
      // verbes sont presque exclusivement transactionnels (le négateur
      // « j'ai déjà commandé » plus bas écarte les faux positifs).
      /^\s*(commander|acheter|order|buy|achat|tlb|tleb)\s*[!?.…]?\s*$/i,
      /^\s*(je\s+(veux|voudrais)\s+commander)\s*[!?.…]?\s*$/i,
      // CHA-230 v5 — « achat » avec petit complément de politesse ou objet.
      // Cas reporté en prod : « achat svp », « achat du kit », « pour
      // l'achat », « faire un achat » → tombaient en misc parce que la
      // forme « SEUL » plus haut exigeait un mot isolé. Ces formulations
      // sont presque exclusivement transactionnelles → strong.
      /\b(faire|passer|effectuer|valider|finaliser)\s+(un\s+|mon\s+|cet?\s+|son\s+)?achat\b/i,
      /\bje\s+(veux|voudrais|souhaite|aimerais|peux|vais)\s+(faire|passer|effectuer)\s+(un\s+|mon\s+)?achat\b/i,
      // « pour achat », « pour acheter », « pour faire un achat ».
      /\bpour\s+(faire\s+(un\s+)?|un\s+|mon\s+)?(achat|acheter)\b/i,
      /\b(l['’]?|un\s+|mon\s+)achat\s+(du|de\s+(la|votre|ce))\s+kit\b/i,
      /^\s*achat\s+(svp|s['’]?il\s+vous\s+pla[iî]t|please|pls|stp)\s*[!?.…]?\s*$/i,
      // « achat du kit » avec politesse optionnelle en suffixe.
      /^\s*achat\s+du\s+kit(\s+(svp|s['’]?il\s+vous\s+pla[iî]t|please|pls|stp))?\s*[!?.…]?\s*$/i,
      // Darija : "bghit nshri/ntleb" et "kifach ntleb/nshri" — ces phrases
      // sont uniques au "comment commander/acheter" en darija → score 2.
      /\bbghit\s+(nshri|ntleb|nakhdo|nakhod)\b/i,
      /\bkifach\s+(ntleb|nshri|n3mel\s+commande)\b/i,
      // CHA-231 — Darija : « nshri/ntleb » SEUL avec « kit/hadshi/chi »
      // (sans bghit). « nshri kit » = je veux acheter le kit, formulation
      // courante en chat où le verbe modal est omis.
      /\b(nshri|ntleb|nakhdo|nakhod)\s+(kit|hadshi|chi|dakshi)\b/i,
      // AR : "je veux commander/acheter".
      // CHA-231 — On élargit pour matcher « أريد شراء الكيت / الطقم » et
      // « أريد طلب الطقم » — ces formes contiennent « شراء/طلب » comme
      // nom verbal (masdar), donc on accepte l'une OU l'autre.
      /(أريد\s+(?:أن\s+)?(?:أطلب|أشتري|شراء|طلب|أن\s+أشتري|أن\s+أطلب)|أطلبه|اشتريه|أريد\s+(?:الطقم|الكيت|شراء\s+الكيت|طلب\s+الطقم|شراء\s+الطقم|طلب\s+الكيت))/,
      // CHA-230 v7 — Darija en SCRIPT ARABE (gap pré-existant). « بغيت »
      // = « je veux » en darija (cf. DARIJA_AR_TOKENS dans dictionary.ts).
      // Le détecteur de langue identifie correctement ces messages en
      // `ar-MA`, mais aucun pattern d'intent ne couvrait le couple
      // (بغيت + verbe d'achat) ni le verbe d'achat seul + objet kit.
      // Conséquence prod : « بغيت نشري الكيت » tombait en `misc` →
      // pas de form. On corrige ici avec deux patterns symétriques
      // aux variantes script latin déjà présentes (bghit nshri / nshri kit).
      /(بغيت|بغينا)\s+(نشري|نطلب|ناخد|ناخذ|نشريه|نطلبه|ندير\s+طلب|ندير\s+كوموند)/,
      /(نشري|نطلب|ناخد|ناخذ)\s+(الكيت|الطقم|هاد\s+الكيت|هاد\s+الطقم|هادشي|دكشي)/,
      // « بغيت + objet » sans verbe explicite (« بغيت الكيت » = « je veux le kit »).
      /بغيت\s+(الكيت|الطقم|هاد\s+الكيت|هاد\s+الطقم)/,
    ],
    patterns: [
      /\bje\s+(veux|voudrais|souhaite|peux|vais)\s+(le\s+kit|votre\s+kit|ce\s+kit)\b/i,
      /\bcomment\s+(je\s+)?(commande[r]?|achète|ach[eè]ter|peux\s+commander|passer\s+commande)\b/i,
      /\b(envoyez|envoie|envoyer)[\s-]+moi\s+(le\s+)?kit\b/i,
      /\b(formulaire|tu\s+as\s+un\s+formulaire|donnez[-\s]?moi\s+(le\s+)?formulaire)\b/i,
      /\bndir\s+commande\b/i,
      /(أريد\s+(الطقم|الكيت)|كيف\s+(أطلب|أشتري))/,
    ],
    // Négateurs — si l'utilisateur parle d'une commande passée, ce
    // n'est PAS un signal d'achat (c'est `order-status`).
    // CHA-230 v5 — On étend aussi à « j'ai déjà acheté » pour symétrie.
    // CHA-231 — On retire le bare `\bma\s+commande\b` (trop large : il
    //   tuait « finaliser ma commande » qui est PURCHASE-intent).
    //   On garde seulement les formes claires de SUIVI :
    //   « ma commande est », « où est ma commande », « suivi/suivre ma commande ».
    negate: [
      /\bj['’]ai\s+(déjà\s+)?command[ée]\b/i,
      /\bj['’]ai\s+(déjà\s+)?ach[eè]t[eé]\b/i,
      /\bj['’]ai\s+pass[ée]?\s+(une\s+)?commande\b/i,
      /\bma\s+commande\s+(?:est|n['’]?est|a|n['’]?a|n['’]?arrive)\b/i,
      /\boù\s+est\s+ma\s+commande\b/i,
      /\b(suivre|suivi\s+de)\s+ma\s+commande\b/i,
    ],
  },
  {
    intent: 'routine',
    // CHA-231 — patterns FORTS : « comment ça marche / fois par jour /
    // comment l'appliquer » sont presque exclusifs à la routine.
    strong: [
      /\bcomment\s+(?:ça|ca)\s+marche\b/i,
      /\b(?:combien\s+de\s+)?fois\s+par\s+jour\b/i,
      /\bcomment\s+(?:l['’]?|le\s+|la\s+)?appliquer\b/i,
      /\bcomment\s+(?:l['’]?|le\s+|la\s+)?utiliser\b/i,
    ],
    patterns: [
      // CHA-231 — multilingual word boundary pour matcher « étape /
      // étapes / matin / soir » qui contiennent des accents ou des
      // formes ambiguës.
      /(?<![a-zA-Zà-ÿ])(rituel|routine|[ée]tapes?|comment\s+utiliser|use\s+it|application|matin|soir|posologie)(?![a-zA-Zà-ÿ])/i,
      /\b(kifach n3mel|nesta3mel)\b/i,
      /(كيفاش|كيف استعمل)/,
    ],
  },
  {
    intent: 'ingredient',
    // CHA-231 — patterns FORTS : « INCI / matières premières / c'est quoi
    // dedans » sont exclusifs à l'intent ingredient.
    strong: [
      /(?<![a-zA-Zà-ÿ])(inci|liste\s+inci|mati[èe]res\s+premi[èe]res|c['’]?est\s+quoi\s+dedans|de\s+quoi\s+(?:c['’]?est|est)\s+fait)(?![a-zA-Zà-ÿ])/i,
      /(?<![a-zA-Zà-ÿ])(ingr[ée]dients?|ingredients?)(?![a-zA-Zà-ÿ])/i,
    ],
    patterns: [
      // CHA-231 — multilingual word boundary (le `\b` natif JS échoue
      // sur les accents : « ingrédients » / « formule » / « naturel »).
      /(?<![a-zA-Zà-ÿ])(composition|paraben[s]?|silicone[s]?|naturel|naturelle|bio|formula|formule|toxic|toxique)(?![a-zA-Zà-ÿ])/i,
      /\b(mkawnat|tabi3i)\b/i,
      /(مكونات|طبيعي)/,
    ],
  },
  {
    intent: 'order-status',
    patterns: [
      // Inflected forms : "commande", "commandée", "commandés", "commandé".
      // NB : `\b...\b` ne matche pas les terminaisons accentuées (é/è) en
      // JS sans flag /u. On utilise une assertion lookahead/behind ASCII
      // pour borner correctement le mot.
      /(?<![a-zA-Zà-ÿ])(command[eé]e?s?|order|suivi|tracking|expédiée|expediee|reçue?s?|recue?s?|envoyée?s?|envoy)(?![a-zA-Zà-ÿ])/i,
      /\b(commande dyali|wach toussel)\b/i,
      /(طلب|طلبية)/,
    ],
    // CHA-231 — anti-faux-positifs : « أريد شراء/طلب الطقم » est un
    // intent d'achat, pas un suivi. La présence de أريد/أطلبه/اشتريه
    // (verbes au futur d'achat) invalide order-status.
    negate: [
      /(?:أريد\s+(?:طلب|شراء|أن\s+أطلب|أن\s+أشتري)|أطلبه|اشتريه|أريد\s+(?:الطقم|الكيت))/,
    ],
  },
  {
    intent: 'support',
    patterns: [
      /\b(probleme|problème|aide|help|cassé|defectueux|défectueux|remboursement|retour|return|refund)\b/i,
      /\b(mochkil|3awnini)\b/i,
      /(مشكلة|مساعدة)/,
    ],
  },
];

/**
 * Score d'un intent sur un texte. Algorithme :
 *  - +1 par match dans `patterns`,
 *  - +2 par match dans `strong`,
 *  - 0 (intent invalidé) si AU MOINS un `negate` matche.
 *
 * Le scoring permet de gérer les cas ambigus :
 *   - "je veux commander le kit" → 1 strong (je veux commander) + 0
 *     standard = 2 → purchase-intent gagne.
 *   - "j'ai déjà commandé" → match dans patterns d'order-status, mais
 *     les négateurs de purchase-intent l'invalident → reste correct.
 */
function scoreIntent(rule: PatternRule, text: string): number {
  if (rule.negate?.some((p) => p.test(text))) return 0;
  let score = 0;
  for (const p of rule.strong ?? []) {
    if (p.test(text)) score += 2;
  }
  for (const p of rule.patterns) {
    if (p.test(text)) score += 1;
  }
  return score;
}

/**
 * Détection d'intent par scoring pondéré.
 *
 * - Garde l'ordre `RULES` comme tie-breaker (priorité éditoriale).
 * - Retombe sur 'misc' sous le seuil `MIN_CONFIDENCE_SCORE`.
 *
 * Reste rétro-compatible avec l'ancienne API booléenne — pour la
 * majorité des entrées, le résultat est identique.
 */
export function detectIntent(text: string): ChatIntent {
  if (!text || text.trim().length === 0) return 'misc';

  let bestIntent: ChatIntent = 'misc';
  let bestScore = 0;

  for (const rule of RULES) {
    const score = scoreIntent(rule, text);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = rule.intent;
    }
  }

  return bestScore >= MIN_CONFIDENCE_SCORE ? bestIntent : 'misc';
}

/**
 * Variante avec le score retourné — utile pour les tests et le debug
 * admin. Ne fait PAS partie de l'API publique stable.
 */
export interface IntentClassification {
  intent: ChatIntent;
  score: number;
  /** Map intent → score (uniquement les non-zéro) pour le debug. */
  alternatives: Partial<Record<ChatIntent, number>>;
}

export function classifyIntent(text: string): IntentClassification {
  if (!text || text.trim().length === 0) {
    return { intent: 'misc', score: 0, alternatives: {} };
  }
  const alternatives: Partial<Record<ChatIntent, number>> = {};
  let bestIntent: ChatIntent = 'misc';
  let bestScore = 0;

  for (const rule of RULES) {
    const score = scoreIntent(rule, text);
    if (score > 0) alternatives[rule.intent] = score;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = rule.intent;
    }
  }

  if (bestScore < MIN_CONFIDENCE_SCORE) {
    return { intent: 'misc', score: 0, alternatives };
  }
  return { intent: bestIntent, score: bestScore, alternatives };
}

/**
 * Heuristique horaire : si la conversation se passe en dehors des horaires
 * (lun–sam 9h–17h, fuseau MA = Africa/Casablanca = UTC+1), on tagge le
 * tour comme `after-hours` pour adapter la copy d'invite.
 *
 * On utilise UTC + offset fixe ; pas de DST en MA depuis 2018.
 */
export function isAfterHoursMA(now: Date = new Date()): boolean {
  // UTC+1 en permanence
  const local = new Date(now.getTime() + 60 * 60 * 1000);
  const day = local.getUTCDay(); // 0 dim ... 6 sam
  const h = local.getUTCHours();
  // Dimanche = fermé
  if (day === 0) return true;
  // Hors créneau 9h–17h = after-hours
  if (h < 9 || h >= 17) return true;
  return false;
}

export const intent = { detect: detectIntent, isAfterHoursMA };
