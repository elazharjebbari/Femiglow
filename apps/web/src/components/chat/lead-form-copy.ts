/**
 * CHA-211 — Copy multilingue du formulaire de capture lead.
 *
 * Variantes par `copyKey` (raison qui a déclenché l'offre) × langue.
 * - Le ton est doux, jamais autoritaire ; on évite le forcing (Kolenda).
 * - Les CTAs sont courts, max 2 mots quand possible.
 * - Le message de succès donne un horizon clair (« on vous appelle »).
 *
 * CHA-228 — Règle anti-redondance avec le message LLM qui précède :
 *   `intro` n'est PAS un second pitch. C'est une ligne **opérationnelle
 *   complémentaire** qui ajoute ce que le LLM ne dit pas (timing, étape
 *   suivante, garantie). Maximum ~12 mots, une seule idée nouvelle.
 *   Le LLM porte la chaleur et le contexte ; le widget porte
 *   l'opérationnel. Voir `instruction-defaults.ts` §"Capter le contact".
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §5.2
 */

import type { ChatLanguage } from '@/lib/chat/contracts';

export type CopyKey =
  | 'explicit-request'
  | 'out-of-knowledge'
  | 'objection'
  | 'after-hours'
  | 'b2b'
  // CHA-225 — Achat explicite ("je veux commander") + coordonnées en clair.
  | 'purchase-intent'
  | 'inline-contact'
  | 'manual';

export interface LeadFormCopy {
  /** Phrase d'amorce (au-dessus du formulaire). */
  intro: string;
  /** Texte du bouton principal. */
  cta: string;
  /** Texte du lien « Non merci ». */
  dismiss: string;
  /** Label du champ prénom. */
  firstNameLabel: string;
  firstNamePlaceholder: string;
  /** Label du champ téléphone. */
  phoneLabel: string;
  phonePlaceholder: string;
  /** Label du champ note libre (optionnel). */
  noteLabel: string;
  notePlaceholder: string;
  /** Texte du checkbox consentement. */
  consent: string;
  /** Bouton soumission. */
  submit: string;
  /** Message succès post-submit. */
  successFallback: string;
  /** Mention sécurité sous le formulaire. */
  privacyNote: string;
}

const FR_BASE: LeadFormCopy = {
  // Fallback générique : rappel sous 2 h, pas de pitch (le LLM porte le pitch).
  intro: 'Réponse en moins de 2 h, en horaires d’ouverture.',
  cta: 'Être rappelée',
  dismiss: 'Plus tard',
  firstNameLabel: 'Prénom',
  firstNamePlaceholder: 'Ex. Sara',
  phoneLabel: 'Téléphone (WhatsApp)',
  phonePlaceholder: '06 12 34 56 78',
  noteLabel: 'Une question précise ?',
  notePlaceholder: 'Ex. besoin de conseil sur ma routine',
  consent:
    'J’accepte d’être recontactée par FemiGlow. Mes données restent privées.',
  submit: 'Recevoir un appel',
  successFallback:
    'Merci ! Une conseillère vous appellera très vite. À tout de suite ✨',
  privacyNote:
    'Données utilisées uniquement pour ce rappel. Aucun spam, aucune revente.',
};

