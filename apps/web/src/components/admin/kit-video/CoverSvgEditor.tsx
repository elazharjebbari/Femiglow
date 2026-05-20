/**
 * `CoverSvgEditor` — éditeur admin pour la cover SVG dynamique du poster
 * vidéo `/kit`. Trois modes au choix :
 *  - Code SVG    : `<textarea>` avec validation Zod live et aperçu live.
 *  - Fichier SVG : drop zone → POST /api/admin/kit/video/cover/upload.
 *  - URL externe : input + bouton Tester (HEAD HTTPS via API).
 *
 * État piloté par le parent via les props `value` / `onChange`. Le composant
 * ne fait pas de save direct — le parent (`KitVideoEditor`) inclut
 * `posterCoverSvg` dans son patch global.
 *
 * cf. docs/video-gestes-optim-2026-05/ (extension cover SVG, phase γ).
 */
'use client';

import { useCallback, useMemo, useState } from 'react';

import { sanitizeSvgClient } from '@/lib/kit/video/sanitize-svg-client';
import type { KitVideoPosterCoverSvg } from '@/lib/kit/video/types';

type Mode = 'inline' | 'file' | 'url';

export interface CoverSvgEditorProps {
  value: KitVideoPosterCoverSvg | null | undefined;
  onChange: (next: KitVideoPosterCoverSvg | null) => void;
}

interface UrlTestState {
  status: 'idle' | 'testing' | 'ok' | 'ko';
  reason?: string;
  contentType?: string;
  size?: number;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'ok' | 'ko';
  reason?: string;
}

