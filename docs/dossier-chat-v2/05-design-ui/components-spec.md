# Components Spec — États, variantes, comportement visuel

> Spécification chaque composant UI : ses props, états (rest/hover/focus/active/disabled/loading/error), variantes, et règles d'utilisation.

## ChatLauncher

### Aspect

- Bouton flottant, position : `bottom-right` LTR / `bottom-left` RTL.
- Distance bord : `24px` desktop, `16px` mobile.
- Forme : cercle parfait, dimensions `56px` desktop, `52px` mobile.
- Fond : gradient `linear-gradient(135deg, primary.600 → accent.500)`.
- Ombre : `shadow.xl`.
- Icône : `MessageCircle` Lucide, `28px`, `neutral.0`.
- Badge unread : pastille `accent.500`, top-right, `min 18×18 px`, texte blanc `xs/bold`.

### États

| État | Variation |
|---|---|
| Rest | Gradient + shadow.xl |
| Hover | scale(1.05), shadow.2xl, transition 150ms |
| Focus-visible | + ring primary.600 (shadow.ringSoft) |
| Active (pressed) | scale(0.95) |
| Disabled | opacity(0.5), pointer-events: none (rare, ex. consent refused) |
| Pulse (unread) | scale 1 → 1.05 → 1, 3s infinite |

### A11y

- `aria-label="Ouvrir le chat FemiGlow"`
- Si unread : `aria-label="Ouvrir le chat — 3 messages non lus"`
- `role="button"`, `tabindex="0"`

## ChatPanel

### Aspect

