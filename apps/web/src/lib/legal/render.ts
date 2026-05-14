import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import type { Root, Element } from 'hast';

import { env } from '@/lib/env';
import {
  buildVarMap,
  detectVarsInTemplate,
  MISSING_VAR_REGEX,
  presetVars,
  substituteVars,
  type SubstituteMode,
} from '@/lib/legal/vars';

export interface LegalHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface RenderedLegal {
  html: string;
  headings: LegalHeading[];
  varsUsed: string[];
}

const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'mark',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'id'],
    // NB: on liste `target` et `rel` sans contraindre les valeurs — le
    // plugin `externalLinks` impose la bonne valeur AVANT sanitize. Les
    // valeurs autorisées sont filtrées par `allowComments`/`tagFilter` de
    // rehype-sanitize. La forme tuple `['key', 'v1', 'v2']` impose que la
    // valeur soit strictement 'v1' OU 'v2' — ce qui filtre « noopener
    // noreferrer » (deux tokens séparés par espace).
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'target',
      'rel',
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      'loading',
      'decoding',
      'width',
      'height',
    ],
    mark: ['dataMissingVar'],
  },
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ['http', 'https', 'mailto', 'tel'],
    src: ['http', 'https'],
  },
};

function collectHeadings(headings: LegalHeading[]) {
  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'h2' && node.tagName !== 'h3') return;
      const id = typeof node.properties?.id === 'string' ? node.properties.id : null;
      if (!id) return;
      headings.push({
        depth: node.tagName === 'h2' ? 2 : 3,
        id,
        text: toString(node),
      });
    });
  };
}

/**
 * Plugin rehype : visite les nœuds texte et remplace les marqueurs
 * `⦉KEY⦊` (injectés par substituteVars en admin-preview mode) par
 * `<mark data-missing-var="KEY">{{KEY}}</mark>`. Cours après le parse
 * MD mais AVANT sanitize pour que le mark soit dans la whitelist.
 *
 * Out-of-band : ne touche aucun texte sans marqueur. Idempotent.
 */
function rehypeHighlightMissingVars() {
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const text = (node as { value: string }).value;
      if (!text.includes('⦉')) return;
      MISSING_VAR_REGEX.lastIndex = 0;
      const parts: Array<{ type: 'text' | 'mark'; value: string; key?: string }> = [];
      let lastIdx = 0;
      let m: RegExpExecArray | null;
      while ((m = MISSING_VAR_REGEX.exec(text)) !== null) {
        if (m.index > lastIdx) {
          parts.push({ type: 'text', value: text.slice(lastIdx, m.index) });
        }
        parts.push({ type: 'mark', value: `{{${m[1]}}}`, key: m[1] });
        lastIdx = m.index + m[0].length;
      }
      if (parts.length === 0) return;
      if (lastIdx < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIdx) });
      }
      const replacements = parts.map((p) =>
        p.type === 'text'
          ? { type: 'text', value: p.value }
          : ({
              type: 'element',
              tagName: 'mark',
              properties: { dataMissingVar: p.key },
              children: [{ type: 'text', value: p.value }],
            } as Element),
      );
      (parent.children as unknown[]).splice(index, 1, ...replacements);
      // Skip the inserted nodes en retournant le nouvel index.
      return index + replacements.length;
    });
  };
}

function externalLinks() {
  const siteHost = (() => {
    try {
      return new URL(env.NEXT_PUBLIC_SITE_URL).hostname;
    } catch {
      return '';
    }
  })();

  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = typeof node.properties?.href === 'string' ? node.properties.href : '';
      if (!href.startsWith('http')) return;
      try {
        const u = new URL(href);
        if (u.hostname && u.hostname !== siteHost) {
          node.properties = {
            ...(node.properties ?? {}),
            target: '_blank',
            rel: 'noopener noreferrer',
          };
        }
      } catch {
        // ignore malformed href
      }
    });
  };
}

export interface RenderLegalOptions {
  mode?: SubstituteMode;
  variables?: Map<string, string>;
  now?: Date;
}

export async function renderLegalMarkdown(
  bodyMd: string,
  opts: RenderLegalOptions = {},
): Promise<RenderedLegal> {
  const mode = opts.mode ?? 'public';
  const vars = opts.variables ?? presetVars(opts.now);
  const substituted = substituteVars(bodyMd, vars, mode);
  const headings: LegalHeading[] = [];

  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(externalLinks());

  // Le plugin missing-vars highlight doit tourner AVANT sanitize pour
  // que les <mark> insérés soient dans la whitelist. Activé seulement en
  // mode admin-preview pour ne jamais leak les marqueurs en public.
  if (mode === 'admin-preview') {
    pipeline.use(rehypeHighlightMissingVars);
  }

  const file = await pipeline
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(substituted);

  return {
    html: String(file),
    headings,
    varsUsed: detectVarsInTemplate(bodyMd),
  };
}

export async function renderLegalMarkdownWithDbVars(
  bodyMd: string,
  dbVars: ReadonlyArray<{ key: string; value: string | null }>,
  opts: Omit<RenderLegalOptions, 'variables'> = {},
): Promise<RenderedLegal> {
  return renderLegalMarkdown(bodyMd, {
    ...opts,
    variables: buildVarMap(dbVars, { mode: opts.mode, now: opts.now }),
  });
}
