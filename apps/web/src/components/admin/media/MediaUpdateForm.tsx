'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Media, MediaObjectFit, MediaObjectPosition } from '@/lib/db/types';

interface MediaUpdateFormProps {
  media: Media;
}

/**
 * Tokens couleur exposés en dropdown pour `backgroundFill`. Doit refléter
 * `tokens.css` côté serveur. L'utilisateur peut aussi taper un hex direct
 * via "Personnalisé".
 */
const FILL_TOKENS: Array<{ value: string; label: string }> = [
  { value: '', label: '— Auto (palette) —' },
  { value: 'creme', label: 'Crème' },
  { value: 'creme-warm', label: 'Crème warm' },
  { value: 'champagne-soft', label: 'Champagne soft' },
  { value: 'sauge-soft', label: 'Sauge soft' },
  { value: 'petale-soft', label: 'Pétale soft' },
  { value: 'ciel-soft', label: 'Ciel soft' },
  { value: 'encre', label: 'Encre' },
  { value: 'transparent', label: 'Transparent' },
  { value: '__custom__', label: 'Personnalisé (hex)…' },
];

const OBJECT_FIT_VALUES: MediaObjectFit[] = [
  'cover',
  'contain',
  'fill',
  'none',
  'scale-down',
];

const OBJECT_POSITION_VALUES: MediaObjectPosition[] = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
];

