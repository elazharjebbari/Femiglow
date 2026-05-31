/**
 * Source de vérité pour la stratégie d'audiences GA4 → Google Ads.
 *
 * Utilisée à la fois par :
 *   - le panneau help admin (`AudienceStrategyPanel.tsx`)
 *   - le générateur de fichier .txt téléchargeable
 *
 * La structure est faite pour rester data-driven : ajouter / modifier
 * une audience modifie automatiquement l'UI ET le fichier exporté.
 */

export type FunnelStage =
  | 'tofu'
  | 'mofu'
  | 'bofu'
  | 'hot'
  | 'customer'
  | 'exclusion';

export interface AudienceDef {
  /** Nom GA4 (suit la convention `aud_<stage>_<descriptor>_<recency>d`). */
  name: string;
  stage: FunnelStage;
  /** Fenêtre temporelle (jours). */
  recencyDays: number;
  /** Taille estimée — utile pour gérer la dilution publicitaire. */
  size: 'XL' | 'L' | 'M' | 'S' | 'XS';
  /** Pourquoi cette audience existe (1 phrase). */
  purpose: string;
  /**
   * Définition GA4 (règle "Include" / "Exclude" en pseudo-syntaxe).
   * Format compatible avec l'éditeur d'audiences GA4 (Admin → Audiences
   * → New audience → Custom).
   */
  rule: string;
  /** Stratégie marketing : comment l'utiliser. */
  strategy: string;
  /**
   * Types de campagnes Google Ads / GA4 où cette audience excelle.
   * Ordre : recommandation primaire → secondaires.
   */
  campaigns: string[];
}

/* ───────────────────────────────────────────────────────────────────
 * EVENTS GA4 à marquer comme "Use as audience trigger"
 * ─────────────────────────────────────────────────────────────────── */

export interface AudienceEvent {
  name: string;
  description: string;
  /** Marquer aussi comme Conversion dans GA4 ? */
  asConversion?: boolean;
}

export const AUDIENCE_TRIGGER_EVENTS: AudienceEvent[] = [
  // Engagement / TOFU
  { name: 'page_view', description: 'Vue de page (auto, baseline)' },
  { name: 'scroll_depth', description: 'Profondeur de scroll (75% / 90%)' },
  { name: 'video_complete', description: 'Vidéo regardée à 100%' },
  { name: 'video_user_play', description: 'Vidéo lancée par clic utilisateur (vs autoplay)' },
  { name: 'fg_journal_read_75', description: 'Article du Journal lu à 75%' },
  { name: 'fg_journal_read_100', description: 'Article du Journal lu à 100%' },
  { name: 'fg_section_view', description: 'Section de page vue (>50% viewport, >3s)' },
  { name: 'view_promotion', description: 'Bannière promo affichée' },
  { name: 'select_promotion', description: 'Bannière promo cliquée' },
  // Produit / MOFU
  { name: 'view_item', description: 'Page produit vue (rituel, kit)', asConversion: false },
  { name: 'view_item_list', description: 'Liste produits vue (page /kit)' },
  { name: 'select_item', description: 'Produit cliqué depuis la liste' },
  { name: 'fg_composition_open', description: 'Composition / ingrédients ouverts' },
  { name: 'fg_faq_view', description: 'FAQ consultée' },
  { name: 'chat_widget_open', description: 'Chat ouvert' },
  { name: 'chat_message_sent', description: '1er message envoyé dans le chat' },
  { name: 'newsletter_submit', description: 'Inscription newsletter (double opt-in)' },
  // Intent / BOFU
  { name: 'add_to_cart', description: 'Ajout au panier', asConversion: false },
  { name: 'view_cart', description: 'Panier consulté' },
  { name: 'mini_cart_open', description: 'Mini-panier ouvert (header)' },
  { name: 'form_start', description: 'Formulaire lead démarré' },
  { name: 'form_field_focus', description: 'Focus sur un champ du formulaire' },
  { name: 'chat_lead_form_view', description: 'Mini-formulaire lead chat affiché' },
  // Hot
  { name: 'checkout_intent', description: 'Checkout entamé (1er char form)', asConversion: true },
  { name: 'begin_checkout', description: 'Checkout (legacy, double-track)' },
  { name: 'add_shipping_info', description: 'Adresse de livraison saisie' },
  { name: 'address_completed', description: 'Adresse complète validée' },
  { name: 'add_payment_info', description: 'Page paiement atteinte' },
  { name: 'chat_lead_form_focus', description: 'Focus sur formulaire lead chat' },
  // Conversion
  { name: 'purchase', description: 'Achat confirmé', asConversion: true },
  { name: 'lead_capture', description: 'Lead capturé (wizard FemiGlow)', asConversion: true },
  { name: 'generate_lead', description: 'Lead générique', asConversion: true },
  { name: 'sign_up', description: 'Inscription compte' },
  { name: 'contact_submit', description: 'Form contact soumis', asConversion: true },
  // Négatifs (anti-burnout, churn detection)
  { name: 'form_abandon', description: 'Formulaire abandonné (perte focus longue)' },
  { name: 'wizard_abandoned', description: 'Wizard FemiGlow abandonné' },
  { name: 'chat_lead_form_dismiss', description: 'Mini-form lead chat fermé' },
];

