/**
 * Sanitization SVG côté client — défense en profondeur pour les SVG
 * inline rendus par `dangerouslySetInnerHTML`. Plus permissive que
 * `sanitizeSvgInline` (déjà passée côté serveur lors du save), elle
 * strippe uniquement les payloads XSS sans rejeter le contenu.
 *
 * Le serveur garantit que `posterCoverSvg.inline` a déjà été sanitized
 * lors du save admin ; on re-sanitize côté client pour couvrir :
 *  - les imports legacy / mocks bruts non passés par l'API admin
 *  - tout cas de mauvaise sérialisation
 */
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeSvgClient(raw: string): string {
  if (typeof raw !== 'string' || raw.trim() === '') return '';
  try {
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: [
        'animate',
        'animateTransform',
        'animateMotion',
        'mpath',
        'feSpecularLighting',
        'feDistantLight',
        'feOffset',
        'feFlood',
        'feBlend',
        'feMerge',
        'feMergeNode',
        'feColorMatrix',
        'feTurbulence',
        'feComposite',
        'feGaussianBlur',
      ],
      ADD_ATTR: [
        'attributeName',
        'attributeType',
        'values',
        'dur',
        'repeatCount',
        'begin',
        'end',
        'from',
        'to',
        'by',
        'restart',
        'fill',
        'calcMode',
        'keyTimes',
        'keySplines',
        'additive',
        'accumulate',
        'baseFrequency',
        'numOctaves',
        'stdDeviation',
        'seed',
        'type',
      ],
      FORBID_ATTR: ['style'],
    }) as string;
  } catch {
    // En cas d'erreur (env exotique sans DOM), fallback prudent : vide.
    return '';
  }
}
