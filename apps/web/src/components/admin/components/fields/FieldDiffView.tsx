/**
 * FieldDiffView — affichage du diff entre 2 versions (P11).
 *
 * Mode `text` (text/multiline/rich-text/kicker/quote) : rendu inline avec
 * lignes vertes/rouges + numéros côté avant/après.
 *
 * Mode `json` (cta/link/list/record/breadcrumb-segment) : table de chemins
 * modifiés `path → before → after`.
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P11.
 */
import type { FieldType } from '@/lib/db/types';
import {
  diffModeFor,
  jsonDiff,
  textDiff,
  valueToText,
  type JsonDiffEntry,
  type TextDiffLine,
} from '@/lib/components/fields/diff';

interface Props {
  fieldType: FieldType;
  before: unknown;
  after: unknown;
  labelBefore?: string;
  labelAfter?: string;
}

export function FieldDiffView({
  fieldType,
  before,
  after,
  labelBefore = 'Avant',
  labelAfter = 'Après',
}: Props): JSX.Element {
  const mode = diffModeFor(fieldType);
  if (mode === 'text') {
    const lines = textDiff(valueToText(before), valueToText(after));
    return <TextDiff lines={lines} labelBefore={labelBefore} labelAfter={labelAfter} />;
  }
  const entries = jsonDiff(before, after);
  return <JsonDiffTable entries={entries} labelBefore={labelBefore} labelAfter={labelAfter} />;
}

function TextDiff({
  lines,
  labelBefore,
  labelAfter,
}: {
  lines: TextDiffLine[];
  labelBefore: string;
  labelAfter: string;
}): JSX.Element {
  if (lines.length === 0 || lines.every((l) => l.op === 'eq')) {
    return (
      <p className="text-sm italic text-stone-500" role="status">
        Aucune différence.
      </p>
    );
  }
  return (
    <figure
      className="field-diff-text overflow-hidden rounded-md border border-stone-200 font-mono text-xs"
      aria-label={`Diff ${labelBefore} → ${labelAfter}`}
    >
      <ol className="divide-y divide-stone-100">
        {lines.map((l, idx) => {
          const bg =
            l.op === 'add'
              ? 'bg-green-50 text-green-900'
              : l.op === 'del'
              ? 'bg-red-50 text-red-900'
              : 'bg-white text-stone-700';
          const sign = l.op === 'add' ? '+' : l.op === 'del' ? '−' : ' ';
          return (
            <li
              key={`${idx}-${l.op}`}
              className={`flex items-baseline gap-2 px-3 py-1 ${bg}`}
              data-op={l.op}
            >
              <span className="w-8 select-none text-right tabular-nums text-stone-400">
                {l.beforeNo ?? ''}
              </span>
              <span className="w-8 select-none text-right tabular-nums text-stone-400">
                {l.afterNo ?? ''}
              </span>
              <span aria-hidden="true" className="select-none text-stone-400">
                {sign}
              </span>
              <span className="whitespace-pre-wrap break-words">{l.text || ' '}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function JsonDiffTable({
  entries,
  labelBefore,
  labelAfter,
}: {
  entries: JsonDiffEntry[];
  labelBefore: string;
  labelAfter: string;
}): JSX.Element {
  if (entries.length === 0) {
    return (
      <p className="text-sm italic text-stone-500" role="status">
        Aucune différence.
      </p>
    );
  }
  return (
    <table
      className="field-diff-json w-full table-auto border-collapse text-sm"
      aria-label={`Diff JSON ${labelBefore} → ${labelAfter}`}
    >
      <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
        <tr>
          <th scope="col" className="px-3 py-2">Op</th>
          <th scope="col" className="px-3 py-2">Chemin</th>
          <th scope="col" className="px-3 py-2">{labelBefore}</th>
          <th scope="col" className="px-3 py-2">{labelAfter}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {entries.map((e, idx) => (
          <tr key={`${idx}-${e.path}`} data-op={e.op}>
            <td className="px-3 py-2 align-top">
              {e.op === 'add' ? (
                <span className="inline-flex rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  ajout
                </span>
              ) : e.op === 'del' ? (
                <span className="inline-flex rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                  suppression
                </span>
              ) : (
                <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  modif
                </span>
              )}
            </td>
            <td className="px-3 py-2 align-top">
              <code className="font-mono text-xs text-stone-700">{e.path}</code>
            </td>
            <td className="px-3 py-2 align-top">
              <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap break-words text-xs text-red-700">
                {formatScalar(e.before)}
              </pre>
            </td>
            <td className="px-3 py-2 align-top">
              <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap break-words text-xs text-green-700">
                {formatScalar(e.after)}
              </pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatScalar(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
