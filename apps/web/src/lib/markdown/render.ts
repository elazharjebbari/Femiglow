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
// hast types come from @types/hast (transitive via rehype-* deps)

export interface ArticleHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: ArticleHeading[];
}

const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
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
  },
};

function collectHeadings(headings: ArticleHeading[]) {
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

function lazyImages() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return;
      node.properties = {
        ...(node.properties ?? {}),
        loading: 'lazy',
        decoding: 'async',
      };
    });
  };
}

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const headings: ArticleHeading[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(lazyImages)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(source);
  return { html: String(file), headings };
}
