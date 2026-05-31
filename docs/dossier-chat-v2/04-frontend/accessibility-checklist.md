# Accessibilité — Checklist WCAG 2.1 AA exhaustive

> Cible : **WCAG 2.1 niveau AA**, conformité RGAA 4.1 française, support lecteurs d'écran (NVDA, VoiceOver, TalkBack), RTL natif. Tout audit échoué = bloquant ship.

## Périmètre

- Le chat (panel, launcher, leadform).
- L'admin manager (chat-v2 dans `/dashboard/chat-v2`).
- Les emails transactionnels (récap lead pour utilisateur si email fourni).

## Méthodes de test

| Test | Outil | Fréquence |
|---|---|---|
| Automatisé statique | `axe-core` via Playwright | À chaque PR |
| Audit clavier | Manuel, Tab/Shift+Tab/Enter/Esc | À chaque PR feature |
| Lecteur d'écran | NVDA (Windows), VoiceOver (Mac/iOS), TalkBack (Android) | À chaque sprint |
| Contraste | Stark plugin Figma + axe runtime | À chaque mise à jour design tokens |
| Zoom 200% | Manuel browser zoom | À chaque PR |
| Mode haute-contraste Windows | Manuel sur VM | À chaque release majeure |

## Checklist par critère WCAG

### 1.1 Alternatives textuelles

- [ ] Toutes les icônes décoratives → `aria-hidden="true"`.
- [ ] Toutes les icônes signifiantes → `aria-label` localisé (ex. bouton fermer : `aria-label={t('close')}`).
- [ ] Images de produits chargées dans le chat → `alt` descriptif (jamais "image", "photo").
- [ ] Avatars assistant → `alt="Assistant FemiGlow"`.

### 1.3 Adaptable

- [ ] Le chat fonctionne en CSS désactivé (DOM logique : header → messages → composer).
- [ ] `<main>`, `<nav>`, `<aside>` utilisés correctement dans le panel.
- [ ] Le composer a un `<label for="">` même s'il est visuellement masqué (`sr-only`).
- [ ] Les messages user/assistant sont `<article role="article">` (pas `<div>` sémantiquement vide).
- [ ] Les pills sont `<button type="button">`, pas `<div onClick>`.

### 1.4 Distinguable

- [ ] Contraste texte/fond ≥ 4.5:1 (texte normal) et ≥ 3:1 (texte large 18px+).
- [ ] Contraste contour bouton focus ≥ 3:1.
- [ ] Aucune info véhiculée uniquement par la couleur (ex. erreur = rouge **et** icône **et** texte "Erreur").
- [ ] Texte redimensionnable jusqu'à 200% sans perte fonctionnelle (pas de overflow caché).
- [ ] Pas de texte dans une image (sauf logo, allowed).

### 2.1 Accessible au clavier