export function MediaUpdateForm({ media }: MediaUpdateFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [alt, setAlt] = useState(media.alt);
  const [caption, setCaption] = useState(media.caption ?? '');
  const [credit, setCredit] = useState(media.credit ?? '');
  const [qualityProfile, setQualityProfile] = useState(media.qualityProfile);
  const [loadingStrategy, setLoadingStrategy] = useState(media.loadingStrategy);
  const [isHero, setIsHero] = useState(media.isHero);

  // ─── Cascade fit (par-image) ───
  // L'utilisateur édite ici les champs de `media.overrides.*`. Le binding
  // (point d'usage) garde sa propre UI dans le panneau composant.
  const initialOverrides = media.overrides ?? {};
  const [objectFit, setObjectFit] = useState<MediaObjectFit | ''>(
    initialOverrides.objectFit ?? '',
  );
  const [objectPosition, setObjectPosition] = useState<MediaObjectPosition | ''>(
    initialOverrides.objectPosition ?? '',
  );
  const [focalX, setFocalX] = useState<string>(
    typeof initialOverrides.focalX === 'number' ? String(initialOverrides.focalX) : '',
  );
  const [focalY, setFocalY] = useState<string>(
    typeof initialOverrides.focalY === 'number' ? String(initialOverrides.focalY) : '',
  );

  // backgroundFill : on a deux mode — token sélectionnable, ou hex perso.
  const initialFill = initialOverrides.backgroundFill ?? '';
  const isInitialFillToken = FILL_TOKENS.some(
    (t) => t.value !== '' && t.value !== '__custom__' && t.value === initialFill,
  );
  const [fillToken, setFillToken] = useState<string>(
    initialFill === ''
      ? ''
      : isInitialFillToken
        ? initialFill
        : '__custom__',
  );
  const [fillCustom, setFillCustom] = useState<string>(
    !isInitialFillToken ? initialFill : '',
  );
  const [cropToSlotAspect, setCropToSlotAspect] = useState<boolean>(
    !!initialOverrides.cropToSlotAspect,
  );

  // ─── Override avancé (JSON brut, conservé pour le cas où un dev veut
  // toucher art-direction, qualities, etc.) ───
  // On en exclut les champs déjà couverts par la UI dédiée pour éviter le
  // double-écrasement.
  const initialAdvanced = useMemo(() => {
    const {
      objectFit: _f,
      objectPosition: _p,
      focalX: _fx,
      focalY: _fy,
      backgroundFill: _bg,
      cropToSlotAspect: _crop,
      ...rest
    } = initialOverrides;
    return rest;
  }, [initialOverrides]);
  const [overridesText, setOverridesText] = useState(
    JSON.stringify(initialAdvanced, null, 2),
  );
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOverrideError(null);
    let advancedOverrides: Record<string, unknown>;
    try {
      advancedOverrides = JSON.parse(overridesText) as Record<string, unknown>;
    } catch {
      setOverrideError('JSON invalide');
      setBusy(false);
      return;
    }

    const fxNum = focalX === '' ? null : Number(focalX);
    const fyNum = focalY === '' ? null : Number(focalY);
    if (fxNum !== null && (Number.isNaN(fxNum) || fxNum < 0 || fxNum > 100)) {
      setOverrideError('focalX doit être entre 0 et 100');
      setBusy(false);
      return;
    }
    if (fyNum !== null && (Number.isNaN(fyNum) || fyNum < 0 || fyNum > 100)) {
      setOverrideError('focalY doit être entre 0 et 100');
      setBusy(false);
      return;
    }

    const fillValue =
      fillToken === ''
        ? undefined
        : fillToken === '__custom__'
          ? fillCustom.trim() || undefined
          : fillToken;

    // Compose les overrides finaux : champs dédiés en haut + avancés.
    const overrides: Record<string, unknown> = {
      ...advancedOverrides,
      ...(objectFit ? { objectFit } : {}),
      ...(objectPosition ? { objectPosition } : {}),
      ...(fxNum !== null ? { focalX: fxNum } : {}),
      ...(fyNum !== null ? { focalY: fyNum } : {}),
      ...(fillValue ? { backgroundFill: fillValue } : {}),
      ...(cropToSlotAspect ? { cropToSlotAspect: true } : {}),
    };

    try {
      const res = await fetch(`/api/admin/media/${media.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          alt,
          caption: caption || null,
          credit: credit || null,
          qualityProfile,
          loadingStrategy,
          isHero,
          overrides,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? 'Erreur de mise à jour');
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Texte alternatif (alt)</span>
        <input
          required
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          maxLength={500}
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Caption</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          maxLength={1000}
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Crédit</span>
        <input
          value={credit}
          onChange={(e) => setCredit(e.target.value)}
          maxLength={200}
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs font-medium text-stone-600">Profil qualité</span>
          <select
            value={qualityProfile}
            onChange={(e) => setQualityProfile(e.target.value as Media['qualityProfile'])}
            className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="hero">Hero</option>
            <option value="inline">Inline</option>
            <option value="thumb">Thumb</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-stone-600">Stratégie</span>
          <select
            value={loadingStrategy}
            onChange={(e) => setLoadingStrategy(e.target.value as Media['loadingStrategy'])}
            className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="eager">Eager</option>
            <option value="viewport">Viewport</option>
            <option value="idle">Idle</option>
            <option value="interaction">Interaction</option>
          </select>
        </label>
        <label className="flex items-end gap-2">
          <input
            id="is-hero"
            type="checkbox"
            checked={isHero}
            onChange={(e) => setIsHero(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-stone-700">Hero (LCP)</span>
        </label>
      </div>

      {/* ─── Adaptation au cadre (cascade fit) ─────────────────────── */}
      <fieldset className="rounded-md border border-stone-200 bg-stone-50 p-3">
        <legend className="px-1 text-sm font-medium text-stone-700">
          Adaptation au cadre
        </legend>
        <p className="mb-3 text-xs text-stone-500">
          Override par-image (cascade : binding ▸ media.overrides ▸ slot par défaut). Laisser
          vide pour utiliser le défaut du slot.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">object-fit</span>
            <select
              value={objectFit}
              onChange={(e) => setObjectFit(e.target.value as MediaObjectFit | '')}
              className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— défaut du slot —</option>
              {OBJECT_FIT_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">object-position</span>
            <select
              value={objectPosition}
              onChange={(e) =>
                setObjectPosition(e.target.value as MediaObjectPosition | '')
              }
              className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— défaut du slot —</option>
              {OBJECT_POSITION_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">
              Focal X (%) — laisse vide pour ignorer
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={focalX}
              onChange={(e) => setFocalX(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Focal Y (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={focalY}
              onChange={(e) => setFocalY(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">
              Couleur de fond (utile en `contain`)
            </span>
            <select
              value={fillToken}
              onChange={(e) => setFillToken(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              {FILL_TOKENS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {fillToken === '__custom__' ? (
            <label className="block">
              <span className="block text-xs font-medium text-stone-600">
                Hex / rgba personnalisé
              </span>
              <input
                value={fillCustom}
                onChange={(e) => setFillCustom(e.target.value)}
                placeholder="#FBF8F1"
                maxLength={80}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
              />
            </label>
          ) : (
            <span className="hidden sm:block" aria-hidden="true" />
          )}
          <label className="col-span-full flex items-center gap-2">
            <input
              id="crop-to-slot"
              type="checkbox"
              checked={cropToSlotAspect}
              onChange={(e) => setCropToSlotAspect(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-stone-700">
              Cropper physiquement au ratio du slot lors de la prochaine régénération
              <span className="block text-xs text-stone-500">
                Élimine le letterbox sur les sources mal proportionnées (triptyques en cartes 4/5).
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          Override avancé (JSON)
        </summary>
        <p className="mt-1 text-xs text-stone-500">
          Champs non couverts par la UI dédiée (artDirection, qualities, customLoader…). Les
          champs gérés au-dessus sont fusionnés automatiquement.
        </p>
        <textarea
          value={overridesText}
          onChange={(e) => setOverridesText(e.target.value)}
          rows={8}
          className="mt-2 block w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
        />
        {overrideError && (
          <p role="alert" className="mt-1 text-xs text-rose-700">
            {overrideError}
          </p>
        )}
      </details>
      <div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:bg-stone-400"
        >
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
