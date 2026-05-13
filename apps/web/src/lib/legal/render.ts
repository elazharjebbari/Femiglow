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
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ['target', '_blank'],
      ['rel', 'noopener', 'noreferrer'],
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      'loading',
      'decoding',
      'width',
      'height',
    ],
    mark: [['dataMissingVar']],
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

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(externalLinks())
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
