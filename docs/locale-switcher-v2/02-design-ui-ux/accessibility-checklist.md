# 02 · Design — Accessibility checklist (WCAG 2.1 AA)

> **Aspect couvert** : (a) le comportement a11y optimal, (b) chaque item à vérifier + **méthode de test**.
> **Cible** : WCAG 2.1 **AA** (contraste encre/crème visé **AAA**).
> **Invariants** : INV-7 (reduced-motion), INV-8 (sans-JS), INV-10 (annonce SR), + focus management.
> **Tokens** : [`design-tokens.json`](design-tokens.json) (`focus.ring` = encre, jamais sauge).

---

## 1. Le fonctionnement a11y optimal visé

- Le switcher est **entièrement opérable au clavier** (ouverture, navigation entre langues, sélection, fermeture) avec un **roving tabindex**.
- Chaque **bascule de langue est annoncée** au lecteur d'écran via une région `aria-live="polite"` (INV-10) — indispensable car le reload (qui annonçait implicitement) a disparu.
- Le **focus n'est jamais perdu** : après bascule, il revient au déclencheur.
- `prefers-reduced-motion` ⇒ bascule **instantanée** (INV-7) ; **sans JS** ⇒ liens `<a hreflang>` (INV-8).
- Contrastes **AA partout, AAA pour encre/crème** ; ring de focus **visible** et **neutre**.

---

## 2. Roles & ARIA

| # | Exigence | Détail | Méthode de test |
|---|---|---|---|
| A1 | Trigger dropdown | `aria-haspopup="menu"`, `aria-expanded` (false/true), `aria-controls=<panelId>`, `aria-label` **localisé** (« Changer de langue » / « تغيير اللغة » / « Change language ») | axe + inspection DOM FR/AR/EN |
| A2 | Panneau | `role="menu"`, `aria-labelledby` = trigger | axe + NVDA/VoiceOver |
| A3 | Items dropdown | `role="menuitemradio"` + `aria-checked` (actif=true) | axe + SR (état lu) |
| A4 | Pills | conteneur `role="group"` + `aria-label` ; bouton actif `aria-pressed="true"` | axe |
| A5 | Segmented (variant) | `role="radiogroup"` + `aria-label` ; segments `role="radio"` + `aria-checked` | axe |
| A6 | Endonyme + langue du contenu | chaque item porte `lang=<code>` et `dir` propre (ex. item arabe `lang="ar" dir="rtl"`) | DOM + SR (prononciation correcte) |
| A7 | Nudge | non-modal, ne **vole pas** le focus à l'apparition ; ✕ a `aria-label` (« Ignorer » localisé) | axe + test focus |
| A8 | Veil | `aria-hidden="true"` (purement décoratif) ; n'annonce rien | DOM |
| A9 | Active = no-op (INV-11) | l'item actif reste focusable mais ne déclenche ni annonce ni nav | test clavier |

---

## 3. Keyboard map (roving tabindex)

