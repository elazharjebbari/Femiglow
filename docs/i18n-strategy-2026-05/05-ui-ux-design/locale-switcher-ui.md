# Locale switcher — Design UI & UX

> Trois designs candidats pour le sélecteur de langue FemiGlow. Comparaison, mockups ASCII, accessibilité, comportement responsive, animations, et plan de tests utilisateurs.

## 1. Cadre de décision

### 1.1 Contraintes héritées

| Contrainte | Source | Implication design |
|---|---|---|
| 3 locales V1 (`fr`, `ar`, `en`) | `00-context` | Le switcher doit tenir 3 items sans surcharger |
| `ar` est RTL | `02-design-conception` | Le switcher lui-même doit être mirror-safe |
| Cookie `NEXT_LOCALE` persiste 1 an | `02-design-conception/locale-detection.md` | Pas de bascule éphémère |
| Header sobre éditorial existant | Voix de marque | Aucun emoji, aucun drapeau |
| Admin n'a pas de switcher | Décision V1 | Composant rendu conditionnellement |
| Wizard checkout ne doit pas régresser (CHA-231) | Contrat technique | Le switcher peut être caché pendant le checkout |

### 1.2 Objectifs UX

1. **Découvrabilité** — un visiteur AR doit voir qu'il peut passer en arabe en < 3 secondes
2. **Faible coût visuel** — le switcher ne doit pas voler l'attention du logo ou du CTA
3. **Persistance** — la langue choisie persiste sur toute la session et la navigation suivante
4. **Idempotence** — cliquer sur la langue active ne fait rien (pas de blink, pas de redirect)
5. **Préservation du contexte** — `/fr/kit` + clic sur AR → `/ar/kit` (même page, autre langue)

### 1.3 Anti-objectifs

- Pousser l'utilisateur vers une langue qu'il n'a pas demandée
- Afficher une bannière de bienvenue dans une autre langue (`"Speak English? Switch"`)
- Mémoriser la langue par IP / géolocalisation (cookie suffit)

## 2. Candidat A — Dropdown header desktop (recommandé)

### 2.1 Mockup ASCII

État fermé :

```
+--------------------------------------------------------------+
|  FEMIGLOW                MAISON  KIT  RITUEL  JOURNAL   FR v |
+--------------------------------------------------------------+
                                                            ^
                                              code locale courante
                                              + chevron discret
```

État ouvert (focus clavier ou clic) :

```
+--------------------------------------------------------------+
|  FEMIGLOW                MAISON  KIT  RITUEL  JOURNAL   FR v |
+--------------------------------------------------------------+
                                                       +------+
                                                       | FR . |  <- current, italique
                                                       | AR   |
                                                       | EN   |
                                                       +------+
```

En arabe (RTL), le panneau s'aligne sur l'autre bord :

```
+--------------------------------------------------------------+
|  v AR   مجلة  طقوس  كيت  منزل                       FEMIGLOW |
+--------------------------------------------------------------+
 +------+
 | AR . |
 | FR   |
 | EN   |
 +------+
```

### 2.2 Specs visuels

| Aspect | Valeur |
|---|---|
| Trigger | Bouton `<button>` avec code à 2 lettres uppercase (`FR`, `AR`, `EN`) |
| Largeur trigger | Auto, padding `px-3 py-2` |
| Typo trigger | `font-sans text-sm tracking-wide` (Inter) |
| Chevron | Icône SVG 12px, opacité 60 %, rotation 180° à l'ouverture (200 ms) |
| Panel | `bg-white border border-stone-200 rounded-sm shadow-sm` |
| Item largeur min | 88 px |
| Item current | `italic text-stone-900` + petit point à droite |
| Item hover | `bg-stone-50` |
| Item focus visible | `ring-2 ring-stone-900 ring-offset-1` |
| Animation ouverture | `transition-opacity duration-150 ease-out` |
| Position panel | `absolute end-0 top-full mt-2` (logical end => correct RTL) |

### 2.3 Code recipe Tailwind logical-safe

