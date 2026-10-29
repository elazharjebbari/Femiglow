/**
 * Offre promo exposée par le chat — lue EN DIRECT depuis le coupon, jamais
 * écrite en dur dans les textes. Doc : docs/chat-assistant/23-promo-glow99-livraison.md.
 *
 * Surfaces :
 *  - consigne système : `buildPromoPromptBlock` (bloc « Offre en cours ») ;
 *  - FAQ / questions rapides : jetons `{{promo_code}}`, `{{promo_price}}`,
 *    `{{list_price}}`, `{{promo_discount}}`, `{{promo_end}}` rendus par
 *    `renderPromoTokens` ; un texte à jetons est écarté quand aucune offre
 *    n'est active (code expiré, désactivé, plafond atteint) ;
 *  - lead chat : valeur + code transmis au CRM.
 */
import type { ChatLanguage } from './contracts';

/** Code promu par le chat. Doit exister en base (`coupons.mode = 'code'`). */
export const CHAT_PROMO_CODE = 'GLOW99';

export interface ChatPromo {
  code: string;
  /** Prix avant code (prix catalogue déjà résolu, ex. 199). Unité majeure. */
  listPriceMad: number;
  /** Prix avec le code (ex. 99). */
  promoPriceMad: number;
  discountMad: number;
  currency: string;
  endsAt: Date | null;
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; value: ChatPromo | null } | null = null;

/** Offre active, ou `null`. Fail-soft : toute erreur → `null` (pas de promo inventée). */
export async function getChatPromo(now: Date = new Date()): Promise<ChatPromo | null> {
  if (cache && now.getTime() - cache.at < CACHE_TTL_MS) return cache.value;
  let value: ChatPromo | null = null;
  try {
    const [{ validatePromoCode }, { getKitLeadValue }] = await Promise.all([
      import('@/lib/coupons/promo-code'),
      import('@/lib/products/public'),
    ]);
    const [promo, kit] = await Promise.all([
      validatePromoCode(CHAT_PROMO_CODE, now),
      getKitLeadValue(),
    ]);
    if (promo.valid && kit.value > 0) {
      value = buildChatPromo({
        code: CHAT_PROMO_CODE,
        listPriceMad: kit.value,
        discountCents: promo.valueCents,
        currency: kit.currency,
        endsAt: promo.coupon.endsAt ?? null,
      });
    }
  } catch {
    value = null;
  }
  cache = { at: now.getTime(), value };
  return value;
}

/** Test-only. */
export function __resetChatPromoCache(): void {
  cache = null;
}

export function buildChatPromo(input: {
  code: string;
  listPriceMad: number;
  discountCents: number;
  currency: string;
  endsAt: Date | null;
}): ChatPromo | null {
  const discountMad = Math.min(input.listPriceMad, Math.round(input.discountCents) / 100);
  const promoPriceMad = Math.round((input.listPriceMad - discountMad) * 100) / 100;
  if (discountMad <= 0 || promoPriceMad <= 0) return null;
  return {
    code: input.code.toUpperCase(),
    listPriceMad: input.listPriceMad,
    promoPriceMad,
    discountMad,
    currency: input.currency,
    endsAt: input.endsAt,
  };
}

/** Date de fin au fuseau du Maroc : « 30 novembre » / « 30 نونبر ». */
export function formatPromoEnd(endsAt: Date | null, lang: ChatLanguage | string): string | null {
  if (!endsAt) return null;
  const locale = lang === 'ar' ? 'ar-MA' : 'fr-FR';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Casablanca',
    numberingSystem: 'latn',
  }).format(endsAt);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

const TOKEN_RE = /\{\{\s*(promo_code|promo_price|list_price|promo_discount|promo_end)\s*\}\}/g;

export function hasPromoTokens(text: string): boolean {
  return new RegExp(TOKEN_RE.source).test(text);
}

/**
 * Rend les jetons promo. `ok=false` quand le texte contient des jetons mais
 * qu'aucune offre n'est active (ou que la date de fin manque) : l'appelant
 * doit alors écarter ce texte plutôt que d'afficher un prix faux.
 */
export function renderPromoTokens(
  text: string,
  promo: ChatPromo | null,
  lang: ChatLanguage | string,
): { text: string; ok: boolean; usedTokens: boolean } {
  if (!hasPromoTokens(text)) return { text, ok: true, usedTokens: false };
  if (!promo) return { text, ok: false, usedTokens: true };
  let ok = true;
  const out = text.replace(TOKEN_RE, (_m, token: string) => {
    switch (token) {
      case 'promo_code':
        return promo.code;
      case 'promo_price':
        return fmt(promo.promoPriceMad);
      case 'list_price':
        return fmt(promo.listPriceMad);
      case 'promo_discount':
        return fmt(promo.discountMad);
      case 'promo_end': {
        const end = formatPromoEnd(promo.endsAt, lang);
        if (!end) ok = false;
        return end ?? '';
      }
      default:
        return '';
    }
  });
  return { text: out, ok, usedTokens: true };
}