| Touche | Contexte | Action |
|---|---|---|
| `Tab` | global | entre/sort du switcher ; **un seul** stop tab (roving tabindex à l'intérieur) |
| `Enter` / `Space` | trigger fermé | ouvre le panneau, focus sur l'item **actif** |
| `Enter` / `Space` | item / pill / segment | sélectionne la langue (ou no-op si active, INV-11) |
| `↓` / `→` | panneau / radiogroup ouvert | item **suivant** (en RTL, `→` suit le sens logique) |
| `↑` / `←` | panneau / radiogroup | item **précédent** |
| `Home` | panneau ouvert | **premier** item |
| `End` | panneau ouvert | **dernier** item |
| `Esc` | panneau ouvert | **ferme** sans changer de langue, focus retour trigger |
| `Tab` (dans panneau) | panneau ouvert | ferme le panneau et continue le flux tab normal |

> **Roving tabindex** : un seul item a `tabindex=0` (l'actif/focus courant), les autres `tabindex=-1`. Les flèches déplacent le `tabindex=0`.
> **RTL** : la sémantique flèches suit le **sens logique** (`→` = suivant en logique) ; à valider en RTL réel (ne pas inverser arbitrairement).

| # | Exigence clavier | Méthode de test |
|---|---|---|
| K1 | Ouverture/fermeture au clavier (Enter/Space/Esc) | Playwright clavier + manuel |
| K2 | ↑↓ Home End naviguent, roving tabindex correct | Playwright + manuel |
| K3 | Esc ferme sans changer de langue, focus retour trigger | Playwright |
| K4 | Aucune **trappe** de focus (Tab sort proprement) | manuel clavier |
| K5 | Flèches cohérentes en RTL (sens logique) | manuel AR + Playwright RTL |
| K6 | No-op (INV-11) au clavier ne déclenche rien | Playwright |

---

## 4. Announce on switch (INV-10) — région aria-live

| # | Exigence | Détail | Méthode de test |
|---|---|---|---|
| L1 | Région `aria-live="polite"` persistante | présente dans le DOM **avant** la bascule (pas montée à la volée) | DOM + SR |
| L2 | Annonce à **chaque** bascule (hors no-op) | message = nom de la langue **dans la langue cible** (ex. « اللغة: العربية », « Langue : arabe », « Language: English ») | NVDA/VoiceOver |
| L3 | `aria-atomic="true"` | le message entier est relu | DOM |
| L4 | No-op (INV-11) **n'annonce pas** | clic langue active ⇒ silence | test SR + unit |
| L5 | Annonce posée **dans `apply()`** (avant la frame) | cohérent avec le flip dir/lang | unit (ordre des appels) |
| L6 | Couverture 100 % (K8) | toute bascule trackée a annoncé | compteur client + Playwright (live region mutée) |

---

## 5. Focus management après switch

| # | Exigence | Méthode de test |
|---|---|---|
| F1 | Après bascule, focus **revient au déclencheur** (trigger / pill / segment d'origine) | Playwright (document.activeElement) |
| F2 | Pas de **focus perdu** sur `<body>` après soft-nav | Playwright |
| F3 | Panneau fermé après sélection | Playwright |
| F4 | Pendant le fondu (VT/veil), aucun élément masqué ne capte le focus | manuel + test pointer-events veil |
| F5 | Ring de focus **visible** sur l'élément refocusé | axe + visuel |

---

## 6. Contrast (AA, viser AAA encre/crème)

| Paire | Couleurs (tokens) | Ratio attendu | Seuil | Méthode |
|---|---|---|---|---|
| Texte trigger / fond | `encre/80` (#2C2A28 @80%) sur crème `#FBF8F1` | viser **≥ 7:1** (AAA) | AA 4.5:1 | axe + contrast checker |
| Item actif / fond panneau | `encre` `#2C2A28` sur `creme/95` | **≥ 7:1** (AAA) | AA 4.5:1 | axe |
| Pill active : crème / encre | `#FBF8F1` sur `#2C2A28` | **≥ 7:1** (AAA) | AA 4.5:1 | axe |
| Pill inactive | `encre/60` sur crème | **≥ 4.5:1** (AA) | AA | axe (vérifier le 60% ne descend pas sous AA) |
| Chevron 60% / fond | `encre/60` sur crème | composant non-textuel ≥ **3:1** | 1.4.11 | axe |
| Point actif sauge / fond | `sauge` `#C5DBC4` — **marqueur** (non porteur seul d'info) | ≥ **3:1** UI component | 1.4.11 | axe + vérifier redondance (texte encre porte aussi l'état) |
| Focus ring encre / fonds | `#2C2A28` ring sur crème/page | ≥ **3:1** | 1.4.11 | axe |

> **Garde-fou couleur** : l'état actif n'est **jamais** porté **uniquement** par la couleur (le point sauge a un ratio faible). Il est **redondé** par `aria-checked`/`aria-pressed` + texte encre + position ⇒ conforme 1.4.1 (Use of Color).

---

## 7. Reduced-motion (INV-7)

| # | Exigence | Méthode de test |
|---|---|---|
| R1 | `prefers-reduced-motion: reduce` ⇒ bascule **instantanée**, aucune animation, **pas de reload** | Playwright (émule la media query) |
| R2 | View Transitions **désactivées** (`animation: none` sur `::view-transition-*`) | test CSS + Playwright |
| R3 | `LocaleVeil` **non monté** en reduced-motion | DOM |
| R4 | Chevron/panel/pills sans animation | Playwright |
| R5 | Event `locale_switch` avec `transition: 'reduced'` | interception event |
| R6 | Le flip RTL reste **atomique** (INV-2) même sans fondu | Playwright FR→AR reduced |

---

## 8. No-JS fallback (INV-8)

| # | Exigence | Méthode de test |
|---|---|---|
| N1 | `<noscript>` ou liens `<a hreflang>` natifs vers `/ar`, `/en`, `/fr` **fonctionnels** sans JS | Playwright JS désactivé |
| N2 | Navigation pleine ⇒ `dir/lang` posés **serveur** (corrects) | Playwright noscript /ar |
| N3 | `hreflang` alternates + `x-default=fr` présents (INV-9) | inspection HTML |
| N4 | Querystring/UTM préservés via `href` (INV-4) | inspection liens |
| N5 | Aucune dépendance JS pour **lire** la langue active | test noscript |

---

## 9. Screen-reader expected announcements (NVDA / VoiceOver)

| Action | Locale source → cible | NVDA (attendu) | VoiceOver (attendu) |
|---|---|---|---|
| Ouvrir le switcher | — | « Changer de langue, menu déroulant, réduit » → à l'ouverture « développé, Français coché » | « Change language, pop-up button » → « menu, Français selected » |
| Naviguer ↓ vers item AR | FR (panneau) | « العربية, élément de menu radio, non coché » (lu en arabe via `lang=ar`) | « العربية, radio button » |
| Sélectionner AR | FR → AR | live region : « اللغة: العربية » (polite) ; focus retour trigger « العربية, bouton » | live region annoncée ; focus trigger |
| Sélectionner langue **active** (no-op) | AR → AR | **silence** (aucune annonce) ; panneau fermé | **silence** |
| Pill EN (footer) | FR → EN | live : « Language: English » ; `aria-pressed=true` lu | live annoncée ; « English, selected » |
| Nudge apparaît | servi FR, nav AR | n'interrompt **pas** la lecture (polite, non focus-stealing) ; atteignable au Tab | idem |
| Dismiss nudge (✕) | — | « Ignorer, bouton » → activé ⇒ perle retirée | « Dismiss, button » |
| Reduced-motion switch | FR → AR | annonce identique, sans aucune transition perçue | idem |

| # | Exigence | Méthode de test |
|---|---|---|
| S1 | Endonymes lus dans la bonne langue (via `lang=`) | NVDA + VoiceOver manuel |
| S2 | État coché/pressé annoncé | SR manuel |
| S3 | Bascule annoncée (polite, non intrusive) | SR manuel |
| S4 | No-op silencieux (INV-11) | SR manuel |
| S5 | Nudge ne vole pas la lecture | SR manuel |

---

## 10. Récapitulatif — méthode de test par catégorie

| Catégorie | Outil principal | Complément |
|---|---|---|
| Roles/ARIA, contraste | **axe** (automatisé, intégré Playwright) | inspection DOM |
| Clavier | **Playwright** (séquences clavier) | passe **manuelle** clavier seul |
| aria-live / annonce | **Playwright** (mutation live region) + compteur K8 | **NVDA + VoiceOver** manuel |
| Focus management | **Playwright** (`activeElement`) | manuel |
| Reduced-motion | **Playwright** (émulation media) | — |
| No-JS | **Playwright** (JS off) | inspection HTML hreflang |
| SR announcements | **NVDA (Win) + VoiceOver (macOS/iOS)** | scénarios §9 |

## 11. Checklist finale (à cocher avant Done)

- [ ] A1–A9 roles/ARIA verts (axe 0 violation sur le switcher)
- [ ] K1–K6 clavier OK (auto + manuel), roving tabindex correct, pas de trappe
- [ ] L1–L6 annonce `aria-live` à chaque bascule, no-op silencieux (INV-10/INV-11)
- [ ] F1–F5 focus revient au déclencheur, jamais perdu
- [ ] Contraste AA partout, AAA encre/crème ; état actif non porté **seulement** par la couleur
- [ ] R1–R6 reduced-motion instantané, sans reload, flip atomique (INV-7/INV-2)
- [ ] N1–N5 sans-JS fonctionnel + hreflang/x-default (INV-8/INV-9)
- [ ] S1–S5 NVDA + VoiceOver conformes au tableau §9
- [ ] Focus ring **neutre** (encre), jamais sauge/marque
