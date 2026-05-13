# Éditeur de templates HTML — spec UX & UI

> Module **M5.7** (à ajouter au plan). Permet à l'admin de créer/éditer
> des templates HTML personnalisés, les prévisualiser avec données
> mock ou réelles, et insérer des composants pré-stylés (CTA, dividers,
> sections). Tout conforme à la charte FemiGlow.

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Layout général](#layout-général)
- [Éditeur HTML](#éditeur-html)
- [Système de variables](#système-de-variables)
- [Bibliothèque de composants (CTA, dividers, sections)](#bibliothèque-de-composants)
- [Preview live](#preview-live)
- [Test send](#test-send)
- [Versionning](#versionning)
- [Catalogue de variables disponibles](#catalogue-de-variables-disponibles)

---

## Vue d'ensemble

### Objectif
Aller au-delà des templates React-Email codés en dur (`apps/web/src/lib/mail/templates/*.tsx`). Permettre à un admin **non-développeur** de :
1. Partir d'un template par défaut FemiGlow (`default-femiglow.html`)
2. Modifier le contenu textuel + structure HTML
3. Insérer des **variables** (`{{firstName}}`, `{{city}}`, `{{address}}`, etc.) qui se résolvent à l'envoi
4. Insérer des **composants** (CTA, dividers, deux colonnes, image card) sans coder
5. **Prévisualiser** le rendu final avec données mock OU données d'un vrai contact
6. **Envoyer un test** à son propre email pour vérifier rendering Gmail/Outlook/Apple Mail
7. Versionner les modifications (rollback possible)

### Périmètre V1
- Édition HTML (source + WYSIWYG sections-based)
- Variables clients (auto-mappées depuis `leads`, `orders`, `user_event`)
- Bibliothèque CTA + 6-8 composants pré-stylés
- Preview avec compteur de personnalisation
- Test send

### Hors V1
- Édition drag-drop totale (Mailchimp-like) — V2 si besoin
- A/B testing par template — V2
- Multi-langue (FR seul en V1)
- AI suggestions de copy — V3

---

## Layout général

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FemiGlow admin › Templates › Rituel-éclat-bienvenue          [Test send] [⋯]│
├──────────────────────────────────────┬─────────────────────────────────────┤
│                                      │                                     │
│  ╭─ Composants ─────────────╮         │  ╭─ Preview live ─────────────────╮ │
│  │ 🎀 Header logo            │         │  │ Variables : ▾ mock-1            │ │
│  │ 📝 Titre Cormorant        │         │  │ Resolved 7/7 ✓                  │ │
│  │ ⭐ Kicker en petits caps  │         │  │ ┌─────────────────────────────┐ │ │
│  │ 📐 Divider Fleuron        │         │  │ │                             │ │ │
│  │ 🔘 CTA principal sauge    │         │  │ │   [iframe sandboxed render] │ │ │
│  │ 🔗 CTA secondaire ghost   │         │  │ │                             │ │ │
│  │ 🖼 Image card 4:3         │         │  │ │                             │ │ │
│  │ 📰 Deux colonnes          │         │  │ └─────────────────────────────┘ │ │
│  │ 📦 Encadré stone-50       │         │  │ [Desktop] [Mobile] [Outlook]    │ │
│  │ 💌 Signature              │         │  ╰─────────────────────────────────╯ │
│  │ 🦶 Footer standard        │         │                                     │
│  ╰─ Snippets persos (3) ─────╯         │  ╭─ Variables utilisées ──────────╮ │
│                                       │  │ ✓ firstName    "Fatima"          │ │
│  ╭─ Variables ──────────────╮         │  │ ✓ orderId      "FG-2026-0042"    │ │
│  │ 🧍 Identité               │         │  │ ✓ orderTotal   "780 MAD"         │ │
│  │  • firstName             │         │  │ ⚠ city         (vide → fallback) │ │
│  │  • lastName              │         │  │ ✓ resumeUrl    "https://…"       │ │
│  │  • email                 │         │  │ + Détecter automatiquement       │ │
│  │  • city                  │         │  ╰──────────────────────────────────╯ │
│  │  • address               │         │                                     │
│  │ 🛒 Commerce               │         │                                     │
│  │  • orderId               │         │                                     │
│  │  • orderTotal            │         │                                     │
│  │  • lastOrderDate         │         │                                     │
│  │ 📦 Produit                │         │                                     │
│  │  • productName           │         │                                     │
│  │  • productPrice          │         │                                     │
│  │ 📅 Date/temps             │         │                                     │
│  │  • today                 │         │                                     │
│  │  • dayOfWeek             │         │                                     │
│  │ 🔗 URLs                   │         │                                     │
│  │  • resumeUrl             │         │                                     │
│  │  • unsubscribeUrl        │         │                                     │
│  │  • shopUrl               │         │                                     │
│  ╰──────────────────────────╯         │                                     │
│                                      │                                     │
└──────────────────────────────────────┴─────────────────────────────────────┘

[Vue Source HTML / Vue Sections ▾]
```

### 3 panneaux
- **Gauche** : Composants + Variables (drag/click to insert)
- **Centre** : Éditeur (texte HTML source ou builder sections)
- **Droite** : Preview live + état des variables

Toggle haut-droite : `Source` (Monaco editor) / `Sections` (block builder).

---

## Éditeur HTML

### Mode 1 — Vue Sections (default, novice friendly)

L'admin voit des **blocs visuels** correspondant chacun à une section
HTML pré-stylée. Click sur un bloc → édite le contenu via formulaire.
Ne modifie jamais le HTML brut.

```
┌────────────────────────────────────────────────────────┐
│ [🎀 Header — logo FemiGlow + tagline]       [↑] [↓] [✕] │
├────────────────────────────────────────────────────────┤
│ [📝 Titre]                                  [↑] [↓] [✕] │
│  Texte: "Merci {{firstName}}, ta commande est ..."     │
│  Style: H1 Cormorant 32px                              │
├────────────────────────────────────────────────────────┤
│ [📦 Encadré récap]                          [↑] [↓] [✕] │
│  Contenu : Order #{{orderId}}, Total {{orderTotal}}    │
├────────────────────────────────────────────────────────┤
│ [🔘 CTA "Suivre ma commande →"]            [↑] [↓] [✕] │
│  Texte: "Suivre ma commande"                            │
│  URL:   "{{trackingUrl}}"                              │
│  Style: Sauge primaire                                  │
└────────────────────────────────────────────────────────┘
[+ Insérer un composant ▾]
```

### Mode 2 — Source HTML

Monaco editor (l'éditeur de VS Code, déjà utilisé pour la config). Syntax highlight HTML.

- Auto-completion sur les variables : taper `{{` propose la liste
- Auto-completion sur les classes Tailwind si utilisées
- Linter inline : balises mal fermées, variables inconnues
- Reformat (Prettier) à la sauvegarde
- Save Ctrl+S

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&family=Pinyon+Script&display=swap" rel="stylesheet">
  <style>
    /* Inline tokens... */
  </style>
</head>
<body style="margin:0;background:#FBF8F1;font-family:Inter,sans-serif;">
  <table role="presentation" style="width:100%;background:#FBF8F1;">
    <tr><td align="center">
      <table role="presentation" style="width:600px;max-width:600px;background:#FFFFFF;">
        <tr><td>
          <!-- Header -->
          <table role="presentation" width="100%">
            <tr><td align="center" style="padding:32px;">
              <span style="font-family:'Pinyon Script',cursive;font-size:42px;color:#2C2A28;">FemiGlow</span>
              <p style="font-family:Inter;font-size:11px;letter-spacing:0.18em;color:#7C7A75;text-transform:uppercase;margin-top:8px;">Rituels conscients · Maroc</p>
            </td></tr>
          </table>
          ...
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

### Toggle Sections ↔ Source

Si l'admin passe en source, modifie, et retourne en sections : on essaie de re-parser. Si parse OK → sections détectées. Sinon → warning "Le HTML a été modifié hors structure FemiGlow, l'éditeur sections n'est plus disponible. Continue en source uniquement, ou Reset au template par défaut."

---

## Système de variables

### Syntaxe

```
{{variableName}}              # simple substitution
{{variableName | fallback}}   # avec fallback si vide
{{#if variableName}}...{{/if}} # conditionnel
{{#each items}}...{{/each}}   # boucle (V2)
```

Implémentation : **Handlebars** (déjà utilisé pour les templates
existants `lib/mail/render.ts`).

### Résolution

Au moment de l'envoi (ou du preview) :
1. Chargement du **contexte** depuis :
   - `leads` (firstName, lastName, email, city, address, phone, country, language)
   - `orders` agrégé (lastOrderId, lastOrderDate, totalSpent, orderCount)
   - `user_event` agrégé (lastActivityAt, sessionCount, productsViewed)
   - Trigger payload (si automation : `trigger.*`)
   - URLs auto (unsubscribeUrl, shopUrl, resumeUrl)
   - Dates système (today, tomorrow, dayOfWeek)
   - Custom variables (passées par le caller)
2. Substitution Handlebars
3. Sanitization HTML (escape par défaut, sauf `{{{html}}}`)

### Fallbacks

Chaque variable a un **fallback configurable** par template :
- `{{firstName | "cliente"}}` → "Bonjour cliente," si pas de firstName
- `{{city | "Maroc"}}` → "Maroc" si city absent

UI affiche les fallbacks dans le panneau Variables.

### Détection automatique

L'éditeur scanne le HTML pour trouver les `{{...}}` et alimente le panneau "Variables utilisées" à droite avec :
- ✓ variable connue + sample value
- ⚠ variable inconnue (typo ?) → suggestion d'auto-complete
- ⚠ variable connue mais valeur absente pour la mock data → fallback affiché

### Indicateur de personnalisation

Score % en haut de l'éditeur :
- 0 variables : "Statique"
- 1-2 variables : "Basique"
- 3+ variables : "Personnalisé"
- 7+ variables : "Hautement personnalisé ✨"

Pas une métrique business, juste un nudge visuel.

---

## Bibliothèque de composants

Composants pré-stylés conformes à la charte FemiGlow. Click → insertion dans l'éditeur (sections) ou copy snippet HTML.

### 🎀 Header (always at top)
```html
<table role="presentation" width="100%">
  <tr><td align="center" style="padding:40px 32px 24px;">
    <span style="font-family:'Pinyon Script',cursive;font-size:42px;color:#2C2A28;line-height:1;">FemiGlow</span>
    <p style="font-family:Inter,sans-serif;font-size:11px;letter-spacing:0.18em;color:#7C7A75;text-transform:uppercase;margin:12px 0 0;">Rituels conscients · Maroc</p>
  </td></tr>
</table>
```

### ⭐ Kicker (petite étiquette caps)
```html
<p style="font-family:Inter,sans-serif;font-size:11px;letter-spacing:0.18em;color:#4F6D52;text-transform:uppercase;margin:0 0 8px;">
  {{kickerText}}
</p>
```

### 📝 Titre Cormorant (H1/H2)
```html
<h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:32px;line-height:1.25;color:#2C2A28;margin:0 0 16px;">
  {{titleText}}
</h1>
```

### 📐 Divider Fleuron champagne
```html
<table role="presentation" align="center" style="margin:32px auto;">
  <tr>
    <td style="border-top:1px solid #C8A876;width:64px;height:1px;"></td>
    <td style="padding:0 8px;color:#C8A876;font-size:14px;">◆</td>
    <td style="border-top:1px solid #C8A876;width:64px;height:1px;"></td>
  </tr>
</table>
```

### 🔘 CTA principal sauge
```html
<table role="presentation" align="center" style="margin:24px auto;">
  <tr><td align="center" bgcolor="#7C9A8A" style="border-radius:6px;">
    <a href="{{ctaUrl}}" 
       style="display:inline-block;padding:14px 28px;font-family:Inter,sans-serif;font-size:14px;font-weight:500;color:#FBF8F1;text-decoration:none;letter-spacing:0.02em;">
      {{ctaLabel}} &nbsp;&rarr;
    </a>
  </td></tr>
</table>
```

### 🔗 CTA secondaire ghost
```html
<p style="text-align:center;margin:16px 0;">
  <a href="{{linkUrl}}" 
     style="font-family:Inter,sans-serif;font-size:14px;color:#4F6D52;text-decoration:underline;text-underline-offset:3px;">
    {{linkLabel}}
  </a>
</p>
```

### 🖼 Image card 4:3
```html
<table role="presentation" width="100%">
  <tr><td align="center" style="padding:0 32px;">
    <img src="{{imageUrl}}" alt="{{imageAlt}}" width="536" 
         style="display:block;width:100%;max-width:536px;height:auto;border-radius:4px;">
  </td></tr>
</table>
```

### 📰 Deux colonnes (mobile-stackable)
```html
<table role="presentation" width="100%">
  <tr>
    <td valign="top" style="width:50%;padding:16px;font-family:Inter,sans-serif;font-size:14px;line-height:1.6;color:#4A4744;">
      {{leftContent}}
    </td>
    <td valign="top" style="width:50%;padding:16px;font-family:Inter,sans-serif;font-size:14px;line-height:1.6;color:#4A4744;">
      {{rightContent}}
    </td>
  </tr>
</table>
```

### 📦 Encadré stone-50 (récap, notes)
```html
<table role="presentation" width="100%" style="margin:16px 0;">
  <tr><td style="background:#F5F5F4;border:1px solid #E7E5E4;border-radius:6px;padding:20px;font-family:Inter,sans-serif;font-size:14px;color:#44403C;line-height:1.6;">
    {{boxContent}}
  </td></tr>
</table>
```

### 💌 Signature
```html
<p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:18px;color:#2C2A28;margin:32px 0 8px;">
  Avec soin,
</p>
<p style="font-family:Inter,sans-serif;font-size:14px;color:#4A4744;margin:0;">
  — La maison FemiGlow
</p>
```

### 🦶 Footer standard
```html
<table role="presentation" width="100%" style="background:#FBF8F1;margin-top:32px;">
  <tr><td align="center" style="padding:32px 24px;font-family:Inter,sans-serif;font-size:12px;color:#7C7A75;line-height:1.7;">
    <p style="margin:0 0 8px;">FemiGlow — Rabat, Maroc</p>
    <p style="margin:0;">
      <a href="{{unsubscribeUrl}}" style="color:#7C7A75;text-decoration:underline;">Se désinscrire</a>
      &nbsp;·&nbsp;
      <a href="https://femiglow-maroc.com/mentions-legales" style="color:#7C7A75;text-decoration:underline;">Mentions légales</a>
    </p>
  </td></tr>
</table>
```

---

## Preview live

### Iframe sandboxed
- iframe avec `sandbox="allow-same-origin"` (pas de scripts)
- src généré via blob URL avec le HTML rendu (Handlebars résolu)
- max-width 800px desktop, simulateur mobile (375px)

### Modes de preview

| Mode | Effet |
|---|---|
| Desktop | width 600px (taille réelle email) sur fond stone-50 |
| Mobile | width 375px, viewport iPhone |
| Outlook | applique les fallbacks Outlook (gif → png fallback, web fonts → fallback stack) |
| Dark mode | invert colors si le client email le fait (Gmail iOS) |

### Données du preview

Toggle "Variables : ▾" choisit entre :
- **Mock 1** : Fatima Lahlou, Casablanca, fictive
- **Mock 2** : Hicham Tazi, Marrakech
- **Mock 3** : (admin custom)
- **Vrai contact** : sélectionner un lead réel (autocomplete) → utilise ses vraies données

> ⚠ Sécurité : la sélection d'un vrai contact pour preview est tracée
> dans `admin_audit_log` (pour RGPD).

### Indicateurs

En haut du preview :
- ✓ Tous résolus
- ⚠ N variables non résolues (clic → highlight in editor)
- 📐 Largeur 600px ✓ / ⚠ trop large
- ⏱ Estimated render time : 32ms (taille HTML)

---

## Test send

Bouton "Test send" en haut à droite. Action :

1. Modal :
   ```
   ┌────────────────────────────────────────┐
   │  Envoyer un email de test              │
   ├────────────────────────────────────────┤
   │  Destinataire                          │
   │  [admin@femiglow-maroc.com ▾]          │
   │                                        │
   │  Variables utilisées                   │
   │  ( ) Mock 1 (Fatima, Casablanca)       │
   │  (•) Mock 2 (Hicham, Marrakech)        │
   │  ( ) Vrai contact: [autocomplete]      │
   │                                        │
   │  ⚠ Cet email part vraiment via SMTP.   │
   ├────────────────────────────────────────┤
   │              [Annuler] [Envoyer le test]│
   └────────────────────────────────────────┘
   ```

2. Backend :
   - Render template avec contexte choisi
   - sendTransactional() avec source=`admin.template-test`
   - idempotencyKey=`test-{templateId}-{timestamp}` (toujours différent → envoi forcé)
   - Toast "Test envoyé à admin@…"

3. Pas de comptage en stats marketing (source=admin.template-test exclut)

---

## Versionning

### Versionning automatique

Chaque sauvegarde crée une **version** dans `email_template_version` (nouvelle table M5.7). Champs :
- `template_id`, `version_number` (auto-incrémenté)
- `html_source`
- `created_at`, `created_by`
- `commit_message` (optionnel, l'admin peut écrire un message)

### Diff & rollback

Page "Historique" du template :
```
v12 (actuel)  · 13/05 22:00 · elazhar@…   "Ajout CTA secondaire"
v11           · 13/05 18:30 · elazhar@…   "Update copy header"
v10           · 12/05 14:00 · elazhar@…
...

[Voir diff v11 ↔ v12]   [Rollback à v11]
```

Diff = side-by-side text diff (lib `diff` ou `monaco-diff-editor`).

### Active version

Une seule version est `is_active=true`. Le rollback consiste à toggler.
L'historique reste intact.

---

## Catalogue de variables disponibles

### 🧍 Identité (depuis `leads`)

| Variable | Source | Exemple | Fallback proposé |
|---|---|---|---|
| `firstName` | `leads.first_name` ou parsing de `leads.name` | "Fatima" | "cliente" |
| `lastName` | `leads.last_name` | "Lahlou" | "" |
| `fullName` | concat | "Fatima Lahlou" | `firstName` |
| `email` | `leads.email` | "fatima@…" | – (toujours présent) |
| `phone` | `leads.phone` | "+212 6 12 34 56 78" | "—" |
| `city` | `leads.city` | "Casablanca" | "Maroc" |
| `address` | `leads.address` | "12 rue X" | "" |
| `country` | `leads.country` | "MA" | "MA" |
| `language` | `leads.language` | "fr" | "fr" |
| `gender` | `leads.gender` | "f" | "" |
| `createdAt` | `leads.created_at` | "13 mai 2026" | – |

### 🛒 Commerce (agrégé depuis `orders`)

| Variable | Description | Exemple | Fallback |
|---|---|---|---|
| `lastOrderId` | ID dernière commande | "FG-2026-0042" | "—" |
| `lastOrderDate` | Date dernière commande (formatted) | "13 mai 2026" | "" |
| `lastOrderTotal` | Total dernière commande | "780 MAD" | "0 MAD" |
| `orderCount` | Nombre total commandes | "3" | "0" |
| `totalSpent` | Total cumulé toutes commandes | "2 340 MAD" | "0 MAD" |
| `daysSinceLastOrder` | Nombre de jours | "12" | "—" |
| `lastOrderItems` | Liste items (HTML) | "Rituel éclat · Kit complet" | "" |

### 📦 Produit (contexte commande / cart-abandoned)

| Variable | Description |
|---|---|
| `productName` | "Rituel éclat" |
| `productPrice` | "780 MAD" |
| `productImageUrl` | URL absolue image |
| `productUrl` | URL page produit |
| `cartItemsCount` | "3" |
| `cartTotal` | "1 240 MAD" |

### 📅 Date / temps

| Variable | Exemple |
|---|---|
| `today` | "13 mai 2026" |
| `tomorrow` | "14 mai 2026" |
| `dayOfWeek` | "Mercredi" |
| `currentMonth` | "Mai" |
| `currentSeason` | "Printemps" |
| `currentYear` | "2026" |

### 🔗 URLs

| Variable | Description |
|---|---|
| `unsubscribeUrl` | URL one-click unsubscribe (RFC 8058, signed token) |
| `shopUrl` | "https://femiglow-maroc.com/rituel" |
| `accountUrl` | "https://femiglow-maroc.com/compte" |
| `trackingUrl` | URL suivi commande |
| `resumeUrl` | URL reprise panier (si applicable) |
| `confirmUrl` | URL confirmation double opt-in |

### 🎯 Trigger (automations seulement)

| Variable | Description |
|---|---|
| `trigger.eventName` | "cart.abandoned" |
| `trigger.ts` | Timestamp |
| `trigger.properties.*` | Toutes les propriétés du payload event |

Exemple : `{{trigger.properties.cartTotal}}` dans une automation `cart.abandoned`.

### 🏷 Tags & segments

| Variable | Description |
|---|---|
| `hasTag.cart_lost` | true/false |
| `hasTag.vip` | true/false |
| `inAudience.{slug}` | true/false |

### Variables custom

L'admin peut définir ses variables custom au niveau du template :
```
Variables custom :
  promoCode : "ECLAT10"
  promoExpiry : "31 mai 2026"
```

Utilisable comme `{{promoCode}}`. Stockées dans `email_template.custom_vars` (jsonb).

---

## Accessibilité du template

L'éditeur garantit :
- Alt text obligatoire sur `<img>` (avertissement si vide)
- Contraste min 4.5:1 sur tous les textes
- `<a>` ont du texte (pas image-only)
- Pas de tracking pixel invisible sans déclaration (RGPD)
- Lang attribute (`<html lang="fr">`)

Lint inline affiche les violations en marge.

---

## Workflow type — créer un nouveau template

```
1. /admin/emails/templates → "+ Nouveau template"
2. Modale "Choisir un point de départ" :
   • [ Template vide ]
   • [ Default FemiGlow ] (recommandé)
   • [ Contact ack ] (basé sur l'existant)
   • [ Order confirm ] etc.
3. Éditeur s'ouvre avec template pré-chargé
4. Modifier copy, ajouter CTA, etc.
5. Preview avec mock data → vérifier rendu
6. Test send → vérifier sur Gmail réel
7. Save (crée v1)
8. Le template apparaît dans le wizard campaign / automation
```

---

## API endpoints

| Méthode | Path | Description |
|---|---|---|
| GET | `/api/admin/emails/templates` | List |
| POST | `/api/admin/emails/templates` | Create |
| GET | `/api/admin/emails/templates/[slug]` | Get latest active |
| GET | `/api/admin/emails/templates/[slug]/versions` | History |
| POST | `/api/admin/emails/templates/[slug]/versions` | New version (save) |
| POST | `/api/admin/emails/templates/[slug]/activate/[v]` | Rollback to v |
| POST | `/api/admin/emails/templates/[slug]/preview` | Render avec context |
| POST | `/api/admin/emails/templates/[slug]/test-send` | Envoyer test |
| GET | `/api/admin/emails/templates/variables-catalog` | Variables disponibles |

---

## Implémentation tech (résumé)

- **Lib éditeur** : Monaco (déjà dans le bundle pour autre fonctionnalité) ou CodeMirror si plus léger
- **Lib templating** : Handlebars (déjà utilisé, `lib/mail/render.ts`)
- **Lib sanitization** : DOMPurify (côté serveur on parse en jsdom)
- **Preview** : génération HTML server-side, blob URL côté client
- **Diff** : `diff-match-patch` ou Monaco diff editor

Voir [02-backend/07-templates-engine.md](../02-backend/07-templates-engine.md) pour la spec backend.
