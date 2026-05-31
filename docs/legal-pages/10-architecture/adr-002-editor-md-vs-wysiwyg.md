# ADR-002 — Choix de l'éditeur : MD raw + preview live

> **Statut** : Proposed
> **Date** : 2026-05-13

## Contexte

L'admin doit éditer le contenu des pages légales depuis l'UI. Quel format
et quelle expérience ?

## Options évaluées

### Option 1 — Raw MD textarea

Un simple textarea, l'admin tape du markdown.

✅ Simple, zéro dépendance
❌ Pas de preview live
❌ Difficile pour non-tech

### Option 2 — MD raw + preview live split-pane ★ retenu

Éditeur MD à gauche, preview à droite, mise à jour live. Toolbar utilitaire.

✅ Confidence ++ via preview
✅ Markdown propre comme source de vérité
✅ Léger (markdown-it ≈ 30 KB)
⚠ Admin doit comprendre MD basique (5 min de tuto)

### Option 3 — WYSIWYG (TipTap / Lexical)

Éditeur visuel, l'admin ne voit jamais de MD.

✅ UX familière (Word-like)
❌ Lourd (200+ KB)
❌ Sérialisation lossy (HTML → MD imparfait)
❌ Maintenance lib externe
❌ Tableaux/classes CSS difficiles à gérer

## Décision

**Option 2** — MD raw + preview live + toolbar.

## Conséquences

### Positives
- Source de vérité MD propre (portable, lisible)
- Compatible avec versioning git (diff lisible)
- Léger (markdown-it)
- Workflow standard pour devs

### Négatives
- Friction pour admin total non-tech (apprendre MD)
- Mitigation : toolbar pour bouton gras/italique/lien/heading

### Spec technique

- Lib MD : **markdown-it** + **dompurify** pour sanitization
- Pas de plugins complexes (footnotes, tables → si besoin, MD GFM)
- Whitelist HTML tags pour le contenu :
  - Texte : `<p>`, `<br>`, `<strong>`, `<em>`, `<code>`, `<blockquote>`
  - Structure : `<h2>`, `<h3>`, `<h4>`, `<ul>`, `<ol>`, `<li>`, `<hr>`
  - Liens : `<a href target rel>`
  - Tableaux : `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
- Pas autorisés : `<script>`, `<iframe>`, `<style>`, `<form>`, événements `on*`

### Preview live performance

- Pas de debounce sur les premiers 1000 caractères
- Si > 1000 chars : debounce 200ms
- Web Worker pour offloader le parsing si > 50 KB de contenu

### Variables `{{VAR}}` highlight

Dans l'éditeur, les variables non-remplies sont **highlightées en rouge** :

```markdown
Notre RC est {{COMPANY_RC}}.   ← {{COMPANY_RC}} en rouge si pas dans
                                  legal_template_vars
```

## Tooltip aide markdown

Bouton "?" dans l'éditeur ouvre un popover :

```
Syntaxe Markdown
─────────────────

## Titre (H2)        # un # = H1, ## = H2, etc.
**gras**             Entoure de **
*italique*           Entoure de *
[lien](url)          Texte entre [] + URL entre ()
- liste              - puis espace
> citation           > en début de ligne

Variables FemiGlow : {{COMPANY_RC}}, {{ICE}}, etc.
```

## Suivi

- CF.1, CUX.1 (cf. success-criteria.md)
