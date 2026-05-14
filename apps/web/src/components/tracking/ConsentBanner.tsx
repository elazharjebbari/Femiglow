'use client';

import { useEffect, useState } from 'react';
import {
  DENIED_CONSENT,
  GRANTED_CONSENT,
  loadConsent,
  saveConsent,
} from '@/lib/tracking/consent';
import type { TrackingConsentState } from '@/lib/db/types';

const ALL_GRANTED: TrackingConsentState = GRANTED_CONSENT;
const ALL_DENIED: TrackingConsentState = DENIED_CONSENT;

const HAS_CHOSEN_KEY = 'fg_consent_chosen';

export interface ConsentBannerLegalLink {
  slug: string;
  label: string;
}

export interface ConsentBannerProps {
  /**
   * Si false, le bandeau n'est jamais affiché (cas pays sans obligation
   * cookie, ex. MA / US selon les juridictions). Le défaut de consentement
   * est alors géré côté `TrackingProvider` via `defaultGranted`.
   */
  enabled?: boolean;
  /**
   * Quand `enabled` est false, on persiste automatiquement un état
   * (granted ou denied) pour que les events partent immédiatement et
   * que la session ne reste pas en denied par défaut.
   */
  defaultGranted?: boolean;
  /**
   * Liens vers les pages légales (politique cookies / confidentialité) à
   * afficher dans le bandeau. Hydratés depuis `legal_page_placements`
   * (zone `cookie-banner-links`) côté layout serveur.
   */
  legalLinks?: ConsentBannerLegalLink[];
}

export function ConsentBanner({
  enabled = true,
  defaultGranted = false,
  legalLinks = [],
}: ConsentBannerProps = {}): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TrackingConsentState>(DENIED_CONSENT);

  useEffect(() => {
    if (!enabled) {
      // Bandeau désactivé : on persiste un état par défaut une seule
      // fois (granted si autorisé, denied sinon) et on n'affiche rien.
      const chosen = window.localStorage.getItem(HAS_CHOSEN_KEY) === '1';
      if (!chosen) {
        const next = defaultGranted ? GRANTED_CONSENT : DENIED_CONSENT;
        saveConsent(next);
        window.localStorage.setItem(HAS_CHOSEN_KEY, '1');
      }
      setVisible(false);
      return;
    }
    const chosen = window.localStorage.getItem(HAS_CHOSEN_KEY) === '1';
    setState(loadConsent());
    setVisible(!chosen);
  }, [enabled, defaultGranted]);

  function persist(next: TrackingConsentState): void {
    saveConsent(next);
    window.localStorage.setItem(HAS_CHOSEN_KEY, '1');
    setState(next);
    setVisible(false);
    setOpen(false);
  }

  if (!visible) return null;
  return (
    <div
      role="dialog"
      aria-labelledby="consent-title"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white/95 p-5 shadow-lg backdrop-blur"
    >
      <h2 id="consent-title" className="text-base font-medium text-stone-900">
        On respecte ta vie privée
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        On utilise des cookies pour mesurer l&rsquo;audience et améliorer ton
        expérience. Tu peux tout accepter, tout refuser ou personnaliser.
      </p>
      {legalLinks.length > 0 ? (
        <p className="mt-2 text-xs text-stone-500">
          En savoir plus :{' '}
          {legalLinks.map((link, idx) => (
            <span key={link.slug}>
              <a
                href={`/legal/${link.slug}`}
                className="underline underline-offset-2 hover:text-stone-700"
              >
                {link.label}
              </a>
              {idx < legalLinks.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      ) : null}
      {open && (
        <div className="mt-3 grid gap-2 text-sm">
          {(
            [
              ['analytics_storage', 'Mesure d\u2019audience'],
              ['ad_storage', 'Publicité'],
              ['ad_user_data', 'Partage des données pub'],
              ['ad_personalization', 'Personnalisation pub'],
              ['functional_storage', 'Préférences fonctionnelles'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={state[key] === 'granted'}
                onChange={(evt): void =>
                  setState({ ...state, [key]: evt.target.checked ? 'granted' : 'denied' })
                }
              />
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={(): void => persist(ALL_DENIED)}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
        >
          Tout refuser
        </button>
        <button
          type="button"
          onClick={(): void => setOpen((v) => !v)}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
        >
          {open ? 'Fermer' : 'Personnaliser'}
        </button>
        {open && (
          <button
            type="button"
            onClick={(): void => persist(state)}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800"
          >
            Enregistrer mes choix
          </button>
        )}
        <button
          type="button"
          onClick={(): void => persist(ALL_GRANTED)}
          className="ml-auto rounded-full bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800"
        >
          Tout accepter
        </button>
      </div>
    </div>
  );
}
