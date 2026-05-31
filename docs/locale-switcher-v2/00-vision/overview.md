# 00 · Vision — Overview

> **Aspect couvert** : pourquoi ce chantier existe, ce qu'on vise idéalement, où s'arrête le périmètre.
> **Source de vérité** : [`../CONTRACT.md`](../CONTRACT.md). Tous les noms (`LocaleSwitcher`, `useLocaleTransition`, `LocaleVeil`, `LocaleNudge`, surfaces `header`/`drawer`/`footer`/`nudge`, events, INV-1..INV-12) s'y conforment.

---

## 1. Problem statement

Sur un trafic marocain **mixte FR/AR** (acquisition Meta/Instagram), la langue n'est pas un réglage : c'est le **premier signal de confort et de confiance** — donc un levier de conversion. La V1 a tranché juste sur le **placement** (dropdown header + pills drawer/footer) mais a assumé un **reload complet** à chaque bascule. Conséquences mesurables et qualitatives :

1. **Rupture brutale** — écran blanc + re-fetch + **perte de scroll** à chaque changement de langue. Sur un marché où la fluidité = signal premium, un reload qui « clignote » lit comme de l'amateurisme.
2. **RTL non géré sans reload** — `<html dir/lang>` est posé par un **script inline** au chargement du document. En soft-navigation next-intl, ce script n'est **pas ré-exécuté** ⇒ une page `/ar` s'afficherait en **LTR** (l'« entre-deux » glitch). Le reload était la parade.
3. **Découvrabilité passive** — un arabophone arrivé en FR doit **chercher** le switcher ; rien ne lui propose l'arabe. On laisse filer de la conversion arabophone (bounce dès le hero).
4. **Annonce SR perdue en soft-nav** — sans reload, le lecteur d'écran ne signale plus le changement de langue : il faut un `aria-live` explicite (INV-10).

**Énoncé** : *Comment changer de langue (FR/AR/EN, AR=RTL) partout — site client ET admin — sans reload, sans flash, sans saut de scroll, en gérant le retournement LTR↔RTL comme un geste « maison », tout en restant strictement neutre (charte) et non régressif ?*

---

## 2. Ambition

Un système **unique** — le « **voile de langue** » — qui transforme la bascule en **rituel discret** :

- **Une bascule = un fondu.** View Transitions API (~280 ms) + synchro impérative `dir/lang` + soft-nav next-intl. Fallback gracieux : voile `framer-motion` (`LocaleVeil`) ; puis application directe ; puis reload de secours hors-ligne. **Aucun état cassé** (INV-1, INV-12).
- **Le RTL est une chorégraphie**, pas un glitch : `dir` posé **dans** le callback de transition, avant la nouvelle frame ⇒ on ne voit jamais l'entre-deux LTR/RTL (INV-2).
- **Sobriété absolue** : switcher = **neutres uniquement** (encre/crème + point sauge ponctuel). Aucun pop chaud, **aucune pulse**, aucun drapeau, aucun emoji (CONTRACT §5). Il ne dispute **jamais** l'attention du CTA.
- **Découvrabilité récupérée sans intrusion** : `LocaleNudge` one-shot (perle ancrée au switcher), **1×/visiteur**, dismiss permanent — jamais une bannière, jamais une modale.
- **Mesurable** : chaque bascule trackée (`locale_switch`), nudge instrumenté ; A/B sur la forme et l'impact add-to-cart par langue.

**Critère de succès directionnel** : l'écart de conversion **AR vs FR se réduit** (voir [`goals-kpis.md`](goals-kpis.md)).

---

## 3. Scope (client website + admin)

### 3.1 In scope

**Client (website)**
- `LocaleSwitcher` enrichi sur **3 surfaces** : `header` (dropdown desktop), `drawer` (pills mobile), `footer` (pills, redondance).
- `useLocaleTransition` (hook cœur no-reload : VT + sync `dir/lang` + soft-nav + fallback `LocaleVeil` + reduced-motion).
- `LocaleVeil` (overlay fondu, fallback cross-browser).
- `LocaleNudge` (surface `nudge`, perle one-shot, résolu serveur sans flash).
- `aria-live` de bascule (INV-10), gestion focus, dégradation sans-JS (INV-8), reduced-motion (INV-7).
- Préservation scroll (INV-3), querystring/UTM (INV-4), hreflang/SEO (INV-9).

**Admin**
- Page `/admin/i18n` de pilotage : activer/désactiver une locale, éditer les **endonymes**, activer le nudge, **ordre** des locales, prévisualisation des surfaces.
- Derrière **permission** + **audit** (qui a changé quoi, quand).

**Backend**
- `GET /api/i18n/config` (lecture **publique cachée**, sans auth).
- `GET/PUT /api/admin/i18n/config` (écriture **admin-only + audit**).
- `resolveSuggestedLocale()` (résolution serveur `Accept-Language` pour le nudge, **sans flash**).
- Table `i18n_locale_config` (migration Drizzle).

**Data / Tests** — events analytics (CONTRACT §4), fixtures, et batterie Vitest/Playwright/MSW/axe + garde-fous de non-régression.

### 3.2 Boundaries dures (invariants de périmètre)

- Switcher **absent** sur `/admin/*` (chrome public) **et** pendant le wizard checkout CHA-231 (INV-5).
- **0 latin** sur `/ar` hors `FemiGlow` ; **0 fuite FR/EN** — scanners existants restent verts (INV-6).
- Feature flag `localeSwitcherV2` pilote l'activation.

---

## 4. Personas

| # | Persona | Contexte | Surface d'entrée probable | Attente clé | Échec V1 à corriger |
|---|---|---|---|---|---|
| **P1** | **Acheteuse FR (Rabat/Casa)** | Bilingue, navigue en FR par défaut, mobile Meta | `header` desktop / `drawer` mobile | Le switcher ne distrait **pas** du CTA ; bascule rare mais propre si besoin | Reload = rupture ; risque que le switcher vole l'œil |
| **P2** | **Acheteuse AR (arabophone)** | Lit l'arabe nativement, peut **arriver en FR** via une pub | `nudge` (perle) → `header` | Trouver l'arabe **sans effort**, RTL **propre**, contenu fluide (fluency = confiance) | Découvrabilité passive ; reload + RTL glitch ; pas de nudge |
| **P3** | **Diaspora EN** | Marocain·e de l'étranger / non-francophone | `footer` / `header` | `English` reconnaissable (endonyme), URLs partageables (`/en/...`) | Libellé code ISO cryptique ; URL non localisée |
| **P4** | **Utilisateur·rice a11y / clavier / SR** | Clavier seul, NVDA/VoiceOver, ou `prefers-reduced-motion` | `header` (roving tabindex) | Navigation clavier complète (↑↓ Home End Esc), **annonce** du changement, **bascule instantanée** si reduced-motion, fallback **sans-JS** | Annonce perdue en soft-nav (le reload l'assurait) ; animation imposée |

---

## 5. Conversion thesis

> **Lire dans sa langue maternelle = « ce site est pour moi ».** La fluidité de lecture (fluency / cognitive ease) fait juger le contenu **plus vrai et plus sûr**, ce qui réduit la friction d'un achat en **cash-on-delivery** (peu de réassurance disponible). Une bascule **fluide** signale la maîtrise (premium) ; un reload qui clignote signale l'amateurisme.

Donc le gain n'est **pas** « ajouter un bouton ». C'est : (a) l'arabophone arrivé en FR trouve l'arabe **sans effort** (nudge + placement) et bascule **sans rupture** (voile), et (b) cette bascule **renforce** la perception de soin au lieu de la casser. C'est là que se joue la conversion sur un trafic Meta marocain mixte FR/AR.

Hypothèses A/B portées par la vision (détail KPI en [`goals-kpis.md`](goals-kpis.md), §11 du dossier source) :
- **H1 — Forme** : toggle segmenté (variant A/B) vs dropdown ⇒ +découvrabilité **sans** dégrader l'add-to-cart FR.
- **H2 — Nudge** : `LocaleNudge` vs rien ⇒ ↑ bascule AR **et** ↑ add-to-cart AR, **sans** ↑ bounce.
- **H3 — Transition** : voile (no-reload) vs reload V1 ⇒ ↑ pages/session post-bascule, ↓ abandon au moment du switch.

---

## 6. Non-goals (hors périmètre, explicite)

| Non-goal | Raison |
|---|---|
| **Top-bar pleine largeur** au-dessus du header | Casse l'invariant Kolenda « 1 point focal / viewport » ; alourdit le hero. Rejeté (dossier §5, A2). |
| **FAB langue flottant** | Second FAB en conflit avec le launcher chat = bruit. Rejeté (A5). |
| **Modale « Choisissez votre langue »** au 1er load | Anti-pattern V1, casse le hero. Rejeté (D2). |
| **Bannière persistante** « Passer en arabe ? » | Intrusive, fatigue. Rejeté (D3). |
| **Swap de messages sans navigation (SPA totale)** | Casse l'URL localisée, hreflang, RSC server-localisés, formats prix/dates serveur. Incompatible archi RSC. Rejeté (C5). |
| **Drapeaux / emoji / couleur par langue** | Charte « maison » + INV charte (CONTRACT §5). Interdit. |
| **Pop chaud / pulse sur le switcher** | Vol d'attention au CTA. Interdit (CONTRACT §5). |
| **Ajout d'une 4ᵉ+ langue maintenant** | Hors lot ; le design reste extensible (≤ 4 options visibles) mais on livre **fr/ar/en**. |
| **Re-traduction de contenu non couvert** | Le chantier ne crée pas de nouveau contenu localisé ; il bascule entre l'existant. |
| **Détection IP / géoloc** | On s'appuie sur `Accept-Language` + cookie `NEXT_LOCALE` uniquement (pas de géoloc serveur). |
| **Persistance cross-device du choix** | Hors scope ; cookie `NEXT_LOCALE` (1 an) suffit. |

---

## 7. Fonctionnement optimal visé (résumé exécutable)

1. Au clic sur une **autre** langue : calcul URL cible (préserve querystring/UTM, INV-4).
2. Si VT dispo **et** pas reduced-motion ⇒ `document.startViewTransition(apply)`.
3. `apply()` : pose **d'abord** `html.lang`/`html.dir`, **annonce** (`aria-live`), **puis** `router.replace(url,{locale})` (soft-nav). Scroll préservé (INV-3).
4. Fondu charte ~280 ms `cubic-bezier(0.22,1,0.36,1)` ; en FR→AR le miroir RTL apparaît **dans** le fondu (INV-2).
5. Pas de VT ⇒ `LocaleVeil` (fade 160/160 ms). Reduced-motion ⇒ application **directe** (INV-7). Hors-ligne/erreur ⇒ reload de secours (INV-1 exception). Sans-JS ⇒ `<a hreflang>` (INV-8).
6. Clic sur langue **active** ⇒ no-op (INV-11). Config invalide/API down ⇒ valeurs par défaut (INV-12).

## 8. Éléments à vérifier (vue vision)

- [ ] Chaque persona P1–P4 a un chemin **heureux** ET un chemin **dégradé** couvert par un test.
- [ ] Aucun non-goal n'a fui dans l'implémentation (revue de scope vs §6).
- [ ] Tous les INV-1..INV-12 sont rattachés à au moins une exigence de cette vision et tracés dans la coverage-matrix.
- [ ] La thèse conversion est instrumentée (events CONTRACT §4 présents) avant tout A/B.