```tsx
<button
  type="button"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={t('navigation.locale_switcher_aria')}
  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-sans tracking-wide text-stone-700 hover:text-stone-900 transition-colors"
>
  {currentLocale.toUpperCase()}
  <ChevronDownIcon
    className={cn(
      'h-3 w-3 opacity-60 transition-transform duration-200',
      open && 'rotate-180'
    )}
  />
</button>

<ul
  role="listbox"
  aria-label={t('navigation.locale_switcher_aria')}
  className="absolute end-0 top-full mt-2 min-w-[88px] rounded-sm border border-stone-200 bg-white shadow-sm focus:outline-none"
>
  {locales.map((loc) => (
    <li
      key={loc}
      role="option"
      aria-selected={loc === currentLocale}
      className={cn(
        'flex items-center justify-between gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none',
        loc === currentLocale && 'italic text-stone-900'
      )}
    >
      <span>{loc.toUpperCase()}</span>
      {loc === currentLocale && (
        <span className="h-1 w-1 rounded-full bg-stone-900" aria-hidden="true" />
      )}
    </li>
  ))}
</ul>
```

Note : `end-0` (au lieu de `right-0`) garantit que le panel s'aligne sur le bord opposé en RTL.

### 2.4 Pros / Cons

**Pros**
- Très sobre, raccord avec l'éditorial FemiGlow
- 3 items facilement extensibles à 5-6 sans gêne
- Pattern reconnu, faible courbe d'apprentissage
- Bonne intégration `<details>` natif si on veut un fallback sans JS

**Cons**
- Demande un état React (open/closed) côté client → `'use client'` sur ce composant uniquement
- Pas idéal sur mobile (panel < taille tap target confortable)

## 3. Candidat B — Flag pills horizontal mobile (recommandé mobile + footer)

### 3.1 Mockup ASCII

Inline dans le footer desktop, ou en haut du drawer mobile :

```
+--------------------------------------------------------------+
|   [FR]   AR    EN                                            |
+--------------------------------------------------------------+
     ^
  active, fond pleine
  noir + texte blanc
```

En version RTL (visiteur AR, footer) :

```
+--------------------------------------------------------------+
|                                             EN   [AR]   FR  |
+--------------------------------------------------------------+
                                              ^
                                          active (AR)
```

### 3.2 Specs visuels

| Aspect | Valeur |
|---|---|
| Items | 3 boutons `<button>` rendus inline |
| Item largeur | Min 44 × 44 px (tap target a11y) |
| Item inactif | `text-stone-500 hover:text-stone-900` |
| Item actif | `bg-stone-900 text-white px-3 py-1 rounded-sm` |
| Espacement | `gap-2` |
| Position drawer mobile | Tout en haut du drawer, sous le logo |
| Position footer | Bloc latéral, sous "Suivez-nous" |
| Transition active | `transition-colors duration-200` |

### 3.3 Code recipe

```tsx
<div role="group" aria-label={t('navigation.locale_switcher_aria')} className="inline-flex gap-2">
  {locales.map((loc) => {
    const isActive = loc === currentLocale;
    return (
      <button
        key={loc}
        type="button"
        onClick={() => switchLocale(loc)}
        aria-current={isActive ? 'true' : undefined}
        className={cn(
          'min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-sm font-sans tracking-wide rounded-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2',
          isActive
            ? 'bg-stone-900 text-white'
            : 'text-stone-500 hover:text-stone-900'
        )}
      >
        {loc.toUpperCase()}
      </button>
    );
  })}
</div>
```

### 3.4 Pros / Cons

**Pros**
- Tap target généreux (mobile-first)
- État actif évident d'un coup d'œil
- Pas d'état JS (radio-like sans dropdown)
- Excellent dans footer car place dispo

**Cons**
- Prend de l'espace horizontal — saturé au-delà de 4 langues
- Moins discret en header desktop que le dropdown

## 4. Candidat C — Select natif minimal

### 4.1 Mockup ASCII

```
+--------------------------------------------------------------+
|  FEMIGLOW                MAISON  KIT  RITUEL  JOURNAL  [FR v]|
+--------------------------------------------------------------+
```

État ouvert = menu OS natif (varie selon plateforme).

### 4.2 Specs visuels

```tsx
<label className="sr-only" htmlFor="locale-select">
  {t('navigation.locale_switcher_aria')}
</label>
<select
  id="locale-select"
  value={currentLocale}
  onChange={(e) => switchLocale(e.target.value as Locale)}
  className="appearance-none border border-stone-200 bg-white px-3 py-2 text-sm font-sans rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
>
  {locales.map((loc) => (
    <option key={loc} value={loc}>
      {loc.toUpperCase()}
    </option>
  ))}
</select>
```

### 4.3 Pros / Cons

**Pros**
- Zéro maintenance JS (HTML natif)
- Accessibilité gérée par le navigateur
- Fonctionne sans JS chargé
- Mobile : utilise le picker OS (très ergonomique)

