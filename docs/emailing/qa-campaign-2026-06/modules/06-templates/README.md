# Module 06 — Templates (`/admin/emails/templates`)

> Périmètre : catalogue de templates (transactionnels React + customs HTML),
> éditeur custom (Handlebars + sanitize), versioning, preview serveur, rendu
> transactionnel des 6 templates React, starters, lien de désinscription.
> Inventaire : **F-060 → F-065**.

---

## 1. Fonctionnement optimal (état cible)

### 1.1 Deux familles de templates

1. **Transactionnels React** (`lib/mail/templates/*.tsx`) — 6 composants
   `@react-email`, payload validé par Zod, déclarés dans `catalog.ts` :
   `contact-acknowledgement`, `order-confirmation`, `newsletter-confirm`,
   `lead-notification`, `password-reset`, `cart-abandoned`.
2. **Customs HTML** (`lib/mail/templates/custom/**`) — éditables par l'opérateur,
   moteur **Handlebars** + **sanitize DOMPurify**, versionnés en DB
   (`email_template_custom[_version]`).

### 1.2 Pipeline de rendu transactionnel — `render.ts`

`renderTemplate(slug, payload)` :
1. `isKnownTemplate(slug)` sinon throw.
2. `meta.schema.parse(payload)` — **validation Zod**.
3. `createElement(meta.component, parsed)` → `@react-email/render` → HTML inline.
4. `htmlToText(html)` → version texte.
5. `subjectFn`/`preheaderFn`.

**État cible critique (écart A-TPL-1)** : la validation Zod + le rendu doivent se
faire **avant** l'INSERT outbox de façon que tout échec soit **tracé** (ligne
outbox `failed` ou évènement), jamais un email perdu silencieusement.

### 1.3 Pipeline de rendu custom — `custom/render.ts`

`renderTemplate({subjectTmpl, preheaderTmpl, htmlSource}, context)` :
1. `Handlebars.compile` (cache LRU 50) — `{{var}}` échappe par défaut,
   `{{{var}}}` bypass.
2. Rendu sujet/preheader/HTML.
3. **`sanitizeEmailHtml(htmlRaw)`** — DOMPurify, whitelist tags/attrs, retire
   `script`, `iframe`, `object`, handlers `on*`, `javascript:`…

### 1.4 Sanitize — `custom/sanitize.ts`

DOMPurify configuré : `ALLOWED_TAGS` (table, p, a, img, strong…), `ALLOWED_ATTR`
(style, href, src, alt…), `ALLOW_DATA_ATTR: false`, `WHOLE_DOCUMENT: true`.
**Surface XSS** (écart A-TPL-2) : c'est la dernière barrière avant l'envoi → doit
résister à une batterie hostile complète.

### 1.5 Éditeur — `TemplateEditor.tsx`

Split view source | preview iframe (`sandbox="allow-same-origin"`), preview
debouncée (600 ms) via `POST .../preview`, versioning (création de version +
restauration avec confirmation), insertion de variables, validation customVars
JSON, état `isDirty`.

### 1.6 Lien de désinscription — `_shared/Footer.tsx`, `context-resolver.ts`

Les templates transactionnels contiennent `href="{{unsubscribe_url}}"` (littéral),
substitué dans le pipeline d'envoi par une URL **signée**. Écart A-TPL-3 : si le
secret de signature manque, un `catch{}` vide peut laisser `{{unsubscribe_url}}`
**littéral** dans l'email envoyé → lien mort + non-conformité CNDP/RGPD.

---

## 2. Fichiers sources concernés

| Domaine | Fichier |
|---------|---------|
| Catalogue | `apps/web/src/lib/mail/catalog.ts` |
| Rendu transactionnel | `apps/web/src/lib/mail/render.ts` |
| Templates React (6) | `apps/web/src/lib/mail/templates/*.tsx` |
| Layout partagé / footer | `apps/web/src/lib/mail/templates/_shared/{BaseLayout,Header,Footer}.tsx` |
| Rendu custom | `apps/web/src/lib/mail/templates/custom/render.ts` |
| Sanitize | `apps/web/src/lib/mail/templates/custom/sanitize.ts` |
| Context resolver | `apps/web/src/lib/mail/templates/custom/context-resolver.ts` |
| Schémas | `apps/web/src/lib/mail/templates/custom/schemas.ts` |
| Éditeur UI | `apps/web/src/components/admin/emails/templates/TemplateEditor.tsx` |
| API | `apps/web/src/app/api/admin/emails/templates/**` (preview, versions, starters) |
| Starter | `apps/web/src/lib/mail/templates/starters/default-femiglow.html` |

---

## 3. Écarts d'audit ciblés

| Réf | Défaut constaté | Test garde-fou |
|-----|-----------------|----------------|
| **A-TPL-1** | Rendu Zod **avant INSERT outbox** : un payload invalide fait échouer le rendu → email perdu sans trace. | Tests rendu : chaque template avec payload invalide → `renderTemplate` throw (à transformer côté pipeline en ligne outbox `failed` traçable). |
| **A-TPL-2** | `sanitize` = surface XSS : doit neutraliser TOUTE charge hostile. | `sanitize-hostile.test.ts` table-driven : script, onerror, javascript:, data:, svg, style expression, entités, etc. |
| **A-TPL-3** | `{{unsubscribe_url}}` **littéral** possible (catch vide si secret manquant). | Test : le footer rendu contient un placeholder/URL, jamais `{{unsubscribe_url}}` non substitué dans l'email final ; lien toujours présent. |
| **A-TPL-4** | `password-reset` **jamais câblé** (aucun call-site). | Test : le template rend correctement (prêt à câbler) + note inventaire F-097. |
| **A-TPL-5** | Preview : comportement sur variable manquante / HTML hostile à vérifier. | Tests preview : variable manquante → vide (pas de crash) ; HTML hostile → sanitizé. |

---

## 4. Couverture & livrables

- `test-matrix.csv` — ≥ 40 lignes (éditeur, versioning, preview, sanitize XSS,
  rendu transactionnel des 6, starters, unsubscribe).
- `scenarios-metier.md` — 3 scénarios bout-en-bout.
- `test-plan.yaml` — suites machine-lisibles.
- `pipeline-rendu.puml` — pipeline de rendu (transactionnel + custom).
- `specs/sanitize-hostile.test.ts` — table-driven XSS.
- `specs/template-editor.msw.test.tsx` — composant + MSW (preview, versions).
