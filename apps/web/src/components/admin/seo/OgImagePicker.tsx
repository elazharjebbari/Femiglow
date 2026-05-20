/**
 * `OgImagePicker` — composant unifié de sélection de l'image OG d'un override
 * ou des settings SEO globaux.
 *
 * Trois modes mutuellement exclusifs, alignés sur le schéma DB :
 *  - `none`     : ni `ogImageMediaId` ni `ogImageTemplate` → la cascade
 *                 cherche dans settings, puis defaults SVG statique.
 *  - `media`    : `ogImageMediaId` set, `ogImageTemplate` null → URL de
 *                 média statique téléversée (`/uploads/...`).
 *  - `template` : `ogImageTemplate` set, `ogImageMediaId` null → URL
 *                 dynamique générée par `/api/og/{template}` (phase 4 SEO).
 *
 * Pourquoi un composant unifié ? L'éditeur SEO actuel exposait deux Field
 * indépendants (`ogImageMediaId` + `ogImageTemplate`). Rien n'empêchait
 * l'éditeur de remplir les deux ; la résolution silencieuse privilégiait
 * `mediaId`. Ici on rend le choix explicite côté UI et on garantit qu'un
 * seul des deux est posé en DB.
 *
 * Bonus UX : aperçu live du média sélectionné via fetch
 * `/api/admin/media/[id]` (avec `AbortController` pour annuler les requêtes
 * obsolètes lors d'une saisie rapide).
 *
 * Phase 4 (génération OG dynamique) : si `dynamicEnabled=false`, le mode
 * `template` reste sélectionnable mais l'aperçu indique un fallback SVG
 * statique en attendant l'endpoint dynamique.
 *
 * cf. docs/seo-action-plan-2026-05/06-admin-ui-ux-design.md §2
 */
'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { OgImageTemplate } from '@/lib/seo/types';

export type OgImagePickerMode = 'none' | 'media' | 'template';

export interface OgImagePickerValue {
  mediaId: string | null;
  template: OgImageTemplate | null;
}

export interface OgImagePickerProps {
  value: OgImagePickerValue;
  onChange: (next: OgImagePickerValue) => void;
  /**
   * Si `false` (cas par défaut tant que la phase 4 n'est pas activée), le
   * mode `template` reste disponible (la DB peut contenir un template) mais
   * l'aperçu signale que la génération dynamique n'est pas encore en ligne.
   */
  dynamicEnabled?: boolean;
  /** Préfixe d'ID pour générer des `name` de radio uniques (utile si le
   * picker est instancié plusieurs fois dans la même page).  */
  inputIdPrefix?: string;
  disabled?: boolean;
}

interface MediaPreview {
  id: string;
  url: string;
  alt: string | null;
  width: number;
  height: number;
}

/** Liste des templates supportés. Source de vérité : `lib/seo/types.ts`. */
const TEMPLATES: OgImageTemplate[] = ['marketing', 'article', 'product', 'default'];

/**
 * Dérive le mode du `value` actuel.
 *
 * Convention :
 *  - `mediaId === null` ET `template === null` → `none`.
 *  - `mediaId` est une string (même `''`) → `media`. Le string vide est
 *    un état transitoire « l'utilisateur a sélectionné media mais n'a
 *    pas encore saisi l'identifiant ».
 *  - sinon `template` non null → `template`.
 *
 * La règle DB stricte (`mediaId` non-null ⇔ string non-vide) est appliquée
 * en sortie via `buildPayload` côté consommateur (`SeoOverrideEditor` :
 * `state.ogImageMediaId || null`).
 */
function deriveMode(value: OgImagePickerValue): OgImagePickerMode {
  if (value.mediaId !== null && value.mediaId !== undefined) return 'media';
  if (value.template) return 'template';
  return 'none';
}