const FR: Record<CopyKey, LeadFormCopy> = {
  'explicit-request': {
    ...FR_BASE,
    intro: 'Réponse de la conseillère sous 2 h, en horaires d’ouverture.',
    cta: 'Être rappelée',
  },
  'out-of-knowledge': {
    ...FR_BASE,
    intro: 'Une conseillère humaine prend le relais.',
    cta: 'Demander un rappel',
  },
  objection: {
    ...FR_BASE,
    intro: 'Court échange, sans engagement.',
    cta: 'Parler à une conseillère',
  },
  'after-hours': {
    ...FR_BASE,
    intro: 'On rappelle dès l’ouverture (lun–sam, 9 h).',
    cta: 'Être rappelée demain',
  },
  b2b: {
    ...FR_BASE,
    intro: 'On revient vers vous sous 48 h pour cadrer le projet.',
    cta: 'Être contactée (pro)',
    noteLabel: 'Type de projet (institut, pharmacie, e-commerce…)',
    notePlaceholder: 'Ex. salon esthétique à Casablanca',
  },
  'purchase-intent': {
    ...FR_BASE,
    // Complément du LLM : pas de re-pitch, juste l'horizon temporel + paiement.
    intro: 'Rappel dans la journée · paiement en main propre à la réception.',
    cta: 'Commander mon kit',
    submit: 'Valider ma commande',
    successFallback:
      'Merci ! Une conseillère vous appelle dans la journée pour confirmer la livraison. À tout de suite ✨',
    noteLabel: 'Une précision ? (ville, étage, créneau)',
    notePlaceholder: 'Ex. Casablanca, plutôt en fin d’après-midi',
  },
  'inline-contact': {
    ...FR_BASE,
    intro: 'Rien n’est enregistré tant que ce formulaire n’est pas validé.',
    cta: 'Confirmer mes coordonnées',
    submit: 'Valider',
    successFallback:
      'Merci ! Vos coordonnées sont bien enregistrées — une conseillère vous rappelle dans la journée.',
  },
  manual: {
    ...FR_BASE,
    intro: 'On vous rappelle dès qu’on est dispo.',
    cta: 'Être rappelée',
  },
};

const AR_BASE: LeadFormCopy = {
  intro: 'ردّ خلال ساعتين، في أوقات العمل.',
  cta: 'اتصلوا بي',
  dismiss: 'لاحقاً',
  firstNameLabel: 'الاسم',
  firstNamePlaceholder: 'مثال: سارة',
  phoneLabel: 'رقم الهاتف (واتساب)',
  phonePlaceholder: '06 12 34 56 78',
  noteLabel: 'سؤال محدد؟',
  notePlaceholder: 'مثال: استشارة حول روتيني',
  consent: 'أوافق على أن تتصل بي FemiGlow. بياناتي تبقى خاصة.',
  submit: 'تلقي مكالمة',
  successFallback: 'شكراً لك! ستتصل بك مستشارتنا قريباً جداً. إلى اللقاء ✨',
  privacyNote: 'البيانات تستخدم فقط لهذه المكالمة. لا رسائل مزعجة، لا بيع.',
};

const AR: Record<CopyKey, LeadFormCopy> = {
  'explicit-request': {
    ...AR_BASE,
    intro: 'ردّ المستشارة خلال ساعتين، في أوقات العمل.',
  },
  'out-of-knowledge': {
    ...AR_BASE,
    intro: 'مستشارة بشريّة تتولّى الباقي.',
  },
  objection: {
    ...AR_BASE,
    intro: 'مكالمة قصيرة، دون التزام.',
  },
  'after-hours': {
    ...AR_BASE,
    intro: 'نعاود الاتصال عند الفتح (الإثنين–السبت، 9 ص).',
    cta: 'اتصلوا بي غداً',
  },
  b2b: {
    ...AR_BASE,
    intro: 'نعود إليكِ خلال 48 ساعة لتأطير المشروع.',
    cta: 'اتصلوا بي (احترافي)',
    noteLabel: 'نوع المشروع (معهد، صيدلية، تجارة إلكترونية...)',
  },
  'purchase-intent': {
    ...AR_BASE,
    intro: 'مكالمة في اليوم نفسه · الدفع نقداً عند الاستلام.',
    cta: 'اطلبي طقمي',
    submit: 'تأكيد الطلب',
    successFallback: 'شكراً لك! ستتصل بك مستشارة اليوم لتأكيد التوصيل. إلى اللقاء ✨',
    noteLabel: 'تفصيل آخر؟ (المدينة، الطابق، الوقت المناسب)',
  },
  'inline-contact': {
    ...AR_BASE,
    intro: 'لا يُسجَّل شيء حتى يُؤكَّد هذا النموذج.',
    cta: 'تأكيد بياناتي',
    submit: 'تأكيد',
    successFallback: 'شكراً لك! بياناتكِ مسجَّلة — مستشارة ستتصل بك اليوم.',
  },
  manual: {
    ...AR_BASE,
    intro: 'نتّصل بكِ بمجرّد توفّرنا.',
  },
};

