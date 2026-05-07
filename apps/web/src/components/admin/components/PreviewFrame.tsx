/**
 * PreviewFrame — iframe `/admin/components/[key]/preview` + listener
 * postMessage côté parent.
 *
 * Le parent :
 *   - écoute `PREVIEW_READY` pour ne pas envoyer de messages avant que
 *     l'iframe ne soit prête,
 *   - debounce les `FIELDS_CHANGED` à 200 ms,
 *   - relaye les `FIELD_CLICKED` via un `CustomEvent` côté admin pour
 *     que le form panel puisse focaliser le bon champ,
 *   - propose un toggle de largeur (mobile / tablet / desktop) qui
 *     change l'attribut `width` de l'iframe sans la recharger.
 *
 * Cf. docs/components-cms/frontend/04-live-preview.md (F4).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PREVIEW_WIDTHS,
  PREVIEW_WIDTH_LABEL,
  PREVIEW_WIDTH_PX,
  parsePreviewMessage,
  type PreviewMessage,
  type PreviewWidth,
} from './preview-protocol';

const FIELDS_CHANGED_DEBOUNCE_MS = 200;

interface Props {
  componentKey: string;
  /**
   * Tick incrémenté par le parent à chaque dirty change. Le PreviewFrame
   * envoie `FIELDS_CHANGED` (debounced) à chaque incrément ≥ 1.
   */
  changeTick: number;
  /** Largeur initiale (par défaut `desktop`). */
  initialWidth?: PreviewWidth;
}

export function PreviewFrame({
  componentKey,
  changeTick,
  initialWidth = 'desktop',
}: Props): JSX.Element {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState<PreviewWidth>(initialWidth);

  // Listener `message` — accepte READY et FIELD_CLICKED.
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.origin !== window.location.origin) return;
      const msg = parsePreviewMessage(e.data);
      if (!msg) return;
      if (msg.componentKey !== componentKey) return;

      if (msg.type === 'PREVIEW_READY') {
        setReady(true);
        return;
      }
      if (msg.type === 'FIELD_CLICKED') {
        // Expose un évènement DOM custom pour les composants admin
        // intéressés (ex. focus du FieldRow correspondant).
        document.dispatchEvent(
          new CustomEvent('admin:focus-field', {
            detail: { fieldKey: msg.fieldKey },
          }),
        );
        return;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [componentKey]);

  // Debounce envoi du FIELDS_CHANGED à chaque incrément de changeTick
  // (uniquement quand l'iframe est ready).
  useEffect(() => {
    if (!ready) return;
    if (changeTick === 0) return;
    const t = setTimeout(() => {
      const win = ref.current?.contentWindow;
      if (!win) return;
      const msg: PreviewMessage = {
        type: 'FIELDS_CHANGED',
        componentKey,
      };
      win.postMessage(msg, window.location.origin);
    }, FIELDS_CHANGED_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [changeTick, componentKey, ready]);

  const widthPx = PREVIEW_WIDTH_PX[width];
  const iframeStyle: React.CSSProperties = widthPx
    ? { width: `${widthPx}px`, maxWidth: '100%' }
    : { width: '100%' };

  return (
    <div className="preview-frame flex flex-col">
      <WidthToggle value={width} onChange={setWidth} />
      <div className="mt-3 flex justify-center overflow-auto rounded-md border border-stone-200 bg-white">
        <iframe
          ref={ref}
          src={`/admin/components/${encodeURIComponent(componentKey)}/preview?w=${width}`}
          title={`Aperçu ${componentKey}`}
          className="preview-iframe min-h-[480px] border-0"
          style={iframeStyle}
          // `same-origin` requis pour postMessage avec window.parent ;
          // `scripts` pour que React Server Components puisse hydrater.
          sandbox="allow-same-origin allow-scripts"
          data-ready={ready ? 'true' : 'false'}
        />
      </div>
    </div>
  );
}

interface WidthToggleProps {
  value: PreviewWidth;
  onChange: (next: PreviewWidth) => void;
}

function WidthToggle({ value, onChange }: WidthToggleProps): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Largeur de la preview"
      className="width-toggle inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 p-1 text-xs"
    >
      {PREVIEW_WIDTHS.map((w) => {
        const checked = value === w;
        return (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(w)}
            className={
              'rounded px-2 py-1 ' +
              (checked
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-white')
            }
          >
            {PREVIEW_WIDTH_LABEL[w]}
          </button>
        );
      })}
    </div>
  );
}