**Cons**
- Style inégal cross-platform (Safari iOS, Chrome Android, Firefox)
- Peu raffiné visuellement, casse l'éditorial sobre
- Pas d'animation FemiGlow possible
- Difficile d'afficher du contenu riche (current marker, etc.)

## 5. Recommandation finale

| Surface | Candidat retenu | Justification |
|---|---|---|
| Header desktop | **A — Dropdown** | Sobre, intégré, room for 3+ langues |
| Header mobile (dans hamburger drawer) | **B — Pills** | Tap targets, état actif clair |
| Footer (desktop + mobile) | **B — Pills** | Place dispo, redondance UX |
| Page erreur 404/500 | **C — Select natif** | Fallback léger, marche sans JS |

Implémentation : 1 composant **`<LocaleSwitcher variant="dropdown" | "pills" | "select" />`** qui factorise la logique de switch et expose un visuel selon `variant`.

## 6. Placement responsive

### 6.1 Breakpoints

| Viewport | Surface principale | Visuel |
|---|---|---|
| < 640 px | Drawer hamburger | Pills, tout en haut |
| 640-1024 px | Header | Dropdown, à droite du menu |
| > 1024 px | Header | Dropdown, à droite du menu |
| Footer all | Bloc inférieur | Pills |

### 6.2 Header desktop — placement précis

```
[Logo]  ............  [Maison]  [Kit]  [Rituel]  [Journal]  [Switcher]  [Panier]
       <— marge auto                              <— ordre stable —>
```

Le switcher se place **entre la navigation et le panier**. En RTL, le panier passe à gauche du switcher (logical layout via `flex-row` + `dir="rtl"`).

### 6.3 Drawer mobile — placement précis

```
+---------------------------+
|  [Logo FEMIGLOW]       X  |
+---------------------------+
|                           |
|  [FR]  AR   EN            |  <- pills, en haut
|                           |
|  Maison                   |
|  Kit                      |
|  Rituel                   |
|  Journal                  |
|                           |
+---------------------------+
```

## 7. Accessibilité

### 7.1 Standards visés

- WCAG 2.1 Level AA
- WAI-ARIA Authoring Practices pour Combobox / Listbox (candidat A) ou Radio Group (candidat B)
- Tap targets >= 44×44 px (Apple HIG, MD3)

### 7.2 Attributs ARIA (candidat A dropdown)

```html
<button
  aria-haspopup="listbox"
  aria-expanded="false"
  aria-controls="locale-listbox"
  aria-label="Choisir une langue"
>
  FR
</button>

<ul
  id="locale-listbox"
  role="listbox"
  aria-label="Langues disponibles"
  tabindex="-1"
>
  <li role="option" aria-selected="true" tabindex="0">FR</li>
  <li role="option" aria-selected="false" tabindex="-1">AR</li>
  <li role="option" aria-selected="false" tabindex="-1">EN</li>
</ul>
```

### 7.3 Navigation clavier (candidat A)

| Touche | Action |
|---|---|
| `Tab` | Focus sur le bouton trigger |
| `Enter` / `Space` | Ouvre le panel |
| `Escape` | Ferme le panel, retour focus au trigger |
| `ArrowDown` | Item suivant |
| `ArrowUp` | Item précédent |
| `Home` | Premier item |
| `End` | Dernier item |
| `Enter` sur item | Sélectionne et ferme |
| `Tab` sur item | Ferme le panel, focus suivant dans le DOM |
| Caractère initial (`F`) | Saute au premier item commençant par F |

### 7.4 Navigation clavier (candidat B pills)

| Touche | Action |
|---|---|
| `Tab` | Focus sur le premier item |
| `ArrowLeft` / `ArrowRight` | Item précédent / suivant (en RTL, inverse) |
| `Enter` / `Space` | Active la langue |
| `Tab` | Quitte le groupe |

Note : en RTL, `ArrowRight` doit naviguer **vers la gauche visuellement** (cohérent avec sens lecture). Utiliser `useDirection()` pour inverser.

### 7.5 Focus visible

Toujours visible, même en survol souris :

```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-stone-900
focus-visible:ring-offset-2
```

Couleur du ring : `stone-900` (noir sobre) — pas la couleur sand de la brand pour préserver le contraste.

### 7.6 Screen readers

Annonces attendues :

| Évènement | NVDA / JAWS | VoiceOver iOS |
|---|---|---|
| Focus trigger | "Choisir une langue, bouton, menu fermé, FR" | "Choisir une langue. Bouton. Menu fermé. F R" |
| Ouverture | "Menu ouvert, 3 éléments, FR sélectionné" | "Menu langues, 3 items, F R sélectionné" |
| Survol AR | "AR, 2 sur 3" | "AR, 2 sur 3" |
| Sélection AR | "AR sélectionné, page rechargée" | "AR sélectionné" |

