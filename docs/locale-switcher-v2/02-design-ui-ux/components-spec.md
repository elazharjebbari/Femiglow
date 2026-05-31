# 02 · Design — Components spec

> **Aspect couvert** : (a) le rendu optimal pixel-level de chaque variante, (b) ce qu'il faut vérifier.
> **Tokens** : tous les chiffres/couleurs viennent de [`design-tokens.json`](design-tokens.json). Aucune valeur en dur hors tokens.
> **Contrat** : `LocaleSwitcher`, surfaces `header`/`drawer`/`footer`/`nudge` ; `LocaleVeil` ; `LocaleNudge`. Switcher = **neutres uniquement**, 0 pop chaud, 0 pulse, 0 drapeau, 0 emoji (CONTRACT §5).
> **RTL** : propriétés **logiques** partout (`inline-start/end`, `ms-/me-`, `start-0/end-0`) — jamais `left/right` physiques.

---

## 0. Endonymes (rendu exact, figé)

| Locale | Glyphe rendu | dir | Jamais |
|---|---|---|---|
| `fr` | `Français` | ltr | ~~FR~~, ~~🇫🇷~~ |
| `ar` | `العربية` | rtl | ~~AR~~, ~~🇲🇦~~ |
| `en` | `English` | ltr | ~~EN~~, ~~🇬🇧~~ |

- L'item arabe porte son **propre `dir="rtl"`** même dans un panneau LTR (et inversement) ⇒ le glyphe arabe ne casse pas l'ordre bidi.
- L'endonyme du **trigger** est celui de la **langue active** (`العربية` sur `/ar`).

---

## 1. Dropdown (desktop) — surface `header`, variant `dropdown`

### 1.1 Trigger (fermé)

| Propriété | Valeur (token) |
|---|---|
| Font | Inter, `0.75rem` (`text-xs`), weight 400, `letter-spacing 0.08em` (`typography.trigger`) |
| Couleur label | `encre/80` (`color.switcher.text`) |
| Soulignement | `encre/40`, `underline-offset 4px` (`spacing.underlineOffset`) |
| Chevron | 12px (`size.chevron`), opacité 60% (`color.switcher.chevron`) |
| Padding | block `8px` / inline `10px` (`spacing.triggerPaddingBlock/Inline`) |
| Hit area | ≥ `44px` (`tap.min`) — padding complété par zone cliquable invisible si besoin |
| Hover | fond `encre/[0.04]` (`color.switcher.hoverBg`) |
| Focus | ring `encre` 2px, offset 2px (`focus.ring`) — **jamais** sauge |
| ARIA | `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `aria-label` localisé |

Le label + chevron sont dans un `inline-flex` avec `gap` court ; le chevron est **après** le label en flux **logique** (donc à droite en LTR, à gauche en RTL automatiquement).

### 1.2 Panneau (ouvert)

| Propriété | Valeur (token) |
|---|---|
| Fond | `creme/95` + `backdrop-blur` (`color.panel.bg`) |
| Bordure | `encre/10` (`color.switcher.border`) |
| Rayon | `8px` (`spacing.panelRadius`) |
| Ombre | `shadow-sm` (`color.panel.shadow`) |
| Min inline | `160px` (`size.panelMinInline`) |
| Padding interne | `6px` (`spacing.panelPadding`), gap items `2px` |
| Alignement | **logique** `inset-inline-end: 0` (`end-0`) — s'ancre sous le trigger, miroir RTL automatique |
| Offset | `8px` sous le trigger (`spacing.panelOffset`) |
| Animation d'ouverture | `opacity 0→1` + `translateY(-4px→0)`, `180ms ease-out` (`motion.panel.open`) |
| Chevron | rotation `0→180°`, `200ms ease-out` (`motion.chevron`) |
| Reduced-motion | ouverture instantanée (durations → 0) |

### 1.3 Items

| Propriété | Valeur (token) |
|---|---|
| Font endonyme | **Cormorant Garamond italic**, 400, `1.0625rem` (`typography.panelEndonym`) |
| Couleur inactif | `encre/80` |
| Couleur actif | `encre` (`color.switcher.textActive`) + **point sauge** 6px aligné `inline-end` (`color.switcher.activeDot`) |
| Hover | `encre/[0.04]` (`color.switcher.hoverBg`) |
| Padding | block `10px` / inline `14px` |
| Hauteur effective | ≥ `44px` (`tap.min`) |
| Rôle | `role="menu"` (panneau) / `role="menuitemradio"` + `aria-checked` (items), roving `tabindex` |
| Direction item | chaque item porte son `dir` propre (cf. §0) |

> **Marqueur actif** = point **sauge** (seul accent toléré) + texte encre. **Jamais** de fond coloré, **jamais** rouge/noir pur, **jamais** de coche emoji.

### 1.4 ASCII — FR (LTR)

```
Header (LTR) :  … Nav            [ Français ▾ ]   🛒
                                  └──────────┘
                                  trigger (encre/80, souligné encre/40)

