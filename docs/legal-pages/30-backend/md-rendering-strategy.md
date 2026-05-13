# 30.2 — Stratégie de rendu Markdown

## Pipeline

```
body_md (DB)
    │
    ▼
1. Substitution {{VARS}}
    │  legal_template_vars
    ▼
2. Parse Markdown
    │  markdown-it
    ▼
3. Sanitization HTML
    │  dompurify (whitelist)
    ▼
4. Append metadata (last_updated, version)
    │
    ▼
HTML rendu (cache 5min)
```

## Étape 1 — Substitution variables

```typescript
function substituteVars(md: string, vars: Map<string, string>): string {
  return md.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (_, key) => {
    const value = vars.get(key);
    if (!value) {
      // Mode public : fallback
      return `[${key}]`;
      // Mode admin preview : highlight
      // return `<span class="missing-var">{{${key}}}</span>`;
    }
    return value;
  });
}
```

### Variables prédéfinies (auto-calculées)

| Variable | Source | Exemple |
|---|---|---|
| `{{LAST_UPDATED}}` | `legal_pages.updated_at` formatté | "13 mai 2026" |
| `{{CURRENT_YEAR}}` | `new Date().getFullYear()` | "2026" |
| `{{SITE_URL}}` | env `NEXT_PUBLIC_SITE_URL` | "https://femiglow-maroc.com" |

Les autres viennent de `legal_template_vars`.

## Étape 2 — Parse Markdown

Lib : **markdown-it** (mature, performant, extensible).

Config :
```typescript
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,           // SÉCURITÉ : interdit HTML inline
  xhtmlOut: false,
  breaks: false,         // Pas de single newline = <br>
  linkify: true,         // Auto-link URLs
  typographer: true,     // « guillemets français », tirets…
  quotes: '«  »‹  ›', // FR quotes
});
```

Extensions :
- `markdown-it-anchor` (ancres H2/H3 pour table des matières)
- `markdown-it-attrs` (classes CSS via `{.class}`) — uniquement si besoin

## Étape 3 — Sanitization HTML

Lib : **DOMPurify** (server-side via jsdom).

Whitelist :
```typescript
const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'code', 'pre', 'blockquote', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'img',  // limited, see below
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'target', 'rel', 'class', 'id'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):)/,
  ADD_TAGS: [],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', /^on/],
};
```

### Liens externes : `target` et `rel`

Auto-ajout :
- `target="_blank"` + `rel="noopener noreferrer"` sur les liens externes
- Pas de modification sur les liens internes (/legal/…)

```typescript
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if ('target' in node) {
    const href = node.getAttribute('href') || '';
    if (href.startsWith('http') && !href.includes('femiglow-maroc.com')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});
```

### Images

`<img>` autorisé mais avec contraintes :
- `src` doit commencer par `/` (local) ou `https://`
- Pas de data: URI

## Étape 4 — Cache

```typescript
// /api/legal/[slug]/route.ts
export async function GET(req, { params }) {
  const cached = cache.get(`legal:${params.slug}`);
  if (cached) return new Response(JSON.stringify(cached), {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
  });

  const page = await db.legalPages.findBySlug(params.slug);
  if (!page || page.status !== 'published') return notFound();

  const vars = await db.legalTemplateVars.all();
  const html = await renderLegalMd(page.body_md, varsMap(vars));
  const payload = { ...page, content_html: html };

  cache.set(`legal:${params.slug}`, payload, 300);
  return Response.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
  });
}
```

### Invalidation cache

À la publication d'une page :
```typescript
cache.del(`legal:${slug}`);
revalidatePath(`/${slug}`);
revalidatePath(`/legal/${slug}`);
```

## API publique de la lib

```typescript
// lib/legal/renderer.ts
export interface RenderOptions {
  mode?: 'public' | 'admin-preview';
  variables?: Map<string, string>;
}

export function renderLegalMd(bodyMd: string, options?: RenderOptions): string {
  // 1. Substitute vars
  // 2. Parse MD
  // 3. Sanitize HTML
  // 4. Return string
}

export function detectMissingVariables(bodyMd: string, variables: Map<string, string>): string[] {
  const matches = [...bodyMd.matchAll(/\{\{([A-Z][A-Z0-9_]*)\}\}/g)];
  const found = new Set(matches.map((m) => m[1]));
  const missing: string[] = [];
  for (const key of found) {
    if (!variables.get(key) && !PRESET_VARS.has(key)) {
      missing.push(key);
    }
  }
  return missing;
}

export function extractTableOfContents(bodyMd: string): TocEntry[] {
  // Pour rendre une table des matières optionnelle dans la page publique
}
```

## Tests

```typescript
describe('renderLegalMd', () => {
  it('substitutes variables', () => {
    const md = 'Hello {{COMPANY_NAME}}';
    const html = renderLegalMd(md, { variables: new Map([['COMPANY_NAME', 'FemiGlow']]) });
    expect(html).toContain('Hello FemiGlow');
  });

  it('rejects script tags', () => {
    const md = '<script>alert(1)</script>';
    const html = renderLegalMd(md);
    expect(html).not.toContain('<script>');
  });

  it('auto-adds target=_blank on external links', () => {
    const md = '[Google](https://google.com)';
    const html = renderLegalMd(md);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('detects missing variables', () => {
    const missing = detectMissingVariables('{{FOO}} {{BAR}}', new Map([['FOO', 'x']]));
    expect(missing).toEqual(['BAR']);
  });
});
```