const AR_MA_BASE: LeadFormCopy = {
  intro: 'Jawab f a9al mn sa3atayn, f l-wa9t d l-khdma.',
  cta: '3yt liya',
  dismiss: 'Mn b3d',
  firstNameLabel: 'Smiya',
  firstNamePlaceholder: 'Mtl. Sara',
  phoneLabel: 'Ra9m (WhatsApp)',
  phonePlaceholder: '06 12 34 56 78',
  noteLabel: 'Sou2al m3ayyan ?',
  notePlaceholder: 'Mtl. bghit nasi7a 3la routine dyali',
  consent:
    'Kanwafe9 bach FemiGlow t3ayet liya. L-mo3tayat dyali kayb9aw privé.',
  submit: 'Nta3yt liya',
  successFallback:
    'Choukrane ! Wa7da men l-mostachirat ghadi t3yt lik daba. Bzzaaaf bsl7a ✨',
  privacyNote:
    'L-mo3tayat kanst3mlouhom ghir l-had l-mokalama. Mafih spam, mafih bi3 dial l-data.',
};

const AR_MA: Record<CopyKey, LeadFormCopy> = {
  'explicit-request': {
    ...AR_MA_BASE,
    intro: 'Mostachira ghadi t3yt lik f a9al mn sa3atayn, f l-wa9t d l-khdma.',
  },
  'out-of-knowledge': {
    ...AR_MA_BASE,
    intro: 'Wa7da insania ghadi tkhdem 3la l-ba9i.',
  },
  objection: {
    ...AR_MA_BASE,
    intro: 'Mokalama 9sira, bla iltizam.',
  },
  'after-hours': {
    ...AR_MA_BASE,
    intro: 'Kanrj3o nta3ytou f l-7l (tnin–sebt, 9h).',
    cta: '3yt liya ghedda',
  },
  b2b: {
    ...AR_MA_BASE,
    intro: 'Kanrj3o lik f 48 sa3a bach n2attrou l-mochroo3.',
    cta: '3yt liya (pro)',
    noteLabel: 'Nou3 l-mochroo3 (institut, sayda7iya, e-commerce…)',
  },
  'purchase-intent': {
    ...AR_MA_BASE,
    intro: '3ayta f nhar l-yawm · l-khalss cash f-blasstou.',
    cta: 'Tlb l-kit dyali',
    submit: 'Wafqi 3la l-talab',
    successFallback:
      'Choukrane ! Wa7da mn l-mostachirat ghadi t3yt lik l-yom bach tt2akkad mn l-livraison. Brraht ✨',
    noteLabel: 'Chi tfssil zayd ? (l-mdina, l-5otba, l-wa9t li ma7lab)',
  },
  'inline-contact': {
    ...AR_MA_BASE,
    intro: 'Walou ma kayetssjjel hetta yetsift had l-formulaire.',
    cta: 'Akkdi l-info',
    submit: 'Sawybi',
    successFallback:
      'Choukrane ! L-info dyalek mssejjla — wa7da mn l-mostachirat ghadi t3yt lik l-yom.',
  },
  manual: {
    ...AR_MA_BASE,
    intro: 'Kanta3yto lik mlli kanwasslo.',
  },
};

const TABLE: Record<ChatLanguage, Record<CopyKey, LeadFormCopy>> = {
  fr: FR,
  ar: AR,
  'ar-MA': AR_MA,
};

export function getLeadFormCopy(language: ChatLanguage, copyKey: CopyKey): LeadFormCopy {
  const lang = TABLE[language] ?? FR;
  return lang[copyKey] ?? lang.manual;
}