- Mobile (< 768px) : sheet plein-écran avec margin-top 8vh, `border-radius-top: 28px`, drag-handle subtil.
- Desktop : modal positionnée `bottom-right` `24px`, dim `400×640`, `radius.2xl`.
- Fond : `surface.background` (#fff).
- Bordure : `1px neutral.200`.
- Ombre : `shadow.2xl` (#6B46C1 alpha).

### Sections internes

```
┌─────────────────────────────────┐
│  HEADER (avatar + nom + close)  │ 56px
├─────────────────────────────────┤
│                                 │
│  MESSAGE LIST (scroll)          │ flex-1
│                                 │
├─────────────────────────────────┤
│  SUGGESTION PILLS               │ conditional, 56px
├─────────────────────────────────┤
│  COMPOSER (textarea + send)     │ min 56px
└─────────────────────────────────┘
```

### États

- Open / Closed (gestion par parent, AnimatePresence).
- Loading (skeleton header + dots dans liste).
- ConsentRequired (overlay banner sur toute la surface).
- ErrorRecovery (toast top + UI dégradée).

## ChatHeader

### Aspect

- Hauteur : `56px`.
- Background : gradient horizontal `primary.700 → primary.600`.
- Texte titre : "FemiGlow Assistant" en `text-base/semibold`, blanc.
- Avatar : cercle `36px`, `accent.300`, initiales "FG" en center.
- Status pill : couleur selon serviceLevel (vert nominal, jaune dégradé, rouge canned).
- Close button : right (LTR), `icon-only`, `aria-label="Fermer"`.

### Variantes

| serviceLevel | Pill texte | Pill couleur |
|---|---|---|
| 0 (nominal) | "En ligne" | success.500 |
| 1 (failover) | "En ligne" | success.500 (transparent backend) |
| 2 (RAG-only) | "En ligne" | warning.500 |
| 3 (canned-only) | "Réponses pré-écrites" | warning.500 |
| 4 (static) | "Service réduit" | error.500 |

## MessageBubble

### User bubble

- Alignement : right (LTR) / left (RTL).
- Background : `surface.bubbleUser` (primary.600).
- Texte : `neutral.0`, `text-base/regular`.
- Max-width : `78%`.
- Padding : `10px 14px`.
- Radius : `2xl` mais coin `bottom-right` (LTR) à `4px` (effet "queue").

### Assistant bubble (LLM)

- Alignement : left (LTR) / right (RTL).
- Background : `surface.bubbleAssistant` (neutral.50).
- Texte : `neutral.900`.
- Max-width : `92%`.
- Padding : `12px 16px`.
- Radius : `2xl` mais coin `bottom-left` (LTR) à `4px`.
- Markdown : `react-markdown` + sanitization (DOMPurify), tableau OK, liste OK, lien externe `target="_blank" rel="noopener"`.

### Assistant bubble (canned)

- Idem assistant LLM mais :
  - Background : `surface.bubbleCanned` (accent.50).
  - Bordure : `1px accent.200`.
  - Si CTA présent → bouton inline en bas de bulle (voir CtaButton).

### Streaming caret

- Caractère `▍` blink 1s infinite.
- Position : après le dernier mot.
- Disparait quand `status === 'completed'`.

### Sources Popover

- Si `meta.sources.length > 0` : sous la bulle assistant, icône `Link` (12px) + texte `"3 sources"` cliquable.
- Au click → popover (Headless UI) avec liste sources (label + url).

### Tool Badge

- Si `meta.toolsUsed.length > 0` : sous la bulle assistant, ligne `"🔧 Vérifications : livraison, prix"`.
- Style : `text-xs/regular`, `neutral.500`.

### Feedback (thumbs)

- Apparait sous bulles `role: 'assistant'` et `status: 'completed'`.
- 2 icônes : `ThumbsUp` et `ThumbsDown`, `20px`, `neutral.400`.
- Hover → `neutral.600`.
- Click → `primary.600` (activated) avec wiggle animation.
- Si rating donné, l'autre disparait (impossible de double-vote).

## SuggestionPills

### Container

- Position : juste au-dessus du composer.
- Layout : `flex-wrap`, gap `8px`, horizontal scroll si overflow (>3 pills).
- Padding container : `12px 16px`.

### Pill (atomic)

- Forme : `radius.full`, `padding 8px 14px`.
- Background : `pill.bg` (neutral.0).
- Bordure : `1px pill.border`.
- Texte : `text-sm/medium`, `neutral.800`.
- Hauteur min : `44px` (touch target).

### États pill

| État | Background | Bordure | Transform |
|---|---|---|---|
| Rest | neutral.0 | neutral.200 | — |
| Hover | primary.50 | primary.200 | scale(1.03) |
| Focus | neutral.0 | primary.600 | + ring |
| Active | primary.100 | primary.300 | scale(0.97) |
| Loading (after click) | primary.50 | primary.200 | spinner 12px à gauche |
| Disabled | neutral.50 | neutral.100 | opacity(0.5) |

### Variantes (futur)

- Pill avec emoji prefix : `🎁 Voir le Pack` (emoji 16px, marge 6px).
- Pill "urgence" : background `accent.50`, bordure `accent.300`, pour CTAs critiques.

## Composer

### Aspect

- Container : `flex`, `gap 8px`, `padding 8px 12px`, fond `neutral.0`, bordure top `neutral.200`.
- Textarea : autosize 1 → 5 lignes, `flex-1`, sans bordure, `placeholder: t('composer.placeholder')`, `inputmode="text"`.
- Send button : icon-only `Send` (Lucide), `40×40 px`, `radius.full`, `primary.600` background, `neutral.0` icon.
- Disabled si `text.length === 0` ou `isStreaming`.

### États send button

| État | Background | Icon | Cursor |
|---|---|---|---|
| Disabled | neutral.200 | neutral.400 | not-allowed |
| Enabled rest | primary.600 | neutral.0 | pointer |
| Enabled hover | primary.700 | neutral.0 | pointer |
| Loading (streaming) | primary.500 | Loader2 spinning | not-allowed |

### Hint

- Sous le composer (xs/regular, neutral.500) : "Entrée pour envoyer · Maj+Entrée pour saut de ligne".
- Masqué sur mobile (économie d'espace).

## LeadForm

### Aspect

- Inline dans la conversation, après bulle assistant.
- Container : `radius.lg`, fond `primary.50`, bordure `1px primary.200`, padding `16px`.
- Header : "Soyez rappelée" en `text-base/semibold`.
- 3 inputs : Nom (optionnel), Téléphone (required), Ville (optionnel).
- Submit button : full-width, primary.600, `radius.lg`, hauteur `48px`.

### États

- Idle : champs vides ou pré-remplis.
- Validating : bordure de l'input erroné `error.500`, message erreur xs/regular `error.700`.
- Submitting : button avec spinner, disabled all fields.
- Success : checkmark animé, message "Merci !", auto-fermeture après 3s.

### Variantes

- Lead provider-down : ajoute message d'introduction "Notre assistant rencontre une difficulté, laissez-nous vos coordonnées..."
- Lead B2B : ajoute champ "Type d'établissement" (select).

## CtaButton (inline dans bulle canned)

### Aspect

- Bouton compact `padding 8px 16px`, `radius.lg`.
- Background : `primary.600`.
- Texte : `neutral.0`, `text-sm/semibold`.
- Icône optionnelle (right-arrow).
- Hover : `primary.700` + translateX 2px.

## TypingDots

### Aspect

- 3 cercles `8×8 px`, fond `neutral.400`.
- Gap : `4px`.
- Animation : translateY + opacity (voir animations.hjson).
- Container : pris dans une bulle assistant placeholder (mêmes dimensions).

## ToastServiceLevel

### Aspect

- Position : top du panel chat (pas top de la page).
- Background : `warning.50` (si sl=2/3), `error.50` (si sl=4).
- Bordure-left : `4px solid warning.500` / `error.500`.
- Texte : `text-sm/regular`, `warning.700` / `error.700`.
- Auto-hide : 5 s, ou close-icon manuel.

## SourcesPopover

### Aspect

- Popover à droite du link (LTR) / gauche (RTL).
- `radius.lg`, `shadow.lg`, fond `neutral.0`, bordure `1px neutral.200`.
- Header : "Sources" en `text-sm/semibold`.
- Liste : chaque ligne = source avec icône (📄 interne, 🌐 externe), label cliquable.
- Footer : "Fermer" lien xs.

## Admin chat manager (overview)

L'admin n'utilise pas les mêmes composants visuels (pas de bulle), mais les **mêmes tokens** :
- Couleur primary.600 pour CTAs.
- Inputs avec radius.md.
- Cards `radius.xl` + shadow.sm.
- Headers gradient primary.700 → primary.600 sur les pages.

Voir [`wireframes-admin.md`](wireframes-admin.md) pour les écrans.

## Storybook

Chaque composant a une story dédiée :
- `components/chat/__stories__/launcher.stories.tsx`
- ...

Stories couvrent : default, hover, focus, active, disabled, loading, error, LTR/RTL, FR/AR/AR-MA, mobile/desktop.

## Audit visuel — checklist par composant

- [ ] Contraste vérifié (Stark plugin Figma + axe runtime).
- [ ] Tous les états ont une story Storybook.
- [ ] Capture LTR + RTL fournie.
- [ ] Captures FR + AR + AR-MA.
- [ ] Hover/focus/active distinctement visibles.
- [ ] Pas de magic numbers (tout via tokens).
- [ ] Animation respecte `prefers-reduced-motion`.
