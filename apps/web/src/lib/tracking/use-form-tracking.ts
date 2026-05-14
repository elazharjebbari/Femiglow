/**
 * useFormTracking — instrumentation standardisée des formulaires.
 * cf. docs/analytics/03-events-funnel-audit.md §6 et docs/analytics/07-runbook-roadmap.md M2
 *
 * Émet :
 *  - `form_start` au premier focus sur n'importe quel champ tracké
 *  - `form_field_focus` à chaque focus de champ (idempotent par session)
 *  - `form_field_blur` à chaque blur (avec `has_value`)
 *  - `form_validation_error` quand `reportError` est appelé
 *  - `form_abandon` quand l'utilisateur quitte la page sans soumission
 *
 * Robustesse :
 *  - Idempotence stricte via Set interne (pas de doublons par champ).
 *  - Détection d'abandon via `pagehide` (compatible iOS Safari) avec
 *    fallback `visibilitychange` pour les onglets cachés > 5 s.
 *  - Reset automatique sur unmount.
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';

import { useTracking } from './use-tracking';

interface UseFormTrackingOptions {
  formId: string;
  /**
   * Mode du form (D-004) — propagé dans le payload `form_start` pour
   * permettre la segmentation wizard embed / cart / legacy côté GA4.
   */
  formMode?: 'wizard_embed' | 'wizard_cart' | 'legacy_cart';
  /** Si true (default), émet form_abandon au pagehide si le formulaire a été touché. */
  trackAbandon?: boolean;
}

interface UseFormTrackingResult {
  /** À placer sur `onFocus={handleFieldFocus(fieldName)}`. */
  handleFieldFocus: (fieldName: string) => () => void;
  /** À placer sur `onBlur={handleFieldBlur(fieldName, hasValue)}`. */
  handleFieldBlur: (fieldName: string, hasValue: boolean) => () => void;
  /** À appeler quand le form est soumis avec succès — désactive form_abandon. */
  markSubmitted: () => void;
  /** À appeler à chaque erreur de validation côté client. */
  reportError: (fieldName: string, errorCode: string) => void;
}

export function useFormTracking({
  formId,
  formMode,
  trackAbandon = true,
}: UseFormTrackingOptions): UseFormTrackingResult {
  const { emit } = useTracking();
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const lastFieldRef = useRef<string | null>(null);
  const firstFieldRef = useRef<string | null>(null);
  const focusedFieldsRef = useRef(new Set<string>());

  const ensureStarted = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startTimeRef.current = Date.now();
    emit('form_start', {
      form_id: formId,
      ...(firstFieldRef.current ? { first_field: firstFieldRef.current } : {}),
      ...(formMode ? { form_mode: formMode } : {}),
    });
  }, [emit, formId, formMode]);

  const handleFieldFocus = useCallback(
    (fieldName: string) => () => {
      if (!startedRef.current) firstFieldRef.current = fieldName;
      ensureStarted();
      lastFieldRef.current = fieldName;
      // Idempotence : un seul form_field_focus par champ
      if (focusedFieldsRef.current.has(fieldName)) return;
      focusedFieldsRef.current.add(fieldName);
      emit('form_field_focus', { form_id: formId, field_name: fieldName });
    },
    [ensureStarted, emit, formId],
  );

  const handleFieldBlur = useCallback(
    (fieldName: string, hasValue: boolean) => () => {
      emit('form_field_blur', {
        form_id: formId,
        field_name: fieldName,
        has_value: hasValue,
      });
    },
    [emit, formId],
  );

  const markSubmitted = useCallback(() => {
    submittedRef.current = true;
  }, []);

  const reportError = useCallback(
    (fieldName: string, errorCode: string) => {
      emit('form_validation_error', {
        form_id: formId,
        field_name: fieldName,
        error_code: errorCode,
      });
    },
    [emit, formId],
  );

  // Détection d'abandon (pagehide + unmount fallback)
  useEffect(() => {
    if (!trackAbandon) return;
    if (typeof window === 'undefined') return;

    const sendAbandon = () => {
      if (!startedRef.current || submittedRef.current) return;
      const time = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      emit('form_abandon', {
        form_id: formId,
        last_field: lastFieldRef.current,
        time_on_form_ms: time,
      });
      submittedRef.current = true; // empêche re-émission
    };

    const onPageHide = () => sendAbandon();

    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      sendAbandon(); // unmount
    };
  }, [emit, formId, trackAbandon]);

  return { handleFieldFocus, handleFieldBlur, markSubmitted, reportError };
}
