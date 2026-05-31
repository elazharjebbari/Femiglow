# 40.3 — Éditeur MD split-pane : design

## Objectif

Donner à l'admin un éditeur **markdown brut** avec **aperçu temps réel**
identique au rendu public, avec aides contextuelles (variables, liens,
warnings juridiques).

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ⟵ Pages légales         Brouillon · v3 (édité)         💾 · 🚀 ▾ │ ← header (sticky)
├──────────────────────────────────────────────────────────────────┤
│ Contenu  Métadonnées  Affichage  SEO  Historique  Zone ⚠         │ ← tabs
├──────────────────────────────────────────────────────────────────┤
│  Markdown                       │  Aperçu                        │
│  ┌─────────────────────────┐    │  ┌─────────────────────────┐  │
│  │ # Titre H1              │    │  │ # Titre H1              │  │
│  │                         │    │  │                         │  │
│  │ Société : {{COMPANY_RC}}│    │  │ Société : RC 123456 ✏  │  │ ← var resolved + edit icon
│  │                         │    │  │                         │  │
│  │ ## Section 1            │    │  │ ## Section 1            │  │
│  │ Texte normal…           │    │  │ Texte normal…           │  │
│  └─────────────────────────┘    │  └─────────────────────────┘  │
│   B  I  H1 H2 🔗 ≡ ⟨{{}}⟩       │    Mode : Preview ▾           │
├──────────────────────────────────────────────────────────────────┤
│ 1247 car · Auto-saved il y a 12s · 0 var manquante · 2 liens OK │ ← footer
└──────────────────────────────────────────────────────────────────┘
```

## Composants techniques

### Éditeur

Library : **CodeMirror 6** (léger, performant, customisable).

```typescript
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { femiglowTheme } from './editor-theme';

const editor = new EditorView({
  doc: page.body_md,
  extensions: [
    basicSetup,
    markdown(),
    femiglowTheme,
    autoCompleteVars(),       // {{COMP… → suggère COMPANY_RC, COMPANY_RC_PLUS, …
    autoCompleteSlugs(),      // [ouvre]( + lookup
    findReplace(),
    EditorView.updateListener.of(({ docChanged, state }) => {
      if (docChanged) onChange(state.doc.toString());
    }),
  ],
});
```

### Preview

Library : **markdown-it** + **DOMPurify** côté client (identique au serveur).

```typescript
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function renderPreview(bodyMd: string, vars: TemplateVarsMap): string {
  const substituted = substituteVars(bodyMd, vars, {
    highlightMissing: true,  // wrap missing in <span class="var-missing">
  });
  const html = md.render(substituted);
  return DOMPurify.sanitize(html, FEMIGLOW_DOMPURIFY_CONFIG);
}
```

### Substitution variables

```typescript
function substituteVars(md, vars, opts) {
  return md.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined || value === null || value === '') {
      return opts.highlightMissing
        ? `<span class="var-missing" title="Variable manquante">{{${key}}}</span>`
        : `{{${key}}}`;
    }
    return value;
  });
}
```

Style `.var-missing` en preview : fond rouge clair, tooltip.

### Scroll sync

Quand l'utilisateur scrolle dans l'éditeur, le preview suit (et vice-versa).
Implémentation : mapper la ligne MD courante à un anchor dans le HTML.

```typescript
md.renderer.rules.heading_open = (tokens, idx, opts, env, self) => {
  const line = tokens[idx].map?.[0];
  if (line !== undefined) tokens[idx].attrSet('data-md-line', String(line));
  return self.renderToken(tokens, idx, opts);
};
```

Puis :
```typescript
editor.onScroll((scrollTop) => {
  const lineNo = lineFromScroll(scrollTop);
  const anchor = previewEl.querySelector(`[data-md-line="${lineNo}"]`);
  if (anchor) anchor.scrollIntoView({ behavior: 'instant', block: 'start' });
});
```

## Toolbar

Format minimaliste :
- **B** : `**texte**` autour de la sélection
- _I_ : `*texte*`
- H1 / H2 : `# ` / `## ` en début de ligne
- 🔗 Link : ouvre un picker `LegalLinkPicker` (lookup autres pages + URLs externes)
- ≡ List : `- `
- `{{}}` : ouvre dropdown des variables existantes

## Auto-save

```typescript
useLegalEditorAutoSave(slug, bodyMd, { intervalMs: 30_000 });
```

- Trigger : 30s après dernière modification, OU 5s d'inactivité.
- Cancel : si statut → `review` (l'admin a soumis).
- Indicateur footer : "Sauvegardé il y a 5s".
- Sur erreur réseau : retry avec backoff exponentiel + toast warning.
- Sur tab close : `beforeunload` warn si `dirty`.

## Lock optimiste (anti race condition)

Sur chaque PUT, envoyer le `version` actuel :

```typescript
PUT /api/admin/legal/cgv
Body: { body_md: "...", version: 3 }
```

Serveur :
```typescript
if (current.version !== payload.version) {
  return 409 Conflict { reason: 'version_mismatch', currentVersion: current.version };
}
```

Front : afficher modale "Autre utilisateur a édité. Reload ?"

## Indicateurs variables

À côté de chaque `{{VAR}}` dans l'aperçu :

| État | Icône | Couleur |
|---|---|---|
| Remplie | ✓ | green (low contrast) |
| Manquante (required) | ⚠ | red |
| Manquante (optional) | • | gray |

Click sur l'icône → ouvre `LegalTemplateVarsEditor` en drawer.

## Vérification liens

Bouton "Vérifier les liens" en bas :

```typescript
async function checkLinks() {
  const links = extractLinks(bodyMd);  // [{ text, href }]
  const results = await Promise.all(links.map(l => fetch('/api/admin/legal/check-link', { method: 'POST', body: JSON.stringify({ url: l.href }) })));
  setLinkStatuses(results);
}
```

Pour chaque lien : ✓/✗/⏱ dans le panneau "Liens".

## A11y

- Toolbar : `<button aria-label="Gras (Cmd+B)">B</button>`
- Tabs : `role="tablist"`, `aria-selected`, focus visible
- Editor : focus ring distinct, Esc pour quitter
- Preview : `aria-live="polite"` quand l'aperçu se met à jour
- Touch targets : tous ≥44×44px sur mobile
- Color contrast : AA minimum
- Skip link : "Aller à l'éditeur" / "Aller à l'aperçu"

## Mobile

Sur écrans < 768px : tabs au lieu de split-pane.

```
[ Éditer | Aperçu ]
```

Toolbar simplifiée (seulement B, I, H, link).

## Tests

- Jest : `substituteVars`, `extractLinks`, scroll mapper
- Playwright : flow complet édition → save → publish
- Accessibility : axe-core pass
