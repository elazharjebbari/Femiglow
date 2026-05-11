'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Format = 'csv' | 'csv-comma' | 'tsv' | 'json' | 'jsonl';
type Step = 1 | 2 | 3 | 4 | 5;

interface PreviewItem {
  index: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  row: Record<string, unknown> | null;
  errors: Array<{ field: string; code: string; message: string }>;
  warnings: Array<{ field: string; code: string; message: string }>;
}

interface PreviewResult {
  totalParsed: number;
  totalValid: number;
  totalWarning: number;
  totalError: number;
  preview: PreviewItem[];
}

interface CommitResult {
  batchId: string;
  totalParsed: number;
  totalCommitted: number;
  totalError: number;
}

const FORMAT_LABELS: Record<Format, string> = {
  csv: 'CSV (point-virgule)',
  'csv-comma': 'CSV (virgule)',
  tsv: 'TSV (tabulation)',
  json: 'JSON',
  jsonl: 'JSONL',
};

const STEPS: Record<Step, string> = {
  1: 'Source',
  2: 'Contenu',
  3: 'Aperçu',
  4: 'Confirmer',
  5: 'Rapport',
};

export function RitualsImportClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [format, setFormat] = useState<Format>('csv');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [importNote, setImportNote] = useState('');
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const downloadTemplate = (fmt: Format) => {
    window.open(
      `/api/admin/rituals/import/template?format=${fmt}`,
      '_blank',
      'noopener',
    );
  };

  const handleFileUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      setContent(text);
    };
    reader.onerror = () => setError('Erreur de lecture du fichier.');
    reader.readAsText(file);
  };

  const runPreview = async () => {
    if (!content.trim()) {
      setError('Veuillez coller ou uploader du contenu.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/rituals/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setPreview(json.data as PreviewResult);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  const runCommit = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/rituals/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          content,
          includeWarnings,
          importNote: importNote || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setCommitResult(json.data as CommitResult);
      setStep(5);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      {/* Stepper */}
      <nav aria-label="Étapes" className="mb-6 flex items-center gap-2 text-xs">
        {([1, 2, 3, 4, 5] as Step[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={s > step}
            onClick={() => s <= step && setStep(s)}
            className={`flex items-center gap-1 border px-2 py-1 ${
              s === step
                ? 'border-stone-900 bg-stone-900 text-white'
                : s < step
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-stone-200 text-stone-400'
            } disabled:cursor-not-allowed`}
          >
            <span>{s < step ? '✓' : s}.</span>
            <span>{STEPS[s]}</span>
          </button>
        ))}
      </nav>

      {error && (
        <p
          role="alert"
          className="mb-4 bg-rose-50 p-3 text-sm text-rose-900"
          data-testid="import-error"
        >
          {error}
        </p>
      )}

      {step === 1 && (
        <section className="space-y-6" data-testid="import-step-1">
          <div>
            <h2 className="mb-3 text-sm font-medium text-stone-700">
              Quel format souhaitez-vous importer ?
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                  data-testid={`import-format-${f}`}
                  className={`border px-3 py-4 text-sm transition-colors ${
                    format === f
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white hover:bg-stone-50'
                  }`}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded border border-stone-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-medium text-stone-700">
              Télécharger un modèle
            </h3>
            <div className="flex flex-wrap gap-2 text-sm">
              {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => downloadTemplate(f)}
                  data-testid={`download-template-${f}`}
                  className="border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
                >
                  {FORMAT_LABELS[f]} ↓
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Le modèle contient 3 lignes d&apos;exemple et la structure attendue.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Continuer →
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4" data-testid="import-step-2">
          <h2 className="text-sm font-medium text-stone-700">
            Coller ou uploader votre contenu ({FORMAT_LABELS[format]})
          </h2>

          <input
            type="file"
            accept=".csv,.tsv,.json,.jsonl,.txt"
            data-testid="import-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="block w-full border border-stone-300 bg-white p-2 text-sm"
          />

          <p className="text-xs italic text-stone-500">
            ou collez le contenu directement ci-dessous :
          </p>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            data-testid="import-content-textarea"
            placeholder={
              format.startsWith('csv') || format === 'tsv'
                ? `body${format === 'csv' ? ';' : format === 'tsv' ? '\\t' : ','}wouldRecommend\\n…`
                : '[{"body":"…","wouldRecommend":"oui"}]'
            }
            className="w-full border border-stone-300 bg-white p-3 font-mono text-xs"
          />

          <p className="text-xs text-stone-500">
            {content.length.toLocaleString('fr-FR')} caractères — max 5 Mo.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
            >
              ← Retour
            </button>
            <button
              type="button"
              onClick={runPreview}
              disabled={pending || content.trim().length === 0}
              data-testid="import-run-preview"
              className="bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {pending ? 'Analyse…' : 'Prévisualiser →'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && preview && (
        <section className="space-y-4" data-testid="import-step-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryTile label="Lignes parsées" value={preview.totalParsed} />
            <SummaryTile label="Valides" value={preview.totalValid} color="emerald" />
            <SummaryTile label="Avertissements" value={preview.totalWarning} color="amber" />
            <SummaryTile label="Erreurs" value={preview.totalError} color="rose" />
          </div>

          <div className="overflow-x-auto border border-stone-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wide text-stone-600">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Statut</th>
                  <th className="p-2 text-left">Aperçu</th>
                  <th className="p-2 text-left">Signal</th>
                  <th className="p-2 text-left">Auteur</th>
                  <th className="p-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.slice(0, 50).map((p) => {
                  const color =
                    p.status === 'VALID'
                      ? 'bg-emerald-50'
                      : p.status === 'WARNING'
                        ? 'bg-amber-50'
                        : 'bg-rose-50';
                  const body =
                    typeof p.row?.body === 'string' ? (p.row.body as string).slice(0, 80) : '';
                  return (
                    <tr
                      key={p.index}
                      className={`border-t border-stone-100 ${color}`}
                      data-testid={`import-preview-row-${p.index}`}
                    >
                      <td className="p-2">{p.index + 1}</td>
                      <td className="p-2 font-medium">{p.status}</td>
                      <td className="p-2 text-stone-700">
                        {body}
                        {body.length === 80 ? '…' : ''}
                      </td>
                      <td className="p-2 text-stone-600">
                        {String(p.row?.wouldRecommend ?? '—')}
                      </td>
                      <td className="p-2 text-stone-600">
                        {String(p.row?.authorFirstName ?? '—')}
                        {p.row?.authorCity ? `, ${p.row.authorCity}` : ''}
                      </td>
                      <td className="p-2 text-stone-600">
                        {p.errors.map((e) => (
                          <span key={e.code} className="block text-rose-800">
                            {e.message}
                          </span>
                        ))}
                        {p.warnings.map((w) => (
                          <span key={w.code} className="block text-amber-800">
                            {w.message}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.preview.length > 50 && (
              <p className="bg-stone-50 p-2 text-xs italic text-stone-500">
                {preview.preview.length - 50} lignes additionnelles non affichées.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
            >
              ← Modifier le contenu
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={preview.totalValid + (includeWarnings ? preview.totalWarning : 0) === 0}
              data-testid="import-go-confirm"
              className="bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Continuer vers le commit →
            </button>
          </div>
        </section>
      )}

      {step === 4 && preview && (
        <section className="space-y-4" data-testid="import-step-4">
          <div className="rounded border border-stone-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-medium text-stone-700">
              Confirmation du commit
            </h2>
            <p className="text-sm text-stone-700">
              Vous êtes sur le point de créer{' '}
              <strong>
                {preview.totalValid + (includeWarnings ? preview.totalWarning : 0)} rituels
              </strong>{' '}
              en statut <strong>PENDING</strong>.
            </p>
            <ul className="mt-3 list-inside list-disc text-xs text-stone-600">
              <li>{preview.totalValid} valides</li>
              <li>
                {preview.totalWarning} avec avertissements{' '}
                {includeWarnings ? '(inclus)' : '(exclus)'}
              </li>
              <li>{preview.totalError} en erreur (exclus)</li>
            </ul>

            <label className="mt-4 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeWarnings}
                onChange={(e) => setIncludeWarnings(e.target.checked)}
                data-testid="import-include-warnings"
                className="h-4 w-4 accent-stone-900"
              />
              Inclure les rows avec avertissements
            </label>

            <label className="mt-4 block text-xs">
              <span className="block text-stone-700">Note interne (optionnelle)</span>
              <input
                type="text"
                value={importNote}
                onChange={(e) => setImportNote(e.target.value)}
                maxLength={500}
                data-testid="import-note"
                placeholder="Lot WhatsApp mai 2026"
                className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
            >
              ← Aperçu
            </button>
            <button
              type="button"
              onClick={runCommit}
              disabled={pending}
              data-testid="import-run-commit"
              className="bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {pending ? 'Commit en cours…' : 'Confirmer le commit'}
            </button>
          </div>
        </section>
      )}

      {step === 5 && commitResult && (
        <section className="space-y-4" data-testid="import-step-5">
          <div className="rounded border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-lg font-semibold text-emerald-900">
              ✓ Import réussi
            </h2>
            <p className="mt-1 text-sm text-emerald-900">
              <strong>{commitResult.totalCommitted}</strong> rituels créés en
              PENDING sur <strong>{commitResult.totalParsed}</strong> lignes
              parsées ({commitResult.totalError} erreurs).
            </p>
            <p className="mt-2 text-xs text-emerald-900">
              Batch ID : <code>{commitResult.batchId}</code>
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/admin/rituals/queue"
              className="bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Voir la queue de modération →
            </a>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setContent('');
                setPreview(null);
                setCommitResult(null);
                setImportNote('');
              }}
              className="border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
            >
              Nouvel import
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'emerald' | 'amber' | 'rose';
}) {
  const colorClass =
    color === 'emerald'
      ? 'text-emerald-900'
      : color === 'amber'
        ? 'text-amber-900'
        : color === 'rose'
          ? 'text-rose-900'
          : 'text-stone-900';
  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}
