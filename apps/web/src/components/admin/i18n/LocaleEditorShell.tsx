/**
 * LocaleEditorShell — wrapper client multi-locale autour d'EditorWithPreview (T3.8).
 *
 * Responsabilité unique : tenir l'état `activeLocale` et passer les bonnes
 * `initialFields` à l'éditeur sous-jacent. Au switch de locale, on remonte
 * complètement `EditorWithPreview` via `key={activeLocale}` :
 *
 *  - chaque locale a son propre `useFieldForm` (dirty tracking isolé) ;
 *  - aucun risque de re-injecter des valeurs FR dans la query PATCH AR ;
 *  - le PreviewFrame se recharge en passant `?locale=` au RSC parent
 *    (à brancher dans une Phase 5+ — actuellement preview reste sur FR).
 *
 * Le `LocaleTabs` est rendu au-dessus et un récap "complétion" est calculé
 * par locale au load (au moins un binding `draft`/`published`).
 *
 * Voix : Le shell appartient au chrome admin → FR pur. Le contenu édité
 * (initialFields) reflète la locale active.
 *
 * @see apps/web/src/components/admin/components/EditorWithPreview.tsx
 * @see apps/web/src/components/admin/i18n/LocaleTabs.tsx
 * @see docs/i18n-strategy-2026-05/PHASE-3-PROGRESS.md (T3.8)
 */
'use client';

import { useMemo, useState } from 'react';
import { LOCALES, type Locale, getLocaleConfig } from '@/i18n.config';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import { EditorWithPreview } from '@/components/admin/components/EditorWithPreview';
import type { FieldDirtyState } from '@/components/admin/components/fields/types';
import { LocaleTabs } from './LocaleTabs';

interface LocaleEditorShellProps {
  componentKey: string;
  fieldDefs: ComponentFieldDefinition[];
  /**
   * Snapshot pré-chargé par locale. Le RSC parent appelle `loadInitialFields`
   * trois fois (une par locale activée) et passe le mapping.
   * Si une locale n'est pas dans le mapping, on tombe sur un objet vide
   * (les éditeurs verront `null` puis `defaultValue`).
   */
  initialFieldsByLocale: Partial<Record<Locale, Record<string, FieldDirtyState>>>;
}

/**
 * Indique si au moins un champ a une valeur non-nulle pour la locale donnée.
 * Sert au badge "✓ traduit" dans LocaleTabs.
 */
function hasAnyTranslation(
  fields: Record<string, FieldDirtyState> | undefined,
): boolean {
  if (!fields) return false;
  return Object.values(fields).some(
    (f) => f.initial !== null && f.initial !== undefined && f.initial !== '',
  );
}

export function LocaleEditorShell({
  componentKey,
  fieldDefs,
  initialFieldsByLocale,
}: LocaleEditorShellProps): JSX.Element {
  // Default = 'fr' (cf. ADR-004). L'admin n'a pas de cookie locale persistant —
  // l'état reste local React (instructions T3.8 §contrainte 5).
  const [activeLocale, setActiveLocale] = useState<Locale>('fr');

  // Calcul de complétion par locale (au chargement initial uniquement).
  // Une locale est "complète" dès qu'au moins un binding existe (draft ou
  // published). Indicateur visuel sobre, pas de %.
  const completion = useMemo(() => {
    const acc: Partial<Record<Locale, boolean>> = {};
    for (const loc of LOCALES) {
      acc[loc] = hasAnyTranslation(initialFieldsByLocale[loc]);
    }
    return acc;
  }, [initialFieldsByLocale]);

  // Données pour la locale active. Si manquant → objet vide (défaut éditeur).
  const activeFields = initialFieldsByLocale[activeLocale] ?? {};
  const activeCfg = getLocaleConfig(activeLocale);
  const panelId = `editor-pane-${componentKey}`;

  return (
    <div className="locale-editor-shell">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Langue d'édition
          </span>
          <LocaleTabs
            activeLocale={activeLocale}
            onChange={setActiveLocale}
            completion={completion}
            panelId={panelId}
          />
        </div>
        <p className="text-[11px] leading-snug text-stone-500">
          Édite le contenu pour <strong>{activeCfg.displayName}</strong>. Les onglets
          basculent le formulaire vers la locale ciblée — chaque langue a son
          propre brouillon et son propre cycle de publication.
        </p>
      </div>

      {/* Tabpanel : on remonte EditorWithPreview à chaque switch (key=locale)
        * pour réinitialiser proprement le state useFieldForm avec les valeurs
        * de la locale visée. Le coût est négligeable côté DOM (< 30 champs
        * en pratique sur le hero le plus chargé). */}
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`locale-tab-${activeLocale}`}
        dir={activeCfg.direction}
        data-active-locale={activeLocale}
      >
        <EditorWithPreview
          key={activeLocale}
          componentKey={componentKey}
          fieldDefs={fieldDefs}
          initialFields={activeFields}
          locale={activeLocale}
        />
      </div>
    </div>
  );
}