export function CoverSvgEditor({ value, onChange }: CoverSvgEditorProps): JSX.Element {
  const [mode, setMode] = useState<Mode>(value?.source ?? 'inline');
  const [inlineCode, setInlineCode] = useState<string>(
    (value?.source === 'inline' && value.inline) || '',
  );
  const [fileMediaId, setFileMediaId] = useState<string>(
    (value?.source === 'file' && value.fileMediaId) || '',
  );
  const [urlValue, setUrlValue] = useState<string>(
    (value?.source === 'url' && value.url) || '',
  );
  const [ariaLabel, setAriaLabel] = useState<string>(value?.meta?.ariaLabel ?? '');
  const [urlTest, setUrlTest] = useState<UrlTestState>({ status: 'idle' });
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });

  // Aperçu sanitized pour le mode inline.
  const sanitizedPreview = useMemo(() => {
    if (mode !== 'inline' || !inlineCode.trim()) return '';
    return sanitizeSvgClient(inlineCode);
  }, [mode, inlineCode]);

  const inlineSizeBytes = useMemo(
    () => (inlineCode ? new TextEncoder().encode(inlineCode).length : 0),
    [inlineCode],
  );
  const inlineSizeOk = inlineSizeBytes > 0 && inlineSizeBytes <= 50_000;

  // Recompose et notifie le parent au changement de mode/valeur.
  const emit = useCallback(
    (next: KitVideoPosterCoverSvg | null) => {
      onChange(next);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setInlineCode('');
    setFileMediaId('');
    setUrlValue('');
    setAriaLabel('');
    setUrlTest({ status: 'idle' });
    setUploadState({ status: 'idle' });
    emit(null);
  }, [emit]);

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      // À chaque switch, on émet la config du nouveau mode si on a un input,
      // sinon on émet null (clear).
      if (next === 'inline' && inlineCode.trim()) {
        emit({
          source: 'inline',
          inline: inlineCode,
          meta: ariaLabel ? { ariaLabel } : null,
        });
      } else if (next === 'file' && fileMediaId.trim()) {
        emit({
          source: 'file',
          fileMediaId,
          meta: ariaLabel ? { ariaLabel } : null,
        });
      } else if (next === 'url' && urlValue.trim()) {
        emit({
          source: 'url',
          url: urlValue,
          meta: ariaLabel ? { ariaLabel } : null,
        });
      } else {
        emit(null);
      }
    },
    [ariaLabel, emit, fileMediaId, inlineCode, urlValue],
  );

  const handleInlineChange = useCallback(
    (raw: string) => {
      setInlineCode(raw);
      if (mode === 'inline' && raw.trim()) {
        emit({ source: 'inline', inline: raw, meta: ariaLabel ? { ariaLabel } : null });
      } else if (mode === 'inline') {
        emit(null);
      }
    },
    [ariaLabel, emit, mode],
  );

  const handleAriaChange = useCallback(
    (next: string) => {
      setAriaLabel(next);
      const meta = next ? { ariaLabel: next } : null;
      if (mode === 'inline' && inlineCode.trim())
        emit({ source: 'inline', inline: inlineCode, meta });
      else if (mode === 'file' && fileMediaId.trim())
        emit({ source: 'file', fileMediaId, meta });
      else if (mode === 'url' && urlValue.trim()) emit({ source: 'url', url: urlValue, meta });
    },
    [emit, fileMediaId, inlineCode, mode, urlValue],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadState({ status: 'uploading' });
      try {
        const content = await file.text();
        const res = await fetch('/api/admin/kit/video/cover/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        const body = (await res.json()) as
          | { fileMediaId: string; size: number; warnings?: string[] }
          | { error: { message: string } };
        if (!res.ok || !('fileMediaId' in body)) {
          setUploadState({
            status: 'ko',
            reason: 'error' in body ? body.error.message : 'Erreur serveur',
          });
          return;
        }
        setFileMediaId(body.fileMediaId);
        setUploadState({ status: 'ok' });
        emit({
          source: 'file',
          fileMediaId: body.fileMediaId,
          meta: ariaLabel ? { ariaLabel } : null,
        });
      } catch (err) {
        setUploadState({
          status: 'ko',
          reason: err instanceof Error ? err.message : 'Erreur réseau',
        });
      }
    },
    [ariaLabel, emit],
  );

  const handleUrlBlur = useCallback(() => {
    if (mode === 'url' && urlValue.trim()) {
      emit({
        source: 'url',
        url: urlValue,
        meta: ariaLabel ? { ariaLabel } : null,
      });
    } else if (mode === 'url') {
      emit(null);
    }
  }, [ariaLabel, emit, mode, urlValue]);

  const handleTestUrl = useCallback(async () => {
    setUrlTest({ status: 'testing' });
    try {
      const res = await fetch('/api/admin/kit/video/cover/test-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: urlValue }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        contentType?: string;
        size?: number;
        reason?: string;
      };
      if (!res.ok || !body.ok) {
        setUrlTest({
          status: 'ko',
          reason: body.reason ?? `HTTP ${res.status}`,
        });
        return;
      }
      setUrlTest({
        status: 'ok',
        contentType: body.contentType,
        size: body.size,
      });
    } catch (err) {
      setUrlTest({
        status: 'ko',
        reason: err instanceof Error ? err.message : 'Erreur réseau',
      });
    }
  }, [urlValue]);

  return (
    <section className="space-y-4" data-testid="cover-svg-editor">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg">Cover personnalisée (SVG)</h2>
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            data-testid="cover-svg-clear"
            className="text-xs text-rose-700 underline-offset-2 hover:underline"
          >
            Effacer la cover
          </button>
        ) : null}
      </header>

      <nav role="tablist" aria-label="Mode de cover" className="flex gap-1 border-b border-encre/10">
        {(['inline', 'file', 'url'] as const).map((m) => {
          const label = m === 'inline' ? 'Code SVG' : m === 'file' ? 'Fichier SVG' : 'URL externe';
          const isActive = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => switchMode(m)}
              data-testid={`cover-svg-tab-${m}`}
              className={[
                'rounded-t-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'border-b-2 border-encre bg-creme-warm/30 font-medium'
                  : 'text-encre/60 hover:text-encre',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {mode === 'inline' ? (
            <label className="block text-sm">
              SVG markup (sera sanitized côté serveur)
              <textarea
                value={inlineCode}
                onChange={(e) => handleInlineChange(e.target.value)}
                rows={10}
                spellCheck={false}
                placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">…</svg>'
                data-testid="cover-svg-inline-input"
                className="mt-1 block w-full rounded-md border border-encre/20 px-3 py-2 font-mono text-xs"
              />
              <span
                className={`mt-1 block text-xs ${inlineSizeOk ? 'text-emerald-700' : 'text-rose-700'}`}
                data-testid="cover-svg-inline-size"
              >
                {inlineSizeBytes > 0
                  ? `${inlineSizeBytes} octets ${inlineSizeOk ? '✓' : '✗ (max 50 000)'}`
                  : 'Vide'}
              </span>
            </label>
          ) : null}

          {mode === 'file' ? (
            <div className="space-y-2">
              <label
                className="block rounded-md border-2 border-dashed border-encre/20 p-6 text-center text-sm"
                data-testid="cover-svg-file-dropzone"
              >
                <input
                  type="file"
                  accept="image/svg+xml,.svg"
                  data-testid="cover-svg-file-input"
                  className="block w-full text-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                  }}
                />
                <span className="mt-2 block text-xs text-encre/60">
                  Glisser-déposer un fichier .svg (max 200 kB).
                </span>
              </label>
              {uploadState.status === 'uploading' ? (
                <p className="text-xs text-encre/70">Upload en cours…</p>
              ) : null}
              {uploadState.status === 'ok' && fileMediaId ? (
                <p className="text-xs text-emerald-700" data-testid="cover-svg-file-ok">
                  ✓ Uploadé : <code>{fileMediaId}</code>
                </p>
              ) : null}
              {uploadState.status === 'ko' ? (
                <p className="text-xs text-rose-700" data-testid="cover-svg-file-error">
                  ✗ {uploadState.reason}
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === 'url' ? (
            <div className="space-y-2">
              <label className="block text-sm">
                URL HTTPS d'un SVG
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="https://cdn.example.com/cover.svg"
                  data-testid="cover-svg-url-input"
                  className="mt-1 block w-full rounded-md border border-encre/20 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={handleTestUrl}
                disabled={!urlValue.trim() || urlTest.status === 'testing'}
                data-testid="cover-svg-url-test"
                className="rounded border border-encre/20 px-3 py-1 text-xs disabled:opacity-40"
              >
                {urlTest.status === 'testing' ? 'Test en cours…' : 'Tester l\'URL'}
              </button>
              {urlTest.status === 'ok' ? (
                <p className="text-xs text-emerald-700" data-testid="cover-svg-url-ok">
                  ✓ {urlTest.contentType} ·{' '}
                  {urlTest.size !== undefined ? `${urlTest.size} octets` : 'taille inconnue'}
                </p>
              ) : null}
              {urlTest.status === 'ko' ? (
                <p className="text-xs text-rose-700" data-testid="cover-svg-url-error">
                  ✗ {urlTest.reason}
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="block text-sm">
            Aria-label (description accessible de la cover)
            <input
              type="text"
              value={ariaLabel}
              onChange={(e) => handleAriaChange(e.target.value)}
              maxLength={200}
              placeholder="Rituel ongles, 90 secondes — geste de polissage"
              data-testid="cover-svg-aria-input"
              className="mt-1 block w-full rounded-md border border-encre/20 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <aside
          className="rounded-md border border-encre/10 bg-creme-warm/40 p-3"
          aria-label="Aperçu cover"
        >
          <p className="mb-2 text-xs text-encre/60">Aperçu</p>
          <div
            className="aspect-[9/16] w-full overflow-hidden rounded bg-encre/5"
            data-testid="cover-svg-preview"
          >
            {mode === 'inline' && sanitizedPreview ? (
              <div
                className="h-full w-full"
                dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
              />
            ) : mode === 'file' && fileMediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/kit-video-cover/${encodeURIComponent(fileMediaId)}`}
                alt="Aperçu fichier"
                className="h-full w-full object-cover"
              />
            ) : mode === 'url' && urlValue && urlTest.status === 'ok' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlValue}
                alt="Aperçu URL"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-encre/40">
                Aucun aperçu
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