Test : `aria-live="polite"` sur la confirmation de changement n'est PAS nécessaire si la page reload (le `<html lang>` change déclenche l'annonce native).

### 7.7 Contraste

| Élément | Ratio mesuré | WCAG |
|---|---|---|
| Texte trigger `stone-700` sur `white` | 9.4:1 | AAA |
| Texte item actif `white` sur `stone-900` | 16.8:1 | AAA |
| Focus ring `stone-900` sur `white` | 16.8:1 | AAA |
| Hover bg `stone-50` (subtil) | 1.04:1 | Décoration, OK |

## 8. États du composant

| État | Visuel | Comportement |
|---|---|---|
| Idle | Trigger neutre `text-stone-700` | Rien |
| Hover | Trigger `text-stone-900` | Curseur pointer |
| Focus | Ring visible | Annonce SR |
| Open | Chevron tourné, panel visible | Trap focus dans panel |
| Loading switch | Skeleton 50 ms | Pas de spinner (trop intrusif) |
| Active (current locale) | Item italic + dot | Pas cliquable (no-op) |
| Disabled | Opacité 0.5, cursor not-allowed | Si i18n.config invalide |

## 9. Transition / animation

### 9.1 Ouverture du panel (candidat A)

```css
.locale-panel {
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}
.locale-panel[data-state='open'] {
  opacity: 1;
  transform: translateY(0);
}
```

Pas d'overshoot, pas de spring. La sobriété FemiGlow exige une transition courte et linéaire.

### 9.2 Bascule de langue (full page)

Lors du switch, deux options :

1. **Reload complet** (`window.location.assign(newPath)`) — simple, ressenti franc, recommandé V1
2. **Soft navigation** (`router.replace(newPath, { locale })`) — preserve scroll, smoother

→ V1 : reload complet pour garantir que tous les RSC se ré-évaluent côté serveur et que `<html lang>` change correctement.

### 9.3 Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .locale-panel {
    transition: opacity 0ms;
    transform: none;
  }
}
```

## 10. Persistance et URL

### 10.1 Cookie

Au switch :

```ts
document.cookie = `NEXT_LOCALE=${newLocale}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
```

(géré par `next-intl` automatiquement, mention pour rappel)

### 10.2 URL

Toujours synchrone avec la locale active : `/fr/kit` → `/ar/kit`.

### 10.3 Préservation du query string

`/fr/kit?utm_source=instagram` → `/ar/kit?utm_source=instagram` (utm conservé).

Implementation :

```ts
function buildSwitchUrl(currentPath: string, currentQuery: string, newLocale: Locale): string {
  const segments = currentPath.split('/').filter(Boolean);
  if (segments[0] && LOCALES.includes(segments[0] as Locale)) {
    segments[0] = newLocale;
  } else {
    segments.unshift(newLocale);
  }
  const path = '/' + segments.join('/');
  return currentQuery ? `${path}?${currentQuery}` : path;
}
```

### 10.4 Cas particuliers

| URL avant | Action switch FR→AR | URL après |
|---|---|---|
| `/fr/` | OK | `/ar/` |
| `/fr/kit` | OK | `/ar/kit` |
| `/fr/journal/post-1` | OK | `/ar/journal/post-1` |
| `/admin/dashboard` | Switcher caché | (n/a, admin = FR only V1) |
| `/api/checkout` | Switcher inapplicable | (n/a) |
| `/fr/checkout` (wizard) | Switcher caché V1 | (cf. `wizard-i18n.md`) |

## 11. Tests utilisateurs proposés

### 11.1 Protocole

5 participants par profil, 30 min chacun, tâches scriptées avec observation comportementale et SUS final.

### 11.2 Profils

| Profil | Critère recrutement | Devices |
|---|---|---|
| Cliente FR primaire | Femme 25-45, FR natif, sait acheter en ligne | iPhone + desktop |
| Cliente AR primaire | Femme 25-45, arabophone Maroc | Android + desktop |
| Cliente EN secondaire | Expat ou diaspora marocaine UK/US | Desktop |
| A11y user | Utilisateur clavier-only ou screen reader | Tout device |

### 11.3 Tâches

