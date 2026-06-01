/**
 * CHA-210 — Bulle "agent" interactive avec formulaire de capture lead.
 *
 * Insérée dans le flux conversation après une SSE `lead-form-offer`.
 * Trois états visuels :
 *   1. Offered : bouton CTA primaire + "Plus tard"
 *   2. Open    : formulaire (prénom, téléphone, note)
 *   3. Success / Error
 *
 * Spécifications UX :
 *   - inputmode=tel + enterkeyhint=next/send + autocomplete tel
 *   - honeypot champ caché `_phone_alt`
 *   - validation côté client minimale (longueur) + côté serveur strict
 *   - tracking : view, focus, submit, dismiss
 *   - RTL pour `language=ar`
 *   - Pas de case "consent" (ralentit l'expérience). On affiche un bandeau
 *     `privacyNote` discret sous le bouton ; le consentement implicite est
 *     enregistré (consentVersion=CONSENT_VERSION) à la soumission, conformément
 *     au cadre RGPD intérêt légitime + transparence dépôt-trace.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §5
 */
'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type {
  ChatLanguage,
  ChatLeadCountryHint,
  ChatLeadTriggerReason,
} from '@/lib/chat/contracts';
import { useTracking } from '@/lib/tracking/use-tracking';
import { markLeadAsPurchaseCookie } from '@/lib/tracking/lead-purchase-cookie';

import { useChatStore } from './chat-store';
import { getLeadFormCopy, type CopyKey } from './lead-form-copy';
import { loadLeadPrefill, saveLeadPrefill } from './lead-prefill';

const COUNTRY_HINTS: { value: ChatLeadCountryHint; label: string; flag: string; cc: string }[] = [
  { value: 'MA', label: 'Maroc', flag: '🇲🇦', cc: '+212' },
  { value: 'FR', label: 'France', flag: '🇫🇷', cc: '+33' },
  { value: 'BE', label: 'Belgique', flag: '🇧🇪', cc: '+32' },
  { value: 'CH', label: 'Suisse', flag: '🇨🇭', cc: '+41' },
  { value: 'DZ', label: 'Algérie', flag: '🇩🇿', cc: '+213' },
  { value: 'TN', label: 'Tunisie', flag: '🇹🇳', cc: '+216' },
];

const CONSENT_VERSION = '2026-05-06';

interface LeadFormBubbleProps {
  language: ChatLanguage;
  /** Endpoint configurable pour les tests. */
  endpoint?: string;
}