/* ───────────────────────────────────────────────────────────────────
 * AUDIENCES (par stage funnel)
 * ─────────────────────────────────────────────────────────────────── */

export const AUDIENCES: AudienceDef[] = [
  /* ─── TOFU ─────────────────────────────────────────────────────── */
  {
    name: 'aud_tofu_visitor_30d',
    stage: 'tofu',
    recencyDays: 30,
    size: 'XL',
    purpose:
      'Pool de retargeting le plus large : tout visiteur ayant chargé une page dans les 30 derniers jours.',
    rule: `Include : event "page_view" any time
Membership duration : 30 days`,
    strategy:
      "Filet de sécurité retargeting. Utilisée comme audience par défaut pour des campagnes brand awareness ou Demand Gen avec un message générique. ROI plus faible que les audiences plus engagées — sert surtout à amorcer le funnel.",
    campaigns: [
      'Demand Gen (broad reach)',
      'Display Network — Smart Display',
      'YouTube Awareness',
    ],
  },
  {
    name: 'aud_tofu_engaged_session_30d',
    stage: 'tofu',
    recencyDays: 30,
    size: 'L',
    purpose:
      'Visiteur engagé : scroll 75%+ OU temps sur page > 60s. Signal qualitatif vs simple bounce.',
    rule: `Include : event "scroll_depth" parameter percent >= 75
  OR  event "user_engagement" parameter engagement_time_msec >= 60000
Membership duration : 30 days`,
    strategy:
      "Pool intermédiaire : signal de qualité de session (vs bounce trafic Display de mauvaise qualité). Idéal pour Lookalike (Customer Match upload nécessite seed = a minima cette audience).",
    campaigns: [
      'Demand Gen (engaged seed)',
      'YouTube Discovery (similar audiences)',
      'Display Remarketing soft',
    ],
  },
  {
    name: 'aud_tofu_journal_reader_30d',
    stage: 'tofu',
    recencyDays: 30,
    size: 'M',
    purpose:
      'Lecteur de contenu éditorial (Journal lu à 75%+). Brand-aware, intéressé par la philosophie produit.',
    rule: `Include : event "fg_journal_read_75" OR "fg_journal_read_100"
Membership duration : 30 days`,
    strategy:
      "Cœur de cible brand : conversion plus lente mais valeur vie client plus haute. Idéale pour des campagnes éducatives (vidéos, témoignages) qui transforment l'intérêt éditorial en intérêt produit.",
    campaigns: [
      'YouTube Discovery (témoignages, behind-the-scenes)',
      'Demand Gen (storytelling)',
      'Display brand reassurance',
    ],
  },
  {
    name: 'aud_tofu_video_engaged_30d',
    stage: 'tofu',
    recencyDays: 30,
    size: 'M',
    purpose:
      'A regardé une vidéo en entier OU lancé manuellement une vidéo (signal d\'intérêt actif vs autoplay subi).',
    rule: `Include : event "video_complete"
  OR  event "video_user_play"
Membership duration : 30 days`,
    strategy:
      "L'engagement vidéo est le meilleur prédicteur de conversion après le ajout-panier. Utiliser pour remarketing YouTube (auto-similar audiences) et pour exclure des audiences acquisition pure.",
    campaigns: [
      'YouTube Remarketing (séquences)',
      'YouTube similar audiences (seed)',
      'Demand Gen mid-funnel',
    ],
  },
  {
    name: 'aud_tofu_kit_section_viewer_30d',
    stage: 'tofu',
    recencyDays: 30,
    size: 'L',
    purpose:
      'A consulté la page /kit ou une section gamme produit. Signal de curiosité produit sans intent direct.',
    rule: `Include : event "view_item_list" parameter page_path = "/kit"
  OR  event "fg_section_view" parameter section IN ("kit","gamme","produits")
Membership duration : 30 days`,
    strategy:
      "Pont entre découverte et considération. Lancer du retargeting produit ici converti mieux que TOFU générique. Tester des Display ads orientées 'qu'est-ce qu'un kit FemiGlow ?'.",
    campaigns: ['Display retargeting produit', 'Demand Gen mid-funnel', 'RLSA Search brand'],
  },

  /* ─── MOFU ─────────────────────────────────────────────────────── */
  {
    name: 'aud_mofu_product_viewer_30d',
    stage: 'mofu',
    recencyDays: 30,
    size: 'L',
    purpose:
      'A vu une page produit (rituel, kit individuel). Considération active, n\'a pas encore ajouté panier.',
    rule: `Include : event "view_item"
Exclude : event "purchase" OR "add_to_cart"
Membership duration : 30 days`,
    strategy:
      "Audience pivot : meilleur ratio coût/conversion en retargeting. Mettre les meilleurs créas (UGC, démonstration produit, social proof). Bidder agressivement sur Search RLSA.",
    campaigns: [
      'Display retargeting (UGC)',
      'Search RLSA (bid +50%)',
      'Performance Max retargeting',
      'YouTube remarketing produit',
    ],
  },
  {
    name: 'aud_mofu_product_viewer_7d',
    stage: 'mofu',
    recencyDays: 7,
    size: 'M',
    purpose:
      'Variante haute-fréquence : a vu produit dans les 7 derniers jours, signal d\'intérêt frais.',
    rule: `Include : event "view_item"
Exclude : event "purchase" OR "add_to_cart"
Membership duration : 7 days`,
    strategy:
      "Pour Display agressif court-terme : bid+, fréquence 5-7/semaine. À combiner avec exclusion `aud_excl_buyer_30d`.",
    campaigns: ['Display retargeting agressif', 'YouTube remarketing 7d'],
  },
  {
    name: 'aud_mofu_composition_curious_30d',
    stage: 'mofu',
    recencyDays: 30,
    size: 'S',
    purpose:
      "A ouvert la composition / liste d'ingrédients. Intent niche-product (cosmétique propre, allergies, vérifications).",
    rule: `Include : event "fg_composition_open"
Membership duration : 30 days`,
    strategy:
      "Très haut intent qualitatif : ces visiteurs ont une exigence formulation. Adresser avec créas axées 'ingrédients clean', certifications, transparence. Excellent seed Lookalike (acheteurs futurs).",
    campaigns: ['Display niche', 'Search RLSA brand + ingredient queries', 'Lookalike seed'],
  },
  {
    name: 'aud_mofu_faq_reader_30d',
    stage: 'mofu',
    recencyDays: 30,
    size: 'S',
    purpose: 'A consulté la FAQ. Signal de questions/objections non résolues.',
    rule: `Include : event "fg_faq_view"
Membership duration : 30 days`,
    strategy:
      "Audience à objections : ne pas lui montrer une pub produit mais une pub qui répond aux questions courantes (livraison, garantie, mode d'emploi, return policy). Réduit drastiquement le CPL.",
    campaigns: [
      'Display objection-handling',
      'RLSA Search avec ad copy "garantie / livraison Maroc"',
    ],
  },
  {
    name: 'aud_mofu_chat_engaged_14d',
    stage: 'mofu',
    recencyDays: 14,
    size: 'S',
    purpose: 'A interagi avec le chat IA (ouverture + au moins 1 message envoyé).',
    rule: `Include : event "chat_message_sent"
Membership duration : 14 days`,
    strategy:
      "Interaction conversationnelle = très haut intent. Suivi email (depuis lead capture chat) + retargeting Display avec rappel personnalisé. Window 14j car la conversation est récente.",
    campaigns: ['Email retargeting', 'Display brand reassurance', 'RLSA Search'],
  },
  {
    name: 'aud_mofu_newsletter_subscriber_180d',
    stage: 'mofu',
    recencyDays: 180,
    size: 'M',
    purpose: "Inscrit newsletter (double opt-in). Signal d'engagement opt-in fort.",
    rule: `Include : event "newsletter_submit"
Membership duration : 180 days`,
    strategy:
      "Seed Lookalike de qualité. À utiliser surtout pour : (1) exclusion campagnes acquisition (déjà engagé), (2) Customer Match upload Google Ads pour Lookalike, (3) re-engagement saisonnier.",
    campaigns: ['Customer Match (Lookalike seed)', 'Display saisonnier', 'YouTube re-engagement'],
  },

  /* ─── BOFU ─────────────────────────────────────────────────────── */
  {
    name: 'aud_bofu_cart_abandoner_14d',
    stage: 'bofu',
    recencyDays: 14,
    size: 'M',
    purpose: "A ajouté un produit au panier sans acheter. Pivot conversion classique.",
    rule: `Include : event "add_to_cart"
Exclude : event "purchase"
Membership duration : 14 days`,
    strategy:
      "Standard du cart abandonment : Display agressif + Email automation cart-abandoned-1h (déjà câblé). Bidder fort sur Search RLSA. ROAS observé : 4-6x supérieur à acquisition.",
    campaigns: [
      'Display Cart Abandonment',
      'Search RLSA (bid +100%)',
      'Performance Max retargeting',
      'Email automation (déjà actif)',
    ],
  },
  {
    name: 'aud_bofu_cart_viewer_7d',
    stage: 'bofu',
    recencyDays: 7,
    size: 'S',
    purpose: "A consulté son panier sans checkout. Étape post-ajout, pré-intent paiement.",
    rule: `Include : event "view_cart" OR "mini_cart_open"
Exclude : event "purchase" OR "begin_checkout" OR "checkout_intent"
Membership duration : 7 days`,
    strategy:
      "Audience-passerelle BOFU → HOT : ces visiteurs hésitent. Adresser leur friction (livraison gratuite ? code promo soft ?). À ne PAS confondre avec cart_abandoner (qui a juste ajouté).",
    campaigns: ['Display avec offre soft', 'Email "votre panier vous attend"'],
  },
  {
    name: 'aud_bofu_lead_form_starter_14d',
    stage: 'bofu',
    recencyDays: 14,
    size: 'S',
    purpose:
      'A commencé un formulaire de lead (wizard ou chat) sans le soumettre. Friction à débloquer.',
    rule: `Include : event "form_start"
  OR  event "form_field_focus"
  OR  event "chat_lead_form_view"
Exclude : event "lead_capture" OR "generate_lead"
Membership duration : 14 days`,
    strategy:
      "Reach-out qualitatif : ces visiteurs ont identifié leur besoin (assez pour commencer le form) mais ont reculé. Email semi-personnalisé > paid retargeting. Tester un Display 'votre rituel est prêt'.",
    campaigns: [
      'Email automation form-abandon',
      'Display brand reassurance',
      'RLSA Search bid+',
    ],
  },
  {
    name: 'aud_bofu_checkout_starter_7d',
    stage: 'bofu',
    recencyDays: 7,
    size: 'S',
    purpose:
      'A entamé le checkout (1er char dans le form) sans aller au paiement. Intent fort, friction inconnue.',
    rule: `Include : event "checkout_intent" OR "begin_checkout"
Exclude : event "purchase"
Membership duration : 7 days`,
    strategy:
      "Le checkout starter est presque-acheteur. Bid maximum sur Search RLSA, Display ultra-fréquent (5-7/jour), Demand Gen avec créa 'simplifiez votre commande'. Window courte = urgence.",
    campaigns: [
      'Performance Max BOFU',
      'Search RLSA (bid +150%)',
      'Display agressif 24-72h',
    ],
  },

  /* ─── HOT ──────────────────────────────────────────────────────── */
  {
    name: 'aud_hot_shipping_starter_3d',
    stage: 'hot',
    recencyDays: 3,
    size: 'XS',
    purpose: 'A saisi son adresse de livraison sans finaliser le paiement.',
    rule: `Include : event "add_shipping_info" OR "address_completed"
Exclude : event "purchase"
Membership duration : 3 days`,
    strategy:
      "Audience la plus chaude possible avant paiement. Ne JAMAIS la mettre en exclusion. Display micro-fréquence 24h + email cart-abandoned-1h immédiat. ROAS observé : 8-12x.",
    campaigns: [
      'Performance Max ultra-prioritaire',
      'Email cart-abandoned-1h',
      'Display 24h micro-fréquence',
    ],
  },
  {
    name: 'aud_hot_payment_starter_3d',
    stage: 'hot',
    recencyDays: 3,
    size: 'XS',
    purpose:
      'A atteint la page de paiement sans valider. Friction technique ou hésitation finale.',
    rule: `Include : event "add_payment_info"
Exclude : event "purchase"
Membership duration : 3 days`,
    strategy:
      "Ultra-hot : 95% des conversions perdues ici sont dues à friction technique (carte refusée, page lente, doute moyen de paiement). Email transactional automatique + 1 Display 'votre paiement n'a pas abouti'.",
    campaigns: [
      'Email transactional immédiat',
      'Display 24-48h',
      'Search RLSA bid +200%',
    ],
  },

  /* ─── CUSTOMERS ────────────────────────────────────────────────── */
  {
    name: 'aud_cust_buyer_30d',
    stage: 'customer',
    recencyDays: 30,
    size: 'M',
    purpose: 'Acheteurs récents (30 derniers jours). Window cross-sell + upsell.',
    rule: `Include : event "purchase"
Membership duration : 30 days`,
    strategy:
      "Cross-sell window : email automation avec produits complémentaires (cf. tracking_settings). À EXCLURE de toutes les campagnes acquisition (déjà clients, ROI faible). Idéale pour fidélisation paid.",
    campaigns: [
      'Display cross-sell',
      'YouTube fidélisation (storytelling marque)',
      'Email cross-sell automation',
      '⚠️ EXCLUSION sur Demand Gen acquisition',
    ],
  },
  {
    name: 'aud_cust_buyer_180d',
    stage: 'customer',
    recencyDays: 180,
    size: 'L',
    purpose: 'Pool customer 6 mois : seed Lookalike + repeat purchase.',
    rule: `Include : event "purchase"
Membership duration : 180 days`,
    strategy:
      "MEILLEUR seed Lookalike. Uploader en Customer Match (avec email/phone hashés) pour Google Ads Lookalike. Window 180j car effet long-cycle (repurchase rituels = 60-90j).",
    campaigns: [
      'Customer Match Lookalike (★ recommandé)',
      'Email repeat purchase 60j',
      'Display repurchase reminder',
    ],
  },
  {
    name: 'aud_cust_lead_only_180d',
    stage: 'customer',
    recencyDays: 180,
    size: 'M',
    purpose: 'A généré un lead (form / chat) sans achat à 180j. Pool nurturing.',
    rule: `Include : event "lead_capture" OR "generate_lead"
Exclude : event "purchase"
Membership duration : 180 days`,
    strategy:
      "Audience nurturing email-first (cf. automation studio). Retargeting paid uniquement en relance saisonnière (4-6x/an). Bonne audience pour A/B tester messages prix vs message valeur.",
    campaigns: [
      'Email nurturing (déjà câblé)',
      'Display saisonnier (4-6 vagues/an)',
      'RLSA Search bid neutre',
    ],
  },

  /* ─── EXCLUSIONS ───────────────────────────────────────────────── */
  {
    name: 'aud_excl_buyer_30d',
    stage: 'exclusion',
    recencyDays: 30,
    size: 'M',
    purpose: 'Acheteurs 30j à EXCLURE de toutes les campagnes acquisition.',
    rule: `Include : event "purchase"
Membership duration : 30 days`,
    strategy:
      "Exclusion universelle sur TOUTES les campagnes acquisition (Demand Gen, Display TOFU, Search non-brand). Éviter de payer pour servir une ad à un client récent. Ne pas exclure des campagnes fidélisation ou cross-sell.",
    campaigns: [
      'Exclusion sur Demand Gen acquisition',
      'Exclusion sur Display TOFU',
      'Exclusion sur Search non-brand',
    ],
  },
  {
    name: 'aud_excl_recent_visitor_1d',
    stage: 'exclusion',
    recencyDays: 1,
    size: 'L',
    purpose: 'Visiteur < 24h pour éviter sur-impression Display sur même session-day.',
    rule: `Include : event "page_view"
Membership duration : 1 day`,
    strategy:
      "Anti-burnout publicitaire : exclure pendant 24h après une visite réduit la fatigue (perception négative quand on voit la même pub 10×/jour). À utiliser uniquement sur Display retargeting agressif, pas sur RLSA Search.",
    campaigns: ['Exclusion sur Display retargeting agressif'],
  },
];