Ouvert :
                                  ┌──────────────────┐  ← end-0, creme/95
                                  │  Français      •  │  ← actif: encre + point sauge (end)
                                  │  العربية          │  ← Cormorant italic, dir=rtl
                                  │  English          │
                                  └──────────────────┘
                                   panneau aligné inline-end, ombre shadow-sm
```

### 1.5 ASCII — AR (RTL, miroir complet)

```
Header (RTL) :  🛒   [ ▾ العربية ]            Nav …
                     └──────────┘
                     chevron à gauche (logique), label arabe dir=rtl

Ouvert (panneau ancré inline-end = à gauche visuellement) :
        ┌──────────────────┐
        │  •      العربية   │  ← actif: point sauge (inline-end = gauche en RTL), encre
        │          Français │  ← dir=ltr dans un panneau rtl
        │           English │
        └──────────────────┘
         tout est miroir : ombre, alignement, ordre label/chevron
```

---

## 2. Pills (mobile/footer) — surfaces `drawer` & `footer`, variant `pills`

| Propriété | Valeur (token) |
|---|---|
| Min target | `44×44px` (`tap.pillMinBlock/Inline`, `tap.min`) |
| Padding inline | `16px` (`spacing.pillPaddingInline`) |
| Gap entre pills | `8px` (`spacing.pillGap`) |
| Rayon | `8px` (`spacing.pillRadius`) |
| Font | Inter `0.8125rem`, weight 500 (`typography.pill`) |
| Actif | fond `encre` + texte `creme` (`color.pill.activeBg/activeText`) |
| Inactif | texte `encre/60`, fond transparent (`color.pill.inactiveText`) |
| Transition | `transition-colors 200ms` (`motion.pill.colorTransition`) |
| Tap feedback | `:active` léger (pas de pop chaud, pas de scale agressif) |
| Ordre | flux **logique** ⇒ miroir RTL automatique |
| Rôle | groupe `role="group"` + boutons ; actif `aria-pressed="true"` |

### 2.1 ASCII — pills FR (LTR)

```
Drawer (haut, sous le wordmark) :
   [ Français ]  [ العربية ]  [ English ]
   ^^^^^^^^^^^^   actif: fond encre, texte crème
   inactifs: texte encre/60
```

### 2.2 ASCII — pills AR (RTL)

```
Drawer (haut, miroir) :
   [ English ]  [ العربية ]  [ Français ]
                ^^^^^^^^^^^   actif (encre/crème)
   ordre inversé par le flux logique
```

---

## 3. Segmented-toggle — variant A/B (header desktop)

> **Variant d'expérience H1** (flag `localeSwitcherV2`). État **toujours visible** (0 clic pour voir les options) ⇒ découvrabilité. Reste **neutre** (pas de sauge de remplissage chaud) : l'actif est marqué en **encre/crème** comme les pills, **pas** en couleur marque saturée.

| Propriété | Valeur (token) |
|---|---|
| Conteneur | bordure `encre/10`, rayon `8px`, fond `creme/95` |
| Segment | min `44px` block, padding inline `14px` |
| Séparateurs | `encre/10` 1px entre segments (logique) |
| Actif | fond `encre`, texte `creme` (réutilise `color.pill.*`) — sobre, pas de pop |
| Inactif | texte `encre/60`, hover `encre/[0.04]` |
| Transition | indicateur actif glisse `200ms ease-out` (jamais < 200ms) ; reduced-motion ⇒ saut instantané |
| Scripts mêlés | équilibrer optiquement latin/arabe : chaque segment porte son `dir` ; largeur par contenu, min cohérent |
| Rôle | `role="radiogroup"` ; segments `role="radio"` + `aria-checked` ; roving tabindex |

### 3.1 ASCII — segmented FR (LTR) / AR (RTL)

```
LTR :  ┌─────────┬─────────┬─────────┐
       │ Français│ العربية │ English │
       └────█────┴─────────┴─────────┘   actif = Français (encre/crème)

RTL :  ┌─────────┬─────────┬─────────┐
       │ English │ العربية │ Français│
       └─────────┴────█────┴─────────┘   actif glissé, ordre miroir
```

---

## 4. Nudge « pearl » — surface `nudge` (`LocaleNudge`)

> **One-shot**, ancrée au switcher. **Jamais** une bannière, **jamais** une modale, **jamais** sur le wizard. Apparition `opacity` `300ms` (`motion.nudge.appear`), **1×/visiteur** (`maxImpressionsPerVisitor`, défaut 1), dismiss **permanent** (cookie `locale_nudge_dismissed`).

| Élément | Valeur (token) |
|---|---|
| Point | **sauge** 6px (`color.nudge.dot`) — seul accent |
| Micro-label | `بالعربية ؟` (suggère AR) / `In English?` (suggère EN), Inter `0.75rem` `encre/80` (`color.nudge.text`) |
| Fond | `creme/96` (`color.nudge.bg`) |
| Dismiss ✕ | glyphe `encre/50`, hit area `44px` (`tap.dismissTarget`) |
| Padding | `6px 10px` (`spacing.nudgePadding`) |
| Offset | `6px` du switcher, **logique** (`spacing.nudgeOffset`) |
| z-index | `60` (`zIndex.nudge`) — au-dessus du switcher, sous le voile |
| Pas d'emoji / pas d'urgence | aucune flèche clignotante, aucun compte à rebours |

### 4.1 ASCII

```
LTR (servi FR, navigateur AR) :        RTL (servi AR, navigateur EN) :
   [ Français ▾ ]                                     [ ▾ العربية ]
      · بالعربية ؟  ✕                         ✕  ? In English ·
      └ point sauge + label, ancré sous le switcher (offset logique)
