/**
 * CHA-211 — Copy multilingue du formulaire de capture lead.
 *
 * Variantes par `copyKey` (raison qui a déclenché l'offre) × langue.
 * - Le ton est doux, jamais autoritaire ; on évite le forcing (Kolenda).
 * - Les CTAs sont courts, max 2 mots quand possible.
 * - Le message de succès donne un horizon clair (« on vous appelle »).
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
  intro:
    'Si vous préférez, on peut vous rappeler — partagez juste votre prénom et numéro, on s’occupe du reste.',
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
    intro:
      'Avec plaisir ! Laissez-nous votre prénom et numéro, et une conseillère humaine vous rappelle dès que possible.',
    cta: 'Être rappelée',
  },
  'out-of-knowledge': {
    ...FR_BASE,
    intro:
      'Cette question mérite une vraie conseillère. Je peux organiser un rappel rapide — laissez-moi votre prénom et numéro.',
    cta: 'Demander un rappel',
  },
  objection: {
    ...FR_BASE,
    intro:
      'On peut en parler de vive voix si vous préférez : laissez-nous votre prénom et numéro, on vous appelle.',
    cta: 'Parler à une conseillère',
  },
  'after-hours': {
    ...FR_BASE,
    intro:
      'Notre équipe est joignable lun–sam 9h–17h. Laissez-nous votre numéro, on vous rappelle dès l’ouverture.',
    cta: 'Être rappelée demain',
  },
  b2b: {
    ...FR_BASE,
    intro:
      'Pour un projet de revente ou pro, mieux vaut un échange direct. Laissez-nous votre prénom + numéro.',
    cta: 'Être contactée (pro)',
    noteLabel: 'Type de projet (institut, pharmacie, e-commerce…)',
    notePlaceholder: 'Ex. salon esthétique à Casablanca',
  },
  'purchase-intent': {
    ...FR_BASE,
    intro:
      'Avec plaisir. Laissez-moi votre prénom et votre numéro : une conseillère valide votre commande, confirme l’adresse, et le kit part dans la journée. Paiement en main propre, à la livraison.',
    cta: 'Commander mon kit',
    submit: 'Valider ma commande',
    successFallback:
      'Merci ! Une conseillère vous appelle dans la journée pour confirmer la livraison. À tout de suite ✨',
    noteLabel: 'Une précision ? (ville, étage, créneau)',
    notePlaceholder: 'Ex. Casablanca, plutôt en fin d’après-midi',
  },
  'inline-contact': {
    ...FR_BASE,
    intro:
      'Pour valider votre commande proprement, confirmez ici votre prénom et votre numéro. Je n’enregistre rien tant que vous n’avez pas validé ce formulaire.',
    cta: 'Confirmer mes coordonnées',
    submit: 'Valider',
    successFallback:
      'Merci ! Vos coordonnées sont bien enregistrées — une conseillère vous rappelle dans la journée.',
  },
  manual: {
    ...FR_BASE,
    intro:
      'Préférez-vous qu’on vous rappelle ? Laissez-nous votre prénom et numéro, on s’occupe du reste.',
    cta: 'Être rappelée',
  },
};

const AR_BASE: LeadFormCopy = {
  intro:
    'إذا تفضلين، يمكننا الاتصال بك — فقط شاركي اسمك ورقمك ونحن نتولى الباقي.',
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
    intro: 'بكل سرور! اتركي لنا اسمك ورقم هاتفك، وستتصل بك مستشارة بشرية في أقرب وقت ممكن.',
  },
  'out-of-knowledge': {
    ...AR_BASE,
    intro:
      'هذا السؤال يستحق مستشارة حقيقية. يمكنني ترتيب مكالمة سريعة — اتركي لي اسمك ورقمك.',
  },
  objection: {
    ...AR_BASE,
    intro: 'يمكننا التحدث مباشرة إذا تفضلين: اتركي لنا اسمك ورقمك ونتصل بك.',
  },
  'after-hours': {
    ...AR_BASE,
    intro: 'فريقنا متاح من الإثنين إلى السبت من 9 صباحاً إلى 5 مساءً. اتركي رقمك، سنعاود الاتصال عند الفتح.',
    cta: 'اتصلوا بي غداً',
  },
  b2b: {
    ...AR_BASE,
    intro: 'لمشروع إعادة بيع أو احترافي، يفضل تبادل مباشر. اتركي اسمك ورقمك.',
    cta: 'اتصلوا بي (احترافي)',
    noteLabel: 'نوع المشروع (معهد، صيدلية، تجارة إلكترونية...)',
  },
  'purchase-intent': {
    ...AR_BASE,
    intro:
      'بكلّ سرور. اتركي اسمكِ ورقمكِ : مستشارة تؤكّد الطلب وتنظّم التوصيل، والطقم ينطلق في يومه. الدفع نقداً، عند الاستلام.',
    cta: 'اطلبي طقمي',
    submit: 'تأكيد الطلب',
    successFallback: 'شكراً لك! ستتصل بك مستشارة اليوم لتأكيد التوصيل. إلى اللقاء ✨',
    noteLabel: 'تفصيل آخر؟ (المدينة، الطابق، الوقت المناسب)',
  },
  'inline-contact': {
    ...AR_BASE,
    intro:
      'لتثبيت الطلب بشكلٍ صحيح، أكدي هنا اسمكِ ورقمكِ. لا يُسجَّل شيء حتى تؤكدي عبر هذا النموذج.',
    cta: 'تأكيد بياناتي',
    submit: 'تأكيد',
    successFallback: 'شكراً لك! بياناتكِ مسجَّلة — مستشارة ستتصل بك اليوم.',
  },
  manual: {
    ...AR_BASE,
    intro: 'هل تفضلين أن نتصل بك؟ اتركي اسمك ورقمك، نتولى الباقي.',
  },
};

const AR_MA_BASE: LeadFormCopy = {
  intro:
    'Ila bghiti, n9edro n3ytou lik — 3tina smiyetk ou ra9mk, ou hna ghadi ndirou ba9i.',
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
    intro:
      'Marhban ! 3tina smiyetk ou ra9mk, ou wa7da men l-mostachirat ghadi t3yt lik f a9rab wa9t.',
  },
  'out-of-knowledge': {
    ...AR_MA_BASE,
    intro:
      'Had souaal khassou wa7da insania. N9eder nrettab lik wa7d 3ayta sari3a — 3tini smiyetk ou ra9mk.',
  },
  objection: {
    ...AR_MA_BASE,
    intro: 'N9edro ntkellmou direct ila bghiti : 3tina smiyetk ou ra9mk, ou hna nta3ytou lik.',
  },
  'after-hours': {
    ...AR_MA_BASE,
    intro:
      'L-équipe dyalna khdma men tnin l sebt 9h–17h. 3ti lina ra9mk, nta3ytou lik fhel l-7el.',
    cta: '3yt liya ghedda',
  },
  b2b: {
    ...AR_MA_BASE,
    intro: 'L-mochroo3 dyal byi3 wlla professionel, a7sen tkellem direct. 3tina smiya + ra9m.',
    cta: '3yt liya (pro)',
    noteLabel: 'Nou3 l-mochroo3 (institut, sayda7iya, e-commerce…)',
  },
  'purchase-intent': {
    ...AR_MA_BASE,
    intro:
      'B koll farah. 3tini smiytek w ra9mek : wahda mn l-mostachirat ghadi ttouafq 3la l-talab w tdebber l-livraison, w l-kit kayemchi f nharo. L-khalss cash, f-blasstou.',
    cta: 'Tlb l-kit dyali',
    submit: 'Wafqi 3la l-talab',
    successFallback:
      'Choukrane ! Wa7da mn l-mostachirat ghadi t3yt lik l-yom bach tt2akkad mn l-livraison. Brraht ✨',
    noteLabel: 'Chi tfssil zayd ? (l-mdina, l-5otba, l-wa9t li ma7lab)',
  },
  'inline-contact': {
    ...AR_MA_BASE,
    intro:
      'Bach n7afdo l-talab b sahel, akkdi hna smiytek w ra9mek. Ma kanssejjel walou hetta tssawybi had l-formulaire.',
    cta: 'Akkdi l-info',
    submit: 'Sawybi',
    successFallback:
      'Choukrane ! L-info dyalek mssejjla — wa7da mn l-mostachirat ghadi t3yt lik l-yom.',
  },
  manual: {
    ...AR_MA_BASE,
    intro: 'Wach kat-fadli n3yto lik ? 3ti lina smiyetk ou ra9mk, ou hna nedirou ba9i.',
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