/** Bloc ajouté à la consigne système (après le corps, avant le contexte RAG). */
export function buildPromoPromptBlock(promo: ChatPromo | null, lang: ChatLanguage | string): string {
  if (lang === 'ar') {
    if (!promo) {
      return '\n\n# العرض الحالي\nلا يوجد أيّ رمز ترويجي فعّال حاليًا. لا تقترحي أيّ رمز ولا تخترعيه؛ الثمن هو ثمن الطقم.';
    }
    const end = formatPromoEnd(promo.endsAt, 'ar');
    return [
      '\n\n# العرض الحالي (معطى مباشر — يُعتمد على أيّ ثمن آخر)',
      `- الرمز الترويجي: ${promo.code}. به يصبح طقم FemiGlow بـ ${fmt(promo.promoPriceMad)} درهم بدل ${fmt(promo.listPriceMad)} درهم (تخفيض ${fmt(promo.discountMad)} درهم)${end ? `، إلى غاية ${end}` : ''}.`,
      `- كلّما تحدّثت الزبونة عن الثمن أو العرض أو التخفيض أو الطلب: اذكري الثمن بعد التخفيض (${fmt(promo.promoPriceMad)} درهم) والرمز ${promo.code} في جملة بسيطة. لا تقدّمي ${fmt(promo.listPriceMad)} درهم وحده كثمن للدفع.`,
      `- يُكتب الرمز في استمارة الطلب (أو يكون مطبّقًا إن جاءت من رابطنا). وإن تركت اسمها ورقمها هنا، تحجز لها المستشارة الطقم بـ ${fmt(promo.promoPriceMad)} درهم.`,
      `- هذا الرمز الوحيد الصالح. أيّ رمز آخر أو تخفيض إضافي: قولي إنّه غير موجود وذكّري بـ ${promo.code}. لا تَعِدي بأيّ تخفيض آخر.`,
      '- رسوم التوصيل تُضاف إلى الثمن وتُدفع عند الاستلام.',
    ].join('\n');
  }
  if (lang === 'ar-MA') {
    if (!promo) {
      return "\n\n# L-3ard dyal daba\nMa kayn hta code promo daba. Ma t9tar7i ta code w ma tkhtar3i ta wahed ; t-taman howa taman l-pack.";
    }
    const end = formatPromoEnd(promo.endsAt, 'fr');
    return [
      "\n\n# L-3ard dyal daba (ma3louma mbacharat — hiya li kat-tsdda9 3la ay taman akhor)",
      `- Code promo : ${promo.code}. B had l-code, l-Pack FemiGlow kayweli b ${fmt(promo.promoPriceMad)} dh f blast ${fmt(promo.listPriceMad)} dh (takhfid ${fmt(promo.discountMad)} dh)${end ? `, htal ${end}` : ''}.`,
      `- Mlli tsewel 3la t-taman, l-promo, t-takhfid wla t-talab : 3tiha t-taman b l-code (${fmt(promo.promoPriceMad)} dh) w l-code ${promo.code}, f jomla wa7da sahla. Ma t9dmich ${fmt(promo.listPriceMad)} dh bo7dha ka taman.`,
      `- L-code kaytketb f l-formulaire dyal t-talab (wla deja m-applique ila jat mn l-lien dyalna). Ila khallat smitha w r-ra9m dyalha hna, l-mostachara kat-hjz liha l-pack b ${fmt(promo.promoPriceMad)} dh.`,
      `- Hada howa l-code l-wa7id. Ay code akhor wla takhfid zayd : 9oul ma kaynch w fakkerha b ${promo.code}. Ma tw3dich b ta takhfid akhor.`,
      "- L-livraison katzad 3la t-taman w kat-tkhelles 3and l-istilam.",
    ].join('\n');
  }
  if (!promo) {
    return "\n\n# Offre en cours\nAucun code promo n'est actif en ce moment. N'en propose et n'en invente aucun ; le prix est celui du Pack.";
  }
  const end = formatPromoEnd(promo.endsAt, 'fr');
  return [
    '\n\n# Offre en cours (donnée en direct — fait foi sur tout autre prix)',
    `- Code promo : ${promo.code}. Avec ce code, le Pack FemiGlow passe de ${fmt(promo.listPriceMad)} dh à ${fmt(promo.promoPriceMad)} dh (${fmt(promo.discountMad)} dh de remise)${end ? `, jusqu'au ${end} inclus` : ''}.`,
    `- Dès que la cliente parle de prix, de promo, de réduction ou de commande : donne le prix avec le code (${fmt(promo.promoPriceMad)} dh) ET le code ${promo.code}, en une phrase simple. Ne présente jamais ${fmt(promo.listPriceMad)} dh seul comme le prix à payer.`,
    `- Le code se saisit dans le formulaire de commande (il est déjà appliqué si elle arrive par notre lien). Si elle laisse son prénom et son numéro ici, la conseillère lui réserve le Pack à ${fmt(promo.promoPriceMad)} dh.`,
    `- C'est le seul code valable. Un autre code (ex. « GLOW50 ») ou une remise en plus : réponds qu'il n'existe pas et rappelle ${promo.code}. Ne promets jamais d'autre remise.`,
    '- Les frais de livraison s’ajoutent au prix et se règlent à la réception.',
  ].join('\n');
}