/* ───────────────────────────────────────────────────────────────────
 * Génère le texte plain à télécharger.
 * ─────────────────────────────────────────────────────────────────── */

const STAGE_LABEL: Record<FunnelStage, string> = {
  tofu: 'TOFU — Top of Funnel (découverte / awareness)',
  mofu: 'MOFU — Middle of Funnel (considération)',
  bofu: 'BOFU — Bottom of Funnel (intent d\'achat)',
  hot: 'HOT — Quasi-acheteur (in-checkout)',
  customer: 'CUSTOMER — Clients existants',
  exclusion: 'EXCLUSION — Audiences négatives',
};

export function generateAudienceStrategyTxt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  FEMIGLOW — STRATÉGIE D\'AUDIENCES GA4 → GOOGLE ADS');
  lines.push(`  Généré le ${today}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Ce document liste : (1) la convention de nommage, (2) les events');
  lines.push('GA4 à activer comme triggers d\'audience, (3) le catalogue complet');
  lines.push('des audiences à créer dans GA4 (Admin → Audiences → New audience),');
  lines.push('avec définition, stratégie marketing et types de campagnes recommandés.');
  lines.push('');

  /* ── 1. Convention nommage ── */
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(' 1. CONVENTION DE NOMMAGE');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('  Format : aud_<stage>_<descriptor>_<recency>d');
  lines.push('');
  lines.push('  Préfixes (stage) :');
  lines.push('    aud_tofu_*        → Top of Funnel');
  lines.push('    aud_mofu_*        → Middle of Funnel');
  lines.push('    aud_bofu_*        → Bottom of Funnel');
  lines.push('    aud_hot_*         → Quasi-acheteur (in-checkout)');
  lines.push('    aud_cust_*        → Clients (post-conversion)');
  lines.push('    aud_excl_*        → Audiences négatives (exclusions)');
  lines.push('');
  lines.push('  Suffixe : _<n>d  (fenêtre de membership en jours)');
  lines.push('');
  lines.push('  Pourquoi cette convention :');
  lines.push('    • Filtrable rapidement dans GA4 (recherche "aud_" → toutes)');
  lines.push('    • Stage explicite → choix campagne immédiat (TOFU vs BOFU)');
  lines.push('    • Recency dans le nom → évite confusion 7d vs 30d même base');
  lines.push('    • Anglais court → compatible Google Ads UI (limite caractères)');
  lines.push('');

  /* ── 2. Events GA4 à activer ── */
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(' 2. EVENTS GA4 À ACTIVER COMME "USE FOR AUDIENCE"');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('  Dans GA4 → Admin → Events → activer "Use for audience" sur chacun :');
  lines.push('  (les events ★ sont aussi à marquer "Mark as conversion")');
  lines.push('');
  for (const e of AUDIENCE_TRIGGER_EVENTS) {
    const mark = e.asConversion === true ? ' ★ CONV' : '';
    lines.push(`    • ${e.name.padEnd(34)}${mark.padEnd(9)} → ${e.description}`);
  }
  lines.push('');
  lines.push('  Note : tous ces events sont déjà émis côté FemiGlow (cf.');
  lines.push('  event-catalog.ts). GA4 les reçoit automatiquement via GTM dès');
  lines.push('  que tu importes le container exporté depuis l\'admin tracking.');
  lines.push('');

  /* ── 3. Audiences par stage ── */
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(' 3. CATALOGUE DES AUDIENCES');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');

  const stages: FunnelStage[] = ['tofu', 'mofu', 'bofu', 'hot', 'customer', 'exclusion'];
  for (const stage of stages) {
    const audiencesInStage = AUDIENCES.filter((a) => a.stage === stage);
    if (audiencesInStage.length === 0) continue;
    lines.push('');
    lines.push(`  ▸▸ ${STAGE_LABEL[stage]}`);
    lines.push('');
    for (const a of audiencesInStage) {
      lines.push(`  ━━━ ${a.name} ━━━`);
      lines.push(`    Taille estimée : ${a.size}    |    Recency : ${a.recencyDays} jours`);
      lines.push('');
      lines.push(`    OBJECTIF`);
      lines.push(`      ${a.purpose}`);
      lines.push('');
      lines.push(`    RÈGLE GA4 (à recopier dans Admin → Audiences → New)`);
      for (const ruleLine of a.rule.split('\n')) {
        lines.push(`      ${ruleLine}`);
      }
      lines.push('');
      lines.push(`    STRATÉGIE MARKETING`);
      // Wrap long strategy text at ~70 chars
      const stratWords = a.strategy.split(' ');
      let curLine = '      ';
      for (const w of stratWords) {
        if ((curLine + w).length > 70) {
          lines.push(curLine);
          curLine = '      ' + w + ' ';
        } else {
          curLine += w + ' ';
        }
      }
      if (curLine.trim()) lines.push(curLine);
      lines.push('');
      lines.push(`    TYPES DE CAMPAGNE RECOMMANDÉS`);
      for (const c of a.campaigns) {
        lines.push(`      • ${c}`);
      }
      lines.push('');
    }
  }

  /* ── 4. Footer / Workflow recommandé ── */
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(' 4. WORKFLOW DE MISE EN PLACE RECOMMANDÉ');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('  Étape 1 — Import GTM (déjà fait si tu as exporté ton plan)');
  lines.push('    Vérifie dans GTM Preview que tous les events §2 firent.');
  lines.push('');
  lines.push('  Étape 2 — Activer "Use for audience" sur les events GA4');
  lines.push('    Admin → Events → boucle sur la liste §2.');
  lines.push('    Pour ceux marqués ★ CONV : activer aussi "Mark as conversion".');
  lines.push('');
  lines.push('  Étape 3 — Créer les audiences (Admin → Audiences → New)');
  lines.push('    Recommandé : créer dans cet ordre');
  lines.push('      a) EXCLUSIONS d\'abord (utilisées par les autres)');
  lines.push('      b) CUSTOMERS (seed Lookalike)');
  lines.push('      c) HOT → BOFU → MOFU → TOFU (du bas vers le haut)');
  lines.push('    GA4 a besoin de 7-14 jours pour peupler les audiences');
  lines.push('    une fois créées — anticipe.');
  lines.push('');
  lines.push('  Étape 4 — Lier GA4 ↔ Google Ads');
  lines.push('    Google Ads → Tools → Linked accounts → Google Analytics');
  lines.push('    Importer les audiences créées dans Google Ads.');
  lines.push('    Délai d\'import : 24-48h pour première synchro.');
  lines.push('');
  lines.push('  Étape 5 — Customer Match (pour Lookalike de qualité)');
  lines.push('    Exporter `aud_cust_buyer_180d` en hash SHA-256 email/phone');
  lines.push('    et uploader dans Google Ads → Audience Manager → Customer');
  lines.push('    Match. Crée un similar audience auto par Google.');
  lines.push('');
  lines.push('  Étape 6 — Mapping campagne ↔ audience');
  lines.push('    Pour chaque campagne, définir :');
  lines.push('      • Audiences "Targeting" (qui voir)');
  lines.push('      • Audiences "Observation" (mesurer sans cibler)');
  lines.push('      • Audiences "Exclusion" (qui éviter)');
  lines.push('    Cf. les colonnes "TYPES DE CAMPAGNE" de chaque audience.');
  lines.push('');
  lines.push('  Étape 7 — Mesurer + itérer (mensuel)');
  lines.push('    Reporting Google Ads → Audiences → comparer ROAS par audience.');
  lines.push('    Couper celles < 2x ROAS, doubler le budget sur > 5x ROAS.');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  FIN DU DOCUMENT');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
