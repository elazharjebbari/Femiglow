/**
 * RichTextEditor — toolbar markdown léger + preview.
 *
 * v1 : on persiste du markdown, qui sera converti côté serveur en HTML
 * sanitisé (cf. P4 `sanitizeRichText`). On évite une dépendance type
 * ProseMirror : un `<textarea>` + boutons d'aide qui insèrent du markdown
 * au curseur (h2, h3, **gras**, *ital*, [link], `- liste`).
 *
 * La preview est une simple chaîne markdown rendue via un transform local
 * minimal (h2, h3, bold, italic, link, ul). Pour v2 on remplacera par un
 * vrai parser markdown server-side.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md §RichTextEditor
 */
'use client';

import { useRef } from 'react';
import type { EditorProps } from '../types';

interface ToolbarAction {
  key: string;
  label: string;
  apply: (sel: string) => string;
  shortcut?: string;
}

const ACTIONS: ToolbarAction[] = [
  { key: 'h2', label: 'H2', apply: (s) => `\n## ${s || 'Titre H2'}\n` },
  { key: 'h3', label: 'H3', apply: (s) => `\n### ${s || 'Titre H3'}\n` },
  { key: 'bold', label: 'Gras', apply: (s) => `**${s || 'gras'}**`, shortcut: 'Ctrl+B' },
  { key: 'italic', label: 'Italique', apply: (s) => `*${s || 'italique'}*`, shortcut: 'Ctrl+I' },
  { key: 'link', label: 'Lien', apply: (s) => `[${s || 'texte du lien'}](https://)` },
  { key: 'ul', label: 'Liste', apply: (s) => `\n- ${s || 'item'}\n` },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Mini-renderer markdown → HTML (preview only). Volontairement minimal, ne
 * remplace pas un vrai parser. Le serveur fait la vraie sanitisation.
 */
function renderPreview(md: string): string {
  if (!md) return '';
  let out = escapeHtml(md);
  out = out.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  out = out.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  // Listes : groupes de lignes commençant par "- "
  out = out.replace(/(^|\n)((?:- .+\n?)+)/g, (_m, lead: string, block: string) => {
    const items = block
      .trim()
      .split('\n')
      .map((l) => l.replace(/^- /, '').trim())
      .map((l) => `<li>${l}</li>`)
      .join('');
    return `${lead}<ul>${items}</ul>`;
  });
  // Paragraphes naïfs : on convertit les double-newlines en <p>
  out = out
    .split(/\n{2,}/)
    .map((chunk) => {
      if (/^<(h2|h3|ul|ol|blockquote)/.test(chunk.trim())) return chunk;
      return chunk.trim() ? `<p>${chunk.trim().replace(/\n/g, '<br />')}</p>` : '';
    })
    .join('\n');
  return out;
}

export function RichTextEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<string>): JSX.Element {
  const cfg = fieldDef.config ?? {};
  const current = value ?? '';
  const max = cfg.maxLength;
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const errorId = error ? `${id}-error` : undefined;
  const counterId = max ? `${id}-counter` : undefined;

  function applyAction(action: ToolbarAction): void {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = current.slice(start, end);
    const inserted = action.apply(sel);
    const next = current.slice(0, start) + inserted + current.slice(end);
    onChange(next);
    // Re-focus + replacer le curseur après l'insertion (asynchrone car
    // React doit re-render la valeur d'abord).
    setTimeout(() => {
      el.focus();
      const cursor = start + inserted.length;
      el.setSelectionRange(cursor, cursor);
    }, 0);
  }

  return (
    <div className="field-rich-text">
      <div role="toolbar" aria-label="Mise en forme" className="rt-toolbar">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => applyAction(a)}
            disabled={readOnly}
            aria-label={`${a.label}${a.shortcut ? ` (${a.shortcut})` : ''}`}
            title={a.shortcut}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="rt-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <textarea
          id={id}
          ref={ref}
          rows={8}
          value={current}
          onChange={(e) => onChange(e.target.value)}
          maxLength={max}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, counterId].filter(Boolean).join(' ') || undefined}
          placeholder={cfg.placeholder ?? 'Markdown — utilisez la toolbar pour les titres, gras, listes…'}
        />
        <div
          className="rt-preview"
          aria-label="Aperçu"
          // Le preview est local, non sanitisé serveur. Le contenu est issu
          // d'un mini-renderer qui passe par `escapeHtml` puis ré-introduit
          // un tout petit nombre de balises connues — les vrais usages prod
          // affichent le `sanitizeRichText` via la P4.
          dangerouslySetInnerHTML={{ __html: renderPreview(current) }}
        />
      </div>
      {max ? (
        <span id={counterId} className="char-counter" aria-live="polite">
          {current.length} / {max}
        </span>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
