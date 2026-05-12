/**
 * CHA-231 — Dictionnaire AR (darija standardisé) du wizard checkout.
 *
 * Le ton reste sobre, posé, dans la voix FemiGlow adaptée à l'arabe MENA.
 * On évite les calques mot-à-mot du FR — on traduit en intention.
 *
 * Note : ce dictionnaire est l'infrastructure pour CHA-232 (activation UI AR
 * complète avec RTL + fonts). Tant que `formContext.language === 'fr'`, ces
 * chaînes ne sont jamais affichées.
 */

import type { WizardDictionary } from '../dictionary';

export const dictionaryAr: WizardDictionary = {
  common: {
    back: 'رجوع',
    continue: 'متابعة',
    cancel: 'إلغاء',
    retry: 'إعادة المحاولة',
    processing: 'لحظة من فضلك…',
    submit: 'إرسال',
    optional: 'اختياري',
  },
  lead: {
    title: 'اطلبي طقس الجمال',
    subtitle: 'اتركي لنا اسمك ورقم هاتفك من أجل التوصيل.',
    firstNameLabel: 'الاسم',
    firstNamePlaceholder: 'اسمك',
    phoneLabel: 'رقم الهاتف',
    phonePlaceholder: '+212 6 12 34 56 78',
    consentLabel: 'أوافق على أن يتم الاتصال بي لإتمام طلبي.',
    consentLink: 'سياسة الخصوصية',
    ctaSubmit: 'متابعة',
  },
  address: {
    title: 'عنوان التوصيل',
    subtitle: 'إلى أين نرسل لك الطقس؟',
    cityLabel: 'المدينة',
    cityPlaceholder: 'الدار البيضاء، الرباط، مراكش…',
    cityHintBilingual:
      'يمكنك الكتابة بالعربية أو بالفرنسية (Casablanca).',
    cityHintMatched: (matched) => `تم التعرف على: ${matched}.`,
    addressLine1Label: 'العنوان',
    addressLine1Placeholder: 'رقم الشارع واسمه',
    notesLabel: 'ملاحظة لعامل التوصيل (اختياري)',
    notesPlaceholder: 'رمز الإنتركوم، الوقت المفضل، تعليمات…',
    shippingTitle: 'طريقة التوصيل',
    shippingFreeBody: 'توصيل مجاني خلال 24-48 ساعة في جميع أنحاء المغرب.',
    shippingDynamicFreeBody: (eta) =>
      `توصيل مجاني خلال ${eta} — الدفع عند الاستلام.`,
    shippingDynamicPaidBody: (price, eta) =>
      `التوصيل بـ ${price} درهم خلال ${eta} — الدفع عند الاستلام.`,
    ctaSubmit: 'تأكيد الطلب',
    processingOrder: 'جاري تسجيل طلبك…',
  },
  thankYou: {
    title: 'تم استلام طلبك، سنتصل بك.',
    subtitle:
      'سنتصل بك خلال 24 ساعة لتأكيد التوصيل. الدفع يتم عند الاستلام بدون أي رسوم إضافية.',
    orderRefLabel: 'رقم الطلب',
    emailConfirmationTitle: 'تلقي تأكيد الطلب عبر البريد الإلكتروني (اختياري)',
    emailConfirmationSubtitle:
      'أدخلي بريدك الإلكتروني لتلقي تأكيد كتابي لطلبك ورقم تتبع الشحنة.',
    emailLabel: 'بريدك الإلكتروني',
    emailPlaceholder: 'vous@exemple.ma',
    consentLabel:
      'أوافق على تلقي تأكيد الطلب والإشعارات المتعلقة به.',
    ctaSubmit: 'إرسال التأكيد',
    success: (email) => `تم إرسال التأكيد إلى ${email}.`,
  },
  errors: {
    invalidInput: 'حقل غير مقبول. تحقق من معلوماتك.',
    stockInsufficient:
      'المخزون غير كافٍ لهذا الطلب. حاول مرة أخرى أو قلل الكمية.',
    priceMismatch:
      'تغيرت الأسعار. حدّث الصفحة لمراجعة الملخص.',
    rateLimited: 'محاولات كثيرة. أعد المحاولة بعد لحظة.',
    networkOffline:
      'لا يوجد اتصال بالإنترنت. تحقق من شبكتك ثم أعد المحاولة.',
    addressGeneric: 'تعذر تسجيل العنوان. أعد المحاولة.',
    orderGeneric: 'تعذر إتمام الطلب.',
    emailGeneric: 'تعذر تسجيل البريد الإلكتروني. أعد المحاولة.',
  },
};