- [ ] Tous les éléments interactifs atteignables via `Tab`.
- [ ] L'ordre de tabulation suit l'ordre visuel (DOM order = visual order).
- [ ] `Esc` ferme le panel chat (focus retourne au launcher).
- [ ] `Enter` dans le composer envoie ; `Shift+Enter` insère un newline.
- [ ] Les pills répondent à `Enter` et `Espace`.
- [ ] Pas de piège clavier (ouvrir popover et impossible d'en sortir).

### 2.4 Navigable

- [ ] Le launcher a un `aria-label` explicite : "Ouvrir le chat FemiGlow".
- [ ] Le panel ouvert a `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointant vers le header.
- [ ] Focus trap dans le panel quand ouvert (Headless UI Dialog s'en occupe).
- [ ] Focus visible avec un anneau de min 2px (utiliser `outline` natif si custom focus en panne).
- [ ] Lien "Skip to chat" caché (`sr-only`) si pertinent.

### 2.5 Modalités d'entrée

- [ ] Aire de touche bouton ≥ 44×44 px (cible iOS HIG / Material).
- [ ] Pas de gestes multi-doigts requis.
- [ ] Pas de geste path-based (drag complexe) sans alternative.

### 3.1 Lisible

- [ ] Attribut `lang` sur le panel : `lang="fr"`, `lang="ar"` ou `lang="ar-MA"`.
- [ ] Si message dans une langue différente du conteneur, `lang` sur le message.
- [ ] Vocabulaire évite jargon métier sans traduction.

### 3.2 Prévisible

- [ ] Le focus sur un input ne déclenche aucune action automatique non-attendue.
- [ ] Changer de langue ne soumet pas le composer.
- [ ] Les boutons n'ouvrent jamais de nouveau onglet sans prévenir.

### 3.3 Assistance à la saisie

- [ ] Le composer a un `aria-describedby` sur l'aide ("Touchez Entrée pour envoyer").
- [ ] Erreurs de validation lead form annoncées via `aria-live="polite"`.
- [ ] Le champ phone a `inputmode="tel"` + `autocomplete="tel"` + `pattern` Zod.
- [ ] Le champ email a `inputmode="email"` + `autocomplete="email"`.
- [ ] Erreurs verbales explicites ("Le numéro doit contenir 10 chiffres", pas "Format invalide").

### 4.1 Compatibilité

- [ ] Markup HTML5 valide (passe W3C validator).
- [ ] `aria-*` uniquement quand HTML natif insuffisant.
- [ ] Pas de role contradictoire (ex. `<button role="link">`).

## Annonces lecteur d'écran — Patterns critiques

### Streaming en cours

L'assistant écrit en temps réel. Annoncer chaque token serait insupportable. Stratégie :

```html
<article role="article" aria-live="polite" aria-atomic="false">
  <span class="sr-only">L'assistant répond :</span>
  <span data-testid="bubble-content">{displayed}</span>
  <span aria-hidden="true" class="caret-blinking">▍</span>
</article>
```

- `aria-live="polite"` : annonce sans interrompre.
- `aria-atomic="false"` : annonce seulement les ajouts, pas tout le contenu.

À la fin (status === 'completed') :
```html
<span class="sr-only">Réponse terminée.</span>
```

### TypingDots

```html
<div role="status" aria-live="polite" aria-label="L'assistant écrit votre réponse...">
  <span class="dot" aria-hidden="true"></span>
  <span class="dot" aria-hidden="true"></span>
  <span class="dot" aria-hidden="true"></span>
</div>
```

### LeadForm offert

Notification courtoise sans interruption :

```html
<div role="status" aria-live="polite">
  Le formulaire pour être rappelée est désormais disponible. Veuillez remplir vos coordonnées.
</div>
```

### Toast service level dégradé

```html
<div role="alert" aria-live="assertive">
  Notre assistant rencontre une difficulté temporaire. Vous pouvez nous laisser vos coordonnées.
</div>
```

## RTL natif

| Élément | LTR | RTL |
|---|---|---|
| Direction texte | `dir="ltr"` | `dir="rtl"` |
| Send button position | right | left |
| Avatar assistant position | left | right |
| Icône fermer | top-right | top-left |
| Padding bulle user | padding-right: 12 | padding-left: 12 |
| Marge bulle assistant | margin-left: 8 | margin-right: 8 |
| Icône send (paper plane) | naturelle | flipped via `scaleX(-1)` |

CSS : utiliser **logical properties** (`padding-inline-start`, `margin-inline-end`) pour réduire les overrides RTL.

## Contrastes — Tokens FemiGlow

| Couleur | Sur fond blanc | Sur fond `#FAF5FF` |
|---|---|---|
| Texte primaire `#1F2937` | 14.5:1 ✅ | 13.8:1 ✅ |
| Texte secondaire `#6B7280` | 5.7:1 ✅ | 5.4:1 ✅ |
| Primary `#6B46C1` | 5.9:1 ✅ | 5.6:1 ✅ |
| Primary contre bouton (texte blanc) | — | 6.1:1 ✅ |
| Erreur `#DC2626` | 6.6:1 ✅ | — |
| Success `#16A34A` | 4.9:1 ⚠️ AAA non | — |

Note : `Success` au-dessus de la limite AA mais sous AAA — acceptable pour AA (texte normal).

## Audit accessibility — Tests automatisés

### axe-core via Playwright

```ts
import AxeBuilder from '@axe-core/playwright'

test('Chat panel a11y', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /ouvrir le chat/i }).click()
  
  const results = await new AxeBuilder({ page })
    .include('[data-testid="chat-panel"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  
  expect(results.violations).toEqual([])
})
```

### Tests manuels — Scenarios

| Scénario | Outil | Critère pass |
|---|---|---|
| Ouvrir chat, envoyer message, recevoir réponse — au clavier uniquement | Tab/Enter | OK sans souris |
| Idem en RTL (FR → AR switch) | Toggle langue | Layout miroir cohérent |
| Idem avec NVDA actif | NVDA | Annonces logiques, pas de spam |
| Idem avec VoiceOver iOS | iPhone | Gestes natifs OK, streaming annoncé |
| Zoom navigateur 200% | Ctrl+= ×6 | Pas d'overflow, pas de scroll horizontal |
| Mode haute contraste Windows | Settings | Visible, focus visible |
| Daltonisme deutéranopie | Stark plugin | Aucune info perdue |

## Backlog accessibilité — Suivi

Maintenu dans Linear `CHAT-A11Y` :
- Chaque violation axe-core → ticket avec capture.
- SR audit trimestriel par person (NVDA, VO).
- Test utilisateur avec PMR (personne à mobilité réduite) avant ship majeur.

## Sources internes/externes

- Spec : [WCAG 2.1](https://www.w3.org/TR/WCAG21/).
- Référentiel français : [RGAA 4.1](https://accessibilite.numerique.gouv.fr/).
- iOS HIG accessibility : [Apple Developer](https://developer.apple.com/design/human-interface-guidelines/accessibility).
- Material accessibility : [Material Design](https://m3.material.io/foundations/accessible-design/overview).