export function LeadFormBubble({
  language,
  endpoint = '/api/chat/lead/contact',
}: LeadFormBubbleProps) {
  const sessionId = useChatStore((s) => s.sessionId);
  const leadOffer = useChatStore((s) => s.leadOffer);
  const openLeadForm = useChatStore((s) => s.openLeadForm);
  const dismissLeadForm = useChatStore((s) => s.dismissLeadForm);
  const setLeadFormSubmitting = useChatStore((s) => s.setLeadFormSubmitting);
  const setLeadFormSuccess = useChatStore((s) => s.setLeadFormSuccess);
  const setLeadFormError = useChatStore((s) => s.setLeadFormError);
  const { emit } = useTracking();

  const isRtl = language === 'ar';
  const copy = useMemo(
    () => getLeadFormCopy(language, (leadOffer.copyKey as CopyKey) ?? 'manual'),
    [language, leadOffer.copyKey],
  );
  const reason: ChatLeadTriggerReason = leadOffer.reason ?? 'manual';

  const formId = useId();
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<ChatLeadCountryHint>('MA');
  const [note, setNote] = useState('');
  const [honeypot, setHoneypot] = useState(''); // doit rester vide
  const [touched, setTouched] = useState({ firstName: false, phone: false });
  const [prefilled, setPrefilled] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const status = leadOffer.status;

  // CHAT-063 — Pré-remplissage depuis localStorage si un précédent lead
  // a été soumis sur ce navigateur dans les 90 derniers jours. On ne
  // charge qu'une seule fois et seulement si les champs sont encore
  // vides (évite d'écraser ce que l'utilisateur a tapé entre temps).
  useEffect(() => {
    if (prefilled) return;
    if (status !== 'open' && status !== 'offered') return;
    const data = loadLeadPrefill();
    if (!data) {
      setPrefilled(true);
      return;
    }
    setFirstName((cur) => (cur ? cur : data.firstName));
    setPhone((cur) => (cur ? cur : data.phone));
    setCountry((cur) => (cur !== 'MA' ? cur : data.country));
    setPrefilled(true);
  }, [status, prefilled]);

  // Tracking offered → view (au moment où la bulle est montée).
  useEffect(() => {
    if (status === 'offered') {
      emit('chat_lead_form_view', {
        session_id: sessionId,
        reason,
      });
    }
  }, [status, emit, sessionId, reason]);

  // Quand le form s'ouvre, autofocus sur le prénom.
  useEffect(() => {
    if (status === 'open') {
      firstNameRef.current?.focus();
    }
  }, [status]);

  if (status === 'idle' || status === 'success') {
    if (status === 'success') {
      return (
        <div
          role="status"
          aria-live="polite"
          dir={isRtl ? 'rtl' : 'ltr'}
          className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm"
        >
          {leadOffer.successMessage || copy.successFallback}
        </div>
      );
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // OFFERED — bouton + dismiss
  // ---------------------------------------------------------------------
  if (status === 'offered') {
    return (
      <article
        dir={isRtl ? 'rtl' : 'ltr'}
        data-testid="chat-lead-offer"
        data-reason={reason}
        className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-stone-800 shadow-sm ring-1 ring-stone-200/70"
      >
        <p className="leading-relaxed">{copy.intro}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              openLeadForm();
              emit('chat_lead_form_focus', {
                session_id: sessionId,
                field: 'cta',
              });
            }}
            className="rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
            data-testid="chat-lead-cta"
          >
            {copy.cta}
          </button>
          <button
            type="button"
            onClick={() => {
              dismissLeadForm('offered');
              emit('chat_lead_form_dismiss', {
                session_id: sessionId,
                reason: 'offered',
              });
            }}
            className="rounded-full border border-stone-300 px-4 py-2 text-xs text-stone-600 transition-colors hover:border-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
            data-testid="chat-lead-dismiss-offer"
          >
            {copy.dismiss}
          </button>
        </div>
      </article>
    );
  }

  // ---------------------------------------------------------------------
  // OPEN / SUBMITTING / ERROR — formulaire complet
  // ---------------------------------------------------------------------
  const isSubmitting = status === 'submitting';
  const showError = status === 'error';

  const validateLocal = (): string | null => {
    if (firstName.trim().length < 2) return 'first-name-too-short';
    if (phone.replace(/\D/g, '').length < 6) return 'phone-too-short';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setTouched({ firstName: true, phone: true });
    if (honeypot) {
      // Bot détecté : on simule un succès silencieux, sans rien envoyer.
      setLeadFormSuccess(copy.successFallback);
      return;
    }
    const localErr = validateLocal();
    if (localErr) {
      setLeadFormError(localErr);
      return;
    }
    if (!sessionId) {
      setLeadFormError('session-missing');
      return;
    }
    setLeadFormSubmitting();
    emit('chat_lead_form_submit', {
      session_id: sessionId,
      reason,
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          triggeringMessageId: leadOffer.triggeringMessageId,
          triggerReason: reason,
          firstName: firstName.trim(),
          phoneRaw: phone.trim(),
          countryHint: country,
          note: note.trim() || undefined,
          consent: true,
          consentVersion: CONSENT_VERSION,
          language,
        }),
      });
      if (!res.ok) {
        const data: { error?: string; code?: string } = await res
          .json()
          .catch(() => ({}));
        setLeadFormError(data.error || 'submit-failed');
        return;
      }
      const data: {
        ok: boolean;
        leadId: string;
        outcomeMessage: string;
        value?: number;
        currency?: string;
      } = await res.json();
      setLeadFormSuccess(data.outcomeMessage || copy.successFallback);
      saveLeadPrefill({
        firstName: firstName.trim(),
        phone: phone.trim(),
        country,
      });
      // T-06 — `generate_lead` valorisé au prix du kit (avec promo), fourni
      // par la réponse serveur. On n'émet `currency` QUE si `value` est
      // présente (currency orpheline = signal invalide GA4/Meta).
      emit('generate_lead', {
        method: 'chat',
        lead_id: data.leadId,
        ...(typeof data.value === 'number' && data.value > 0
          ? { value: data.value, currency: data.currency ?? 'MAD' }
          : {}),
      });
      // Pont lead→Meta Purchase : marque le parcours (cookie) pour que GTM
      // bloque le Purchase pixel du vrai achat → dédup. No-op si flag OFF.
      markLeadAsPurchaseCookie();
    } catch (err) {
      setLeadFormError((err as Error).message || 'network-error');
    }
  };

  const errorLabel = showError && leadOffer.errorMessage
    ? translateError(leadOffer.errorMessage, language)
    : null;

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-label={copy.intro}
      data-testid="chat-lead-form"
      data-reason={reason}
      className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-stone-800 shadow-sm ring-1 ring-stone-200/70"
    >
      <p className="leading-relaxed">{copy.intro}</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${formId}-firstName`} className="text-xs font-medium text-stone-700">
          {copy.firstNameLabel}
        </label>
        <input
          id={`${formId}-firstName`}
          ref={firstNameRef}
          type="text"
          required
          autoComplete="given-name"
          autoCapitalize="words"
          inputMode="text"
          enterKeyHint="next"
          minLength={2}
          maxLength={40}
          placeholder={copy.firstNamePlaceholder}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
          onFocus={() =>
            emit('chat_lead_form_focus', {
              session_id: sessionId,
              field: 'firstName',
            })
          }
          aria-invalid={touched.firstName && firstName.trim().length < 2}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${formId}-phone`} className="text-xs font-medium text-stone-700">
          {copy.phoneLabel}
        </label>
        <div className="flex gap-2">
          <select
            aria-label="Pays"
            value={country}
            onChange={(e) => setCountry(e.target.value as ChatLeadCountryHint)}
            className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          >
            {COUNTRY_HINTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.flag} {c.cc}
              </option>
            ))}
          </select>
          <input
            id={`${formId}-phone`}
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            enterKeyHint="send"
            minLength={6}
            maxLength={20}
            pattern="^[\d\s\+\-\(\)\.]{6,20}$"
            placeholder={copy.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            onFocus={() =>
              emit('chat_lead_form_focus', {
                session_id: sessionId,
                field: 'phone',
              })
            }
            aria-invalid={touched.phone && phone.replace(/\D/g, '').length < 6}
            className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${formId}-note`} className="text-xs font-medium text-stone-700">
          {copy.noteLabel}{' '}
          <span className="font-normal text-stone-500">(facultatif)</span>
        </label>
        <input
          id={`${formId}-note`}
          type="text"
          autoComplete="off"
          maxLength={200}
          placeholder={copy.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
        />
      </div>

      {/* Honeypot — caché en CSS + aria-hidden + tabIndex=-1 */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <label>
          Téléphone alternatif
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            name="_phone_alt"
          />
        </label>
      </div>

      {errorLabel && (
        <p role="alert" className="text-xs text-rose-700">
          {errorLabel}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          data-testid="chat-lead-submit"
        >
          {isSubmitting ? '…' : copy.submit}
        </button>
        <button
          type="button"
          onClick={() => {
            dismissLeadForm('open');
            emit('chat_lead_form_dismiss', {
              session_id: sessionId,
              reason: 'open',
            });
          }}
          className="rounded-full border border-stone-300 px-4 py-2 text-xs text-stone-600 transition-colors hover:border-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          {copy.dismiss}
        </button>
      </div>

      <p className="text-[11px] text-stone-500">{copy.privacyNote}</p>
    </form>
  );
}

function translateError(code: string, language: ChatLanguage): string {
  const FR: Record<string, string> = {
    'first-name-too-short': 'Votre prénom semble incomplet.',
    'phone-too-short': 'Numéro trop court.',
    'invalid-phone': 'Numéro invalide. Vérifiez le format.',
    'consent-required': 'Pour pouvoir vous rappeler, on a besoin de votre accord — re-soumettez le formulaire.',
    'session-missing': 'Session expirée. Recommencez.',
    'lead-already-captured': 'Demande déjà reçue, on vous appelle bientôt.',
    'rate-limited': 'Un instant — trop de tentatives, ré-essayez dans 1 min.',
    'submit-failed': 'Une erreur est survenue. Ré-essayez.',
    'network-error': 'Connexion interrompue. Ré-essayez.',
  };
  const AR: Record<string, string> = {
    'first-name-too-short': 'الاسم قصير جداً.',
    'phone-too-short': 'الرقم قصير جداً.',
    'invalid-phone': 'رقم غير صحيح. تحقق من التنسيق.',
    'consent-required': 'لكي نتصل بك، نحتاج إلى موافقتك — أعيدي إرسال النموذج.',
    'session-missing': 'انتهت الجلسة. حاولي مجدداً.',
    'lead-already-captured': 'تم استلام طلبك، سنتصل بك قريباً.',
    'rate-limited': 'لحظة — محاولات كثيرة، أعيدي المحاولة بعد دقيقة.',
    'submit-failed': 'حدث خطأ. أعيدي المحاولة.',
    'network-error': 'انقطع الاتصال. أعيدي المحاولة.',
  };
  const AR_MA: Record<string, string> = {
    'first-name-too-short': 'L-smiya 9sira bzzaf.',
    'phone-too-short': 'L-ra9m 9sir bzzaf.',
    'invalid-phone': 'L-ra9m machi mezyan. Chouf l-format.',
    'consent-required': 'Bach n9dro nta3yt lik, nta7tajou mowafqtek — 3awd seyyeb formulaire.',
    'session-missing': 'Session sallat. 3awd menb3d.',
    'lead-already-captured': 'Tlbk mwjoud, ghadi nta3yt lik 9rib.',
    'rate-limited': 'Wa9fi chwiya — m7awalat bzzaf, 3awd ba3d 1 min.',
    'submit-failed': 'Wa9e3 mochkil. 3awd menb3d.',
    'network-error': 'Internet t9at3. 3awd menb3d.',
  };
  const table = language === 'ar' ? AR : language === 'ar-MA' ? AR_MA : FR;
  return table[code] ?? code;
}
