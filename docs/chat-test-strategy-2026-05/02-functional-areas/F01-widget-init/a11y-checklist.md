# F01 — Checklist accessibilité

Conformité **WCAG 2.1 AA** + bonnes pratiques mobile / screen reader.

## Launcher (FAB bouton)

- [ ] **Role** : `button` natif (pas `<div role="button">`)
- [ ] **Label** : `aria-label="Ouvrir le chat"` (FR) / `"افتح المحادثة"` (AR-MA)
- [ ] **Position dans DOM** : à la fin du `<body>`, post-`<main>` (skip-to-main fonctionne)
- [ ] **Tab order** : tabbable (tabindex≥0), accessible au clavier
- [ ] **Activation** : `Enter` ET `Space` ouvrent le panel
- [ ] **Focus visible** : ring 2 px contrast ≥ 3:1 vs background
- [ ] **Contraste icône / fond** : ≥ 4,5:1 (WCAG AA)
- [ ] **État ouvert** : `aria-expanded="true"` quand panel ouvert
- [ ] **`aria-controls`** : pointe vers l'id du panel
- [ ] **Hit target** : ≥ 44×44 px sur mobile (WCAG 2.5.5)
- [ ] **Badge "non lu"** : `aria-label="3 nouveaux messages"` (et non juste "3")
- [ ] **Réduced motion** : pas d'animation pulse si `prefers-reduced-motion: reduce`

## Panel (région ouverte)

- [ ] **Role** : `region` ou `dialog` (selon UX choisi)
- [ ] **Label** : `aria-label="Assistant FemiGlow"` ou `aria-labelledby` vers titre
- [ ] **Modal vs non-modal** : si modal (mobile), `role="dialog"` + `aria-modal="true"`
- [ ] **Focus trap** : Tab cycle limité au panel (mobile uniquement, pas desktop ?)
- [ ] **Close** :
  - [ ] Bouton `aria-label="Fermer le chat"`
  - [ ] `Escape` ferme
  - [ ] Click hors panel ferme (desktop) ? **À discuter UX**
- [ ] **Return focus** : après close → focus revient sur launcher
- [ ] **Inert outside** : `inert` ou `aria-hidden="true"` sur `<main>` quand modal mobile
- [ ] **Heading hierarchy** : un seul `<h2>` "Assistant FemiGlow" au top du panel
- [ ] **Landmarks** : pas de `<main>` à l'intérieur (déjà un dans la page hôte)

## Internationalisation

- [ ] **`lang` attribut** : panel a `lang="ar-MA"` quand visiteur darija
- [ ] **`dir` attribut** : `dir="rtl"` sur panel arabe
- [ ] **Mirror icons** : flèches, chevrons miroir en RTL
- [ ] **Texte non miroir** : chiffres, dates restent LTR dans RTL (selon convention MA)

## Screen reader (NVDA / VoiceOver)

- [ ] Launcher annoncé : "Ouvrir le chat, bouton"
- [ ] Click launcher : "Assistant FemiGlow, région, focus sur message"
- [ ] Composer annoncé : "Votre message, zone de texte modifiable"
- [ ] Liste messages annoncée : "Historique des messages, journal"
- [ ] Nouveau message assistant : `aria-live="polite"` + role `log` (n'interrompt pas)
- [ ] Message d'erreur (form lead) : `aria-live="assertive"` (interruption acceptable)

## Tests automatiques

### Component (jest-axe)

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('launcher passes axe', async () => {
  const { container } = render(<ChatWidget />);
  await waitFor(() => screen.getByRole('button', { name: /ouvrir le chat/i }));

  const results = await axe(container, {
    rules: { 'color-contrast': { enabled: true } },
  });
  expect(results).toHaveNoViolations();
});
```

### E2E (axe-playwright)

```typescript
import AxeBuilder from '@axe-core/playwright';

test('@a11y launcher passes', async ({ page }) => {
  await page.goto('/kit');
  await page.getByRole('button', { name: /ouvrir le chat/i }).waitFor();
  const r = await new AxeBuilder({ page })
    .include('[data-chat-launcher]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(r.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toHaveLength(0);
});
```

### Tests manuels (à faire 1× / sprint)

- [ ] Naviguer le widget **uniquement au clavier** (Tab, Shift+Tab, Enter, Esc)
- [ ] Lire la page complète avec **VoiceOver** (Mac) ou **NVDA** (Windows) — Note vocale
- [ ] Tester avec **agrandissement 200 %** (zoom navigateur)
- [ ] Tester avec **OS dark mode** + **OS high contrast**
- [ ] Tester avec **prefers-reduced-motion: reduce**
- [ ] Tester sur **mobile** avec **TalkBack** (Android) ou **VoiceOver** (iOS)

## Outils

- **axe DevTools** (extension Chrome / Firefox) — audit ponctuel
- **Lighthouse** — audit a11y
- **WAVE** (browser extension) — audit visuel
- **Stark** (Figma plugin) — design phase
- **Color contrast analyzer** — vérification contraste

## Erreurs courantes à éviter

| Erreur | Correction |
|--------|------------|
| `<div role="button" onClick>` | `<button>` natif |
| `aria-label="3"` (sur badge) | `aria-label="3 nouveaux messages"` |
| Animation auto sans pause | `prefers-reduced-motion` check |
| Focus ring `outline: none` | Garder ou remplacer par alternative visible |
| `aria-hidden` mal placé | Vérifier que contenu critique n'est pas masqué |
| `tabindex="1"` (positif) | Toujours 0 ou -1 |