| # | Tâche | Critère succès |
|---|---|---|
| T1 | "Vous êtes sur la page d'accueil en français. Trouvez le moyen de passer en arabe." | Réalisé en < 5 secondes, sans aide |
| T2 | "Vous êtes en arabe sur la page Kit. Repassez en français." | Réalisé en < 3 secondes |
| T3 | "Sur mobile, ouvrez le menu et changez de langue." | Pills repérées, choix correct |
| T4 | "Au clavier seulement (sans souris), ouvrez le sélecteur et choisissez l'anglais." | Tab + Arrow + Enter sans erreur |
| T5 | "Lisez avec un screen reader la séquence d'ouverture du switcher." | Annonces compréhensibles |
| T6 | "Partagez l'URL avec un ami. Ouvrez-la dans un nouveau navigateur, vérifiez que la langue est la même." | Cookie + URL persistent |

### 11.4 Métriques quantitatives

- Time-on-task moyen
- Taux de réussite (sans aide / avec aide / échec)
- Erreurs critiques (clic mauvaise zone, abandon)
- SUS score >= 78 (ciblé "good")

### 11.5 Métriques qualitatives

- Verbatims sur la sobriété ressentie
- Perception du candidat A vs B (A/B test mockup imprimé)
- Compréhension du marker italic "current locale"
- Préférence pour reload franc vs soft navigation

## 12. Édge cases à valider

| Cas | Comportement attendu |
|---|---|
| User déjà sur AR, clic sur AR dans le panel | No-op, panel se ferme, pas de reload |
| User offline, clic sur AR | Reload échoue, fallback toast "Vérifiez votre connexion" |
| Cookie bloqué (RGPD strict) | Switcher fonctionne via URL uniquement, pas de persistance — accepter dégradation |
| 1 seule locale (config minimale) | Switcher rendu `null` (composant vide) |
| User a `Accept-Language: de,fr` et arrive sur `/` | Middleware redirige vers `/fr/` (de pas supporté), switcher montre FR active |
| URL profonde inexistante en AR (`/ar/page-not-translated`) | Page 404 localisée AR avec switcher pour repasser en FR |

## 13. Anti-patterns à bannir

- ❌ **Drapeau émoji** dans le trigger : `🇲🇦 AR` — politique floue (AR n'est pas qu'un drapeau MA), rendu inégal, exclut langues sans pays
- ❌ **Globe icon** sans label texte — invisible aux screen readers, ambiguité fonction
- ❌ **Switcher caché dans le footer uniquement** — sous le fold, découvrabilité < 10 %
- ❌ **Modale plein écran "Choisissez votre langue"** au premier chargement — intrusif, casse la conversion
- ❌ **Bascule sans reload** sur V1 — risque RSC stale, traduction partielle visible
- ❌ **Pas d'aria-label** sur le trigger — viole WCAG 4.1.2
- ❌ **Couleurs locale-specific** (vert pour AR, bleu pour EN) — stéréotype, casse l'éditorial
- ❌ **Texte du trigger traduit** ("Langue" en FR, "Language" en EN) — code à 2 lettres = universel
- ❌ **Tooltip uniquement** au hover — exclut touch et clavier

## 14. Checklist de livraison

Avant merge du composant `<LocaleSwitcher />` :

- [ ] Les 3 variantes (`dropdown`, `pills`, `select`) sont implémentées
- [ ] Tests Vitest sur la logique de switch URL (cf. section 10.3)
- [ ] Tests Playwright clavier-only sur dropdown ouvert / navigué / sélectionné
- [ ] Tests Playwright RTL : panel s'aligne sur le bord opposé
- [ ] Tests Axe : 0 violation a11y critique sur les 3 variantes
- [ ] Tests visuels Percy (ou Chromatic) sur FR / AR / EN
- [ ] Composant rendu conditionnellement (caché sur `/admin/*` et `/checkout/*`)
- [ ] Cookie `NEXT_LOCALE` posé correctement (vérifié via DevTools)
- [ ] Switch préserve query string (cf. table 10.4)
- [ ] Annonce screen reader testée NVDA + VoiceOver iOS
- [ ] `prefers-reduced-motion` respecté
- [ ] Composant exposé dans `apps/web/src/components/i18n/LocaleSwitcher.tsx`
- [ ] Documenté dans Storybook avec 3 stories (un par variant)
- [ ] Validation finale par la fondatrice sur le rendu sobre

## 15. Liens internes

- Voir `rtl-support.md` pour la position `end-0` vs `right-0`
- Voir `typography.md` pour la typo du trigger
- Voir `wizard-i18n.md` pour l'absence de switcher pendant le checkout
- Voir `02-design-conception/locale-detection.md` pour la pose du cookie
- Voir `02-design-conception/url-strategy.md` section 2.3 pour le switch URL