export function OgImagePicker({
  value,
  onChange,
  dynamicEnabled = false,
  inputIdPrefix,
  disabled = false,
}: OgImagePickerProps): JSX.Element {
  const baseId = useId();
  const groupName = `og-image-picker-${inputIdPrefix ?? baseId}`;
  const mode = deriveMode(value);

  // Mémorisation des champs « non actifs » pour ne pas perdre la saisie de
  // l'utilisateur quand il bascule entre modes (e.g. tape un mediaId, passe
  // en template pour voir, revient en media → mediaId restauré).
  const lastMediaIdRef = useRef<string>(value.mediaId ?? '');
  const lastTemplateRef = useRef<OgImageTemplate>(value.template ?? 'marketing');
  useEffect(() => {
    if (value.mediaId) lastMediaIdRef.current = value.mediaId;
    if (value.template) lastTemplateRef.current = value.template;
  }, [value.mediaId, value.template]);

  function selectMode(next: OgImagePickerMode) {
    if (next === mode) return;
    if (next === 'none') {
      onChange({ mediaId: null, template: null });
    } else if (next === 'media') {
      onChange({ mediaId: lastMediaIdRef.current || '', template: null });
    } else {
      onChange({ mediaId: null, template: lastTemplateRef.current });
    }
  }

  return (
    <fieldset
      className="space-y-3 rounded-md border border-stone-200 bg-white p-3"
      data-testid="og-image-picker"
      disabled={disabled}
    >
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-stone-500">
        OG image
      </legend>

      <ModeOption
        groupName={groupName}
        modeValue="none"
        currentMode={mode}
        onSelect={selectMode}
        label="Aucun"
        helper="Utilise le défaut global (settings → fallback statique)."
        testid="og-image-picker-mode-none"
      />

      <ModeOption
        groupName={groupName}
        modeValue="media"
        currentMode={mode}
        onSelect={selectMode}
        label="Image téléversée"
        helper="Sélectionne un média existant dans la médiathèque."
        testid="og-image-picker-mode-media"
      >
        <MediaModeBody
          mediaId={value.mediaId ?? ''}
          onChangeMediaId={(next) => onChange({ mediaId: next, template: null })}
        />
      </ModeOption>

      <ModeOption
        groupName={groupName}
        modeValue="template"
        currentMode={mode}
        onSelect={selectMode}
        label="Template dynamique"
        helper={
          dynamicEnabled
            ? 'Génère une image 1200×630 via /api/og/{template}.'
            : "Génération dynamique pas encore activée — l'override stocke le template, l'aperçu retombe sur le SVG statique."
        }
        testid="og-image-picker-mode-template"
      >
        <TemplateModeBody
          template={value.template ?? lastTemplateRef.current}
          onChangeTemplate={(t) => onChange({ mediaId: null, template: t })}
          dynamicEnabled={dynamicEnabled}
        />
      </ModeOption>
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sous-composants internes                                                  */
/* -------------------------------------------------------------------------- */

interface ModeOptionProps {
  groupName: string;
  modeValue: OgImagePickerMode;
  currentMode: OgImagePickerMode;
  label: string;
  helper: string;
  onSelect: (mode: OgImagePickerMode) => void;
  children?: React.ReactNode;
  testid: string;
}

function ModeOption({
  groupName,
  modeValue,
  currentMode,
  label,
  helper,
  onSelect,
  children,
  testid,
}: ModeOptionProps) {
  const selected = currentMode === modeValue;
  const headerId = useId();
  return (
    <div
      className={`rounded-md border p-2.5 transition-colors ${
        selected ? 'border-[#C8A876] bg-[#FBF8F1]' : 'border-stone-200 bg-white'
      }`}
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="radio"
          name={groupName}
          value={modeValue}
          checked={selected}
          onChange={() => onSelect(modeValue)}
          className="mt-1 h-4 w-4 accent-[#C8A876]"
          data-testid={testid}
        />
        <span className="flex flex-col">
          <span id={headerId} className="text-sm font-medium text-stone-800">
            {label}
          </span>
          <span className="text-xs text-stone-500">{helper}</span>
        </span>
      </label>
      {selected && children ? <div className="mt-3 pl-6">{children}</div> : null}
    </div>
  );
}

/* --------------------------- Mode "media" body ---------------------------- */

interface MediaModeBodyProps {
  mediaId: string;
  onChangeMediaId: (next: string) => void;
}

function MediaModeBody({ mediaId, onChangeMediaId }: MediaModeBodyProps) {
  const preview = useMediaPreview(mediaId);
  const trimmed = mediaId.trim();

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-stone-600">
        Identifiant média
        <input
          type="text"
          value={mediaId}
          onChange={(e) => onChangeMediaId(e.target.value)}
          placeholder="med_..."
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-sm font-mono focus:border-[#C8A876] focus:outline-none focus:ring-1 focus:ring-[#C8A876]/40"
          data-testid="og-image-picker-media-id"
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <a
        href="/admin/media"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs text-stone-600 underline hover:text-stone-900"
        data-testid="og-image-picker-open-library"
      >
        Ouvrir la médiathèque dans un nouvel onglet ↗
      </a>

      {trimmed === '' ? (
        <div className="rounded-md border border-dashed border-stone-200 p-3 text-xs text-stone-500">
          Saisissez un identifiant pour prévisualiser l'image.
        </div>
      ) : preview.loading ? (
        <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
          Chargement de l'aperçu…
        </div>
      ) : preview.error ? (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
          data-testid="og-image-picker-error"
        >
          {preview.error}
        </div>
      ) : preview.data ? (
        <figure
          className="overflow-hidden rounded-md border border-stone-200 bg-stone-50"
          data-testid="og-image-picker-preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.data.url}
            alt={preview.data.alt ?? 'Aperçu image OG sélectionnée'}
            width={preview.data.width}
            height={preview.data.height}
            className="block h-auto w-full max-w-[320px]"
          />
          <figcaption className="px-2 py-1 text-[11px] text-stone-500">
            {preview.data.width}×{preview.data.height}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

/* ------------------------- Mode "template" body --------------------------- */

interface TemplateModeBodyProps {
  template: OgImageTemplate;
  onChangeTemplate: (template: OgImageTemplate) => void;
  dynamicEnabled: boolean;
}

function TemplateModeBody({ template, onChangeTemplate, dynamicEnabled }: TemplateModeBodyProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-stone-600">
        Template
        <select
          value={template}
          onChange={(e) => onChangeTemplate(e.target.value as OgImageTemplate)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-sm focus:border-[#C8A876] focus:outline-none focus:ring-1 focus:ring-[#C8A876]/40"
          data-testid="og-image-picker-template-select"
        >
          {TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div
        className="rounded-md border border-dashed border-stone-300 p-3 text-xs text-stone-600"
        data-testid="og-image-picker-template-preview"
      >
        {dynamicEnabled
          ? `Aperçu généré au runtime via /api/og/${template}.`
          : `Template enregistré (« ${template} »). Aperçu dynamique disponible après activation de NEXT_PUBLIC_SEO_OG_DYNAMIC.`}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hook préview                                                              */
/* -------------------------------------------------------------------------- */

interface PreviewState {
  loading: boolean;
  error: string | null;
  data: MediaPreview | null;
}

/**
 * Fetch debounced du média sélectionné. Annule la requête précédente
 * dès qu'une nouvelle saisie arrive (AbortController) pour éviter les
 * race conditions où une vieille réponse écrase la nouvelle.
 */
function useMediaPreview(mediaId: string): PreviewState {
  const [state, setState] = useState<PreviewState>({
    loading: false,
    error: null,
    data: null,
  });

  useEffect(() => {
    const trimmed = mediaId.trim();
    if (!trimmed) {
      setState({ loading: false, error: null, data: null });
      return undefined;
    }
    const controller = new AbortController();
    const debounceId = window.setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      fetch(`/api/admin/media/${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
        .then(async (res) => {
          if (!res.ok) {
            const detail = res.status === 404 ? 'Média introuvable.' : `Erreur ${res.status}`;
            setState({ loading: false, error: detail, data: null });
            return;
          }
          const data = await res.json();
          const url: string | undefined = data?.url ?? data?.publicUrl ?? data?.cdnUrl;
          if (!url) {
            setState({ loading: false, error: 'Réponse média sans URL.', data: null });
            return;
          }
          setState({
            loading: false,
            error: null,
            data: {
              id: data.id ?? trimmed,
              url,
              alt: data.alt ?? null,
              width: Number(data.width) || 1200,
              height: Number(data.height) || 630,
            },
          });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState({
            loading: false,
            error: err instanceof Error ? err.message : 'Erreur réseau.',
            data: null,
          });
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(debounceId);
    };
  }, [mediaId]);

  return state;
}