```

- Clic sur le label/point ⇒ **accepte** (bascule vers `suggested`) ⇒ `locale_nudge_accepted`.
- Clic sur ✕ ⇒ **dismiss** permanent ⇒ `locale_nudge_dismissed`, jamais ré-affiché.
- Apparition ⇒ `locale_nudge_shown` (cap 1×/visiteur).

---

## 5. Veil overlay (`LocaleVeil`) — fallback transition

> Utilisé **uniquement** quand View Transitions absente (ex. Firefox) ou comme repli identique cross-browser. Couvre le document pendant `apply()`. **Ivoire neutre, jamais blanc pur** (anti-flash).

| Propriété | Valeur (token) |
|---|---|
| Couleur | `creme` (`color.veil.bg`) — `#FBF8F1`, **pas** `#fff` |
| Couverture | `position: fixed; inset: 0` |
| z-index | `9990` (`zIndex.veil`) — au-dessus de tout |
| Fade-in | `opacity 0→1`, `160ms` (`motion.veil.fadeIn`) |
| Fade-out | `opacity 1→0`, `160ms` (`motion.veil.fadeOut`) |
| Courbe | `cubic-bezier(0.22,1,0.36,1)` (`motion.veil.easing`) |
| Contenu | aucun (overlay vide) — pas de spinner, pas de texte, pas de logo qui clignote |
| `pointer-events` | `none` pendant le fade-out pour ne pas bloquer l'interaction |
| Reduced-motion | voile **non monté** ⇒ application directe (INV-7) |

### 5.1 Séquence (ASCII)

```
t0  clic langue            ┌───────────────┐ (page visible)
t1  veil fadeIn 160ms      │░░░░░░░░░░░░░░░│  opacity 0→1 (crème)
t2  apply() derrière voile │███████████████│  dir/lang posés + soft-nav (page invisible)
t3  veil fadeOut 160ms     │░░░░░░░░░░░░░░░│  opacity 1→0 → nouvelle langue/RTL révélée
t4  fin                    └───────────────┘ (nouvelle page, scroll préservé)
```

---

## 6. RTL mirroring — règles transverses

- **Propriétés logiques only** : `inline-start/end`, `padding-inline`, `margin-inline`, `inset-inline-end`, `text-align: start`. Aucune `left/right` physique sur switcher/panel/pills/nudge/veil.
- **Alignement panneau** : `end-0` ⇒ ancré à droite en LTR, à gauche en RTL, sans code conditionnel.
- **Ordre label/chevron** : flux DOM logique ⇒ chevron toujours du côté `inline-end`.
- **Point actif** : aligné `inline-end` ⇒ droite en LTR, gauche en RTL.
- **Items à script opposé** : chaque item porte son `dir` propre (cf. §0) pour un bidi correct.
- **Nudge** : offset logique ⇒ se positionne du bon côté selon `dir` courant.

---

## 7. Éléments à vérifier / tester (composants)

- [ ] **Endonymes exacts** rendus (`Français`/`العربية`/`English`), jamais code ISO ni drapeau (DOM snapshot FR/AR/EN).
- [ ] **0 latin** sur `/ar` hors `FemiGlow` — l'endonyme arabe ne réintroduit pas de latin (INV-6).
- [ ] **Neutralité** : aucun token marque chaud / aucune classe `pulse`/pop sur switcher (test DOM + revue).
- [ ] **Tap targets ≥ 44px** sur trigger, pills, segments, dismiss (mesure DOM).
- [ ] **Alignement logique** : panneau `end-0` miroir correct en RTL (Playwright LTR vs RTL screenshots).
- [ ] **Point actif sauge** présent sur l'item/segment actif uniquement.
- [ ] **Cormorant italic** appliqué aux endonymes du panneau ; **Inter** sur le trigger.
- [ ] **Veil = crème, jamais blanc** ; pas de spinner ; reduced-motion ⇒ pas de voile.
- [ ] **Nudge** : 1×/visiteur, dismiss permanent, jamais en modale/wizard ; ✕ hit area 44px.
- [ ] **Segmented variant** : actif en encre/crème (pas marque saturée) ; `radiogroup` a11y.
- [ ] **Focus ring encre** (jamais sauge) sur tous les éléments focusables.
- [ ] **z-index** : veil > nudge > panel ; aucun élément masqué incorrectement.
