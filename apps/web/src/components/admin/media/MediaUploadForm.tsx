'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UploadResult {
  ok: boolean;
  filename: string;
  message?: string;
  mediaId?: string;
}

export function MediaUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [defaultProfile, setDefaultProfile] = useState<'hero' | 'inline' | 'thumb'>('inline');

  const onPick = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list));
    setResults([]);
  };

  const submit = async () => {
    if (files.length === 0) return;
    setBusy(true);
    const next: UploadResult[] = [];
    for (const file of files) {
      const slug = file.name
        .toLowerCase()
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      const fd = new FormData();
      fd.append('file', file);
      fd.append(
        'metadata',
        JSON.stringify({
          kind: file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'image',
          source: 'upload',
          slug,
          alt: slug.replace(/-/g, ' '),
          qualityProfile: defaultProfile,
        }),
      );
      try {
        const res = await fetch('/api/admin/media', { method: 'POST', body: fd });
        const json = (await res.json()) as { id?: string; error?: string };
        next.push({
          ok: res.ok,
          filename: file.name,
          message: json.error,
          mediaId: json.id,
        });
      } catch (err) {
        next.push({
          ok: false,
          filename: file.name,
          message: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }
      setResults([...next]);
    }
    setBusy(false);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh();
  };

  return (
    <section aria-labelledby="upload-title" className="rounded-md border border-stone-200 bg-white p-6">
      <h2 id="upload-title" className="text-lg font-semibold text-stone-900">
        Drop zone
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Glissez plusieurs fichiers ou cliquez pour parcourir.
      </p>
      <label
        htmlFor="media-files"
        className="mt-4 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center text-sm text-stone-600 hover:bg-stone-100"
      >
        <span>
          {files.length > 0
            ? `${files.length} fichier${files.length === 1 ? '' : 's'} sélectionné${files.length === 1 ? '' : 's'}`
            : 'Cliquez pour choisir des fichiers'}
        </span>
      </label>
      <input
        ref={fileInputRef}
        id="media-files"
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="sr-only"
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium text-stone-600">Profil par défaut</span>
          <select
            value={defaultProfile}
            onChange={(e) => setDefaultProfile(e.target.value as 'hero' | 'inline' | 'thumb')}
            className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="hero">Hero</option>
            <option value="inline">Inline</option>
            <option value="thumb">Thumb</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || files.length === 0}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {busy ? 'Importation…' : 'Importer'}
        </button>
        <p className="text-xs text-stone-500">
          Le pipeline générera AVIF/WebP/JPEG en arrière-plan.
        </p>
      </div>

      {results.length > 0 && (
        <ul role="list" className="mt-4 space-y-1 text-sm">
          {results.map((r) => (
            <li
              key={r.filename}
              className={r.ok ? 'text-emerald-700' : 'text-rose-700'}
            >
              {r.ok ? '✓' : '✗'} {r.filename}
              {r.message ? ` — ${r.message}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
