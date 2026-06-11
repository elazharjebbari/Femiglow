# Sélecteur de langue — V2 « transition vivante »

> Dossier de réflexion UI/UX · Frontend · Design, niveau e-commerce premium.
> Objet : repenser **comment** et **où** introduire le changement de langue (FR / AR / EN) sur **toutes** les pages, pour **améliorer l'expérience** et **le taux de conversion**, avec une bascule **propre, élégante, sans rechargement ni rupture brutale**.
>
> Ancrages : charte FemiGlow (palette, typo, voix « maison »), `docs/kolenda/` (playbook + 8 guides), doc V1 `locale-switcher-ui.md`, et la réalité technique du projet (next-intl, `<html dir/lang>` posé par script inline au chargement).
>
> Statut : proposition de conception, prête à arbitrage. N'altère aucun code — sert de base d'implémentation.

---

## 0. Résumé exécutif

**Thèse.** Sur un site arabophone/francophone marocain, la langue n'est pas un réglage : c'est le **premier signal de confort et de confiance**, donc un **levier de conversion sous-estimé**. Un sélecteur mal placé ou une bascule brutale coûtent des arabophones qui rebondissent dès le hero. Mais — voix « maison » oblige — il ne doit **jamais voler l'attention du CTA** ni imposer une langue.

**La V1** (doc existant) a tranché juste sur le placement (dropdown header + pills) mais a délibérément choisi le **rechargement complet** comme compromis de robustesse. **La demande V2 lève cette contrainte** : bascule sans reload, fondu maîtrisé, y compris le retournement LTR↔RTL.

**Recommandation finale (détaillée §10).** Un système unique, baptisé **« le voile »** :

1. **Déclencheur** discret en header (endonyme `العربية / Français / English`, pas de code, pas de drapeau), **dédoublé** en pills dans le drawer mobile et le footer — placement déjà validé V1, qu'on **raffine** plutôt que de le réinventer.
2. **Transition sans reload** via **View Transitions API** (fondu croisé natif de ~280 ms) **+ synchronisation impérative de `dir/lang`** + **soft-navigation next-intl**. Fallback gracieux en `opacity` framer-motion sur navigateurs sans l'API. **Aucun flash, aucun saut de scroll, aucun reload.**
3. **Chorégraphie RTL** dédiée : le retournement de direction est traité comme un *geste* (le contenu « se replie » et « se redéploie » dans l'autre sens en < 320 ms), pas comme un glitch.
4. **Nudge contextuel one-shot** (et non bannière) : si la langue du navigateur ≠ langue servie, un **liseré discret** propose la bascule **une seule fois**, dismiss permanent. Conforme à l'anti-objectif V1 « ne pas pousser », mais récupère la conversion arabophone perdue.
5. **Mesure** : chaque bascule est trackée (source, from→to, page) ; A/B sur la découvrabilité et l'impact sur le taux d'ajout au panier par langue.

Le tout en **sobriété charte** : mouvements 280–560 ms, courbes douces, zéro emoji/drapeau, neutres dominants.

---

## 1. Pourquoi rouvrir le sujet — de V1 à V2

| Dimension | V1 (acté) | Demande V2 | Conséquence |
|---|---|---|---|
| Placement | Dropdown header + pills footer/drawer | À **raffiner**, pas casser | On capitalise sur l'acquis |
| Libellé | Code `FR/AR/EN` | (déjà migré en **endonyme** en prod : `العربية`) | Aligner le doc sur le code réel |
| Bascule | **Reload complet** assumé | **Sans reload, élégante** | Cœur du dossier (§7, §10) |
| Détection | « ne rien pousser » | Nudge **non intrusif** autorisé | Gain conversion arabophone (§8) |
| Mesure | Tests utilisateurs | + **télémétrie + A/B** | Boucle d'optimisation (§11) |

**Pourquoi la V1 a choisi le reload.** Le `<html dir>`/`<html lang>` est posé par un **script inline** dans `app/[locale]/layout.tsx`, exécuté **au chargement du document**. En soft-navigation (next-intl `router.replace`), React re-rend le `<script>` mais **le navigateur ne le ré-exécute pas** → sur un FR→AR sans reload, la **direction ne basculerait pas** (page arabe affichée en LTR). Le reload était la parade simple. **V2 résout ce point de tête** (§7.3, §10.3) par une synchro `dir/lang` impérative côté client.

---

## 2. Contraintes & invariants (non négociables)

**Charte (mémoire projet + playbook §2).**
- Palette 60-30-10 : **neutres dominants** (ivoire `#FBF8F1`, sable), **marque** (sauge `#C5DBC4`, pétale `#F2CECC`), **pops fonctionnels** réservés (CTA, prix). Le switcher vit dans les **neutres** — il ne consomme **aucun** budget « pop ».
- Typo : Pinyon (wordmark only), **Cormorant** (titres), **Inter** (UI). Le switcher = Inter, casse normale, `tracking` mesuré.
- Voix « maison » : **aucun emoji, aucun drapeau, aucune urgence**, sobriété, lenteur.
- Motion (Luxury §7, playbook §2.4) : **400–600 ms**, courbes douces, **jamais < 200 ms** (snappy = stressant). On bornera nos transitions à **280–560 ms**.

**RTL (doc `rtl-support.md`).** Tout doit être **mirror-safe** : propriétés logiques (`start/end`, `ms-/me-`), jamais `left/right` physiques sur le switcher.

**Technique.**
- next-intl : routing `[locale]`, cookie `NEXT_LOCALE` (1 an), `router.replace(pathname,{locale})` = soft-nav.
- `framer-motion` ^11 **présent**. View Transitions API **native** (Chrome/Edge/Safari TP ; fallback requis Firefox).
- Le switcher est **caché** sur `/admin/*` et pendant le **wizard checkout** (contrat CHA-231) — invariant conservé.

**Kolenda — garde-fous spécifiques au switcher (synthèse playbook).**
- *Attention §1, §2 + UX §4* : **un seul point focal par viewport**. Le switcher **ne doit pas** rivaliser avec le CTA → il reste **neutre, sans pop chaud, sans pulse**.
- *Color §5* : neutres + pops fonctionnels → le switcher = neutre.
- *UX §10 / §1* : tap target ≥ 44 px ; ≤ 4 options visibles d'un coup (3 langues ✓).
- *Anti-patterns V1 §13* : pas de drapeau, pas de globe sans label, pas de modale « choisissez votre langue », pas de couleur par langue.

---

## 3. La langue comme levier de conversion (cadre Kolenda appliqué)

Pourquoi traiter un sélecteur de langue comme un sujet de **conversion** et pas de simple « réglage » :

| Mécanisme Kolenda | Lecture « langue » | Effet conversion |
|---|---|---|
| **Self-relevance** (Attention §10) | Lire dans sa langue maternelle = « ce site est pour moi ». | ↓ bounce, ↑ temps passé, ↑ confiance |
| **Fluency / cognitive ease** (UX, Copywriting) | Le contenu fluide est jugé **plus vrai et plus sûr** → réduit la friction d'un achat en *cash-on-delivery* (peu de réassurance). | ↑ intention d'achat |
| **Trust & luxe discret** (Luxury §2) | Une bascule **fluide** = signal de maîtrise/qualité ; un reload qui « clignote » = signal d'amateurisme. | ↑ perception premium |
| **Friction & charge cognitive** (UX §1, §4) | Un switcher **trouvable en < 3 s** mais **discret** évite l'hésitation sans détourner du CTA. | neutre→positif sur le CTA |
| **Direction & geste** (Attention §12, Luxury §7) | Une transition *lente et orientée* respecte la voix « rituel ». | cohérence de marque |

**Corollaire stratégique.** Le gain n'est pas « ajouter un bouton » ; c'est (a) que **l'arabophone arrivé en FR** trouve l'arabe **sans effort** et bascule **sans rupture**, et (b) que cette bascule **renforce** la perception de soin plutôt que de la casser. C'est exactement là que se joue la conversion sur un trafic Meta/Instagram marocain mixte FR/AR.

---

## 4. Anatomie d'un switcher : les 6 décisions

Tout sélecteur de langue se ramène à **6 décisions** indépendantes. On les analyse une par une (§5–§8), puis on les recompose (§10).

1. **Surface & placement** — header ? footer ? barre fine ? contextuel ? (→ §5)
2. **Forme & affordance** — dropdown / toggle segmenté / pills / select natif (→ §6)
3. **Libellé** — code `AR` vs **endonyme** `العربية` vs drapeau (tranché : endonyme).
4. **Transition** — reload vs soft-nav vs View Transitions vs swap sans navigation (→ §7, **cœur**).
5. **Détection & nudge** — rien / bannière / nudge one-shot (→ §8).
6. **Persistance & URL** — cookie + URL localisée + préservation querystring (tranché V1 §10, conservé).

---

## 5. Analyse comparative A — Surface & placement

| Option | Description | Découvrabilité | Charte / sobriété | Conversion | Risque | Verdict |
|---|---|---|---|---|---|---|
| **A1. Header (dropdown)** | À droite de la nav, avant le panier | ★★★★☆ | ★★★★★ | neutre+ | faible | **Retenu (desktop)** |
| **A2. Barre fine « top-bar »** pleine largeur au-dessus du header | Style compagnies aériennes | ★★★★★ | ★★☆☆☆ (ajoute une strate, alourdit le hero) | risque de voler le 1er viewport | moyen | Rejeté (casse l'invariant « 1 focal/viewport ») |
| **A3. Footer seul** | Pills en pied | ★☆☆☆☆ (sous le fold) | ★★★★★ | ↓ (arabophone parti avant) | élevé | Rejeté seul ; gardé en **redondance** |
| **A4. Drawer mobile (haut)** | Pills en tête du menu hamburger | ★★★★☆ | ★★★★★ | neutre+ | faible | **Retenu (mobile)** |
| **A5. FAB contextuel** | Bouton flottant dédié langue | ★★★☆☆ | ★☆☆☆☆ (2e FAB en plus du chat = bruit) | — | élevé | Rejeté (conflit avec le launcher chat) |

**Lecture.** Le combo **header (desktop) + drawer (mobile) + footer (redondance)** de la V1 reste **optimal** : trouvable au-dessus du fold, sans strate supplémentaire, sans concurrencer le CTA. La **top-bar** (A2), tentante pour la découvrabilité, est **disqualifiée par Kolenda** (elle crée un second point d'entrée visuel dans le viewport le plus précieux). On **garde A1+A4+A3-redondance** et on investit l'effort sur la **forme** et la **transition**.

---

## 6. Analyse comparative B — Forme & affordance

| Option | Aperçu | Pour | Contre | Charte |
|---|---|---|---|---|
| **B1. Dropdown endonyme** (état actuel raffiné) | `العربية ▾` → panneau 3 endonymes | Sobre, extensible, pattern connu, riche (marqueur actif) | Demande un état client | ★★★★★ |
| **B2. Toggle segmenté inline** | `[ FR · AR · EN ]` segmenté, l'actif en sauge | État **toujours visible** (0 clic pour voir les options), très « produit premium » | Prend + de largeur ; 3 scripts mêlés (latin+arabe) à équilibrer typographiquement | ★★★★☆ |
| **B3. Pills** (V1 mobile/footer) | 3 boutons, actif plein | Tap targets, lisible | Largeur ; saturé > 4 langues | ★★★★☆ |
| **B4. Select natif** | `<select>` OS | Zéro JS, a11y native | Style cross-OS inégal, casse l'éditorial, **pas de transition custom** | ★★☆☆☆ |

**Recommandation de forme.**
- **Desktop : B1 (dropdown endonyme)**, déjà en place — on le **raffine** (cf. §10.2 : micro-typo, point de langue active, alignement RTL).
- **Mobile (drawer) & footer : B3 (pills)** — tap-friendly, état visible.
- **Variante d'A/B test** : tester **B2 (toggle segmenté)** en header desktop contre B1. Le toggle « tout visible » peut **améliorer la découvrabilité** (l'arabophone voit `AR` sans cliquer) — au prix d'un peu de largeur. Hypothèse mesurable (§11).

> **Sur le libellé** : endonyme dans la **propre écriture** de chaque langue (`العربية`, `Français`, `English`). C'est le choix le plus **accessible** (langue présentée dans sa langue), le plus **respectueux** (pas de drapeau = pas de raccourci nation↔langue), et il **élimine le latin `AR`** sur les pages arabes (cohérent avec la règle « zéro latin sauf FemiGlow »).

---

## 7. Analyse comparative C — La transition (cœur de la demande)

Objectif : **changer la langue sans reload, sans flash, sans saut de scroll, en gérant le retournement RTL** — et que ça **ressemble à un geste**, pas à un glitch.

### 7.1 Option C1 — Reload complet (V1)
`window.location.assign('/ar/kit')`.
- ✅ Robuste : tous les RSC réévalués, `dir/lang` corrects.
- ❌ **Écran blanc + re-fetch + perte de scroll** = exactement la « rupture brutale » que la demande veut supprimer.
- **Verdict : rejeté pour V2** (gardé comme fallback ultime hors-ligne/erreur).

### 7.2 Option C2 — Soft-navigation seule (next-intl)
`router.replace(pathname,{locale})`.
- ✅ Pas d'écran blanc, scroll préservé, RSC re-rendus serveur.
- ❌ **`dir/lang` ne basculent pas** (script inline non ré-exécuté) → page AR en LTR. ❌ Le swap de contenu est **instantané et sec** (pas de fondu) → ressenti « brutal ».
- **Verdict : insuffisant seul.** C'est la **base** à enrober.

### 7.3 Option C3 — View Transitions API + synchro `dir/lang` (recommandé)
On enveloppe la soft-nav dans `document.startViewTransition()`, et on **synchronise `dir/lang` impérativement** dans le callback, **avant** le rendu de la nouvelle frame.

```ts
function switchLocale(next: Locale) {
  const url = buildSwitchUrl(pathname, search, next); // V1 §10.3
  const apply = () => {
    document.documentElement.lang = next;
    document.documentElement.dir = DIRECTION[next]; // 'rtl' | 'ltr'
    router.replace(url, { locale: next });           // soft-nav next-intl
  };
  if (!document.startViewTransition || prefersReducedMotion()) {
    apply(); return;                                  // fallback gracieux
  }
  document.startViewTransition(apply);                // fondu croisé natif
}
```

- ✅ **Fondu croisé natif** (~280 ms) sur tout le document → aucune rupture.
- ✅ **`dir/lang` corrects immédiatement** → RTL géré.
- ✅ Scroll préservé, pas de reload, pas de flash.
- ✅ Personnalisable en CSS (`::view-transition-old/new(root)`) → on **choisit la courbe** charte.
- ⚠️ Support : Chromium + Safari récents. **Firefox** → fallback C4 (framer) ou swap direct.
- **Verdict : socle de la proposition (§10.3).**

### 7.4 Option C4 — Fondu piloté framer-motion (fallback / navigateurs sans VT)
Overlay `motion.div` (voile ivoire) qui **monte en opacité** (180 ms) → on applique `dir/lang` + soft-nav **derrière le voile** → on **redescend l'opacité** (180 ms).
- ✅ Marche **partout** (framer présent), contrôle total de la courbe.
- ✅ Le « voile » devient une **signature de marque** (le rituel du changement de langue).
- ⚠️ Un peu plus de code qu'C3 ; gère le timing manuellement.
- **Verdict : fallback de C3** (et fallback unique si on veut un rendu **identique cross-browser**).

### 7.5 Option C5 — Swap de messages **sans navigation** (SPA totale)
Garder l'URL `[locale]` mais injecter les messages de la nouvelle langue côté client sans changer de route.
- ✅ Le plus « instantané ».
- ❌ **Casse l'URL localisée** (SEO hreflang, partage de lien, RSC server-localisés, prix/dates formatés serveur). ❌ Incompatible avec l'archi RSC localisée du projet (beaucoup de contenu vient du serveur par locale).
- **Verdict : rejeté** (gain marginal, coût architectural et SEO majeur).

### 7.6 Synthèse transition

| Critère | C1 reload | C2 soft seul | **C3 VT+sync** | C4 framer | C5 swap |
|---|---|---|---|---|---|
| Sans rupture | ✗ | △ (sec) | **✓✓** | ✓ | ✓✓ |
| `dir/lang` RTL | ✓ | ✗ | **✓** | ✓ | ✓ |
| Scroll préservé | ✗ | ✓ | **✓** | ✓ | ✓ |
| SEO / URL localisée | ✓ | ✓ | **✓** | ✓ | ✗ |
| Cross-browser | ✓ | ✓ | △ (fallback) | **✓** | ✓ |
| Élégance / signature | ✗ | ✗ | **✓** | **✓✓** | ✓ |
| Effort | XS | XS | **S** | S/M | XL |

→ **C3 (View Transitions + synchro `dir/lang`) avec C4 (voile framer) en fallback.** Meilleure élégance pour un effort raisonnable, sans rien sacrifier au SEO/RTL.

---

## 8. Analyse comparative D — Détection & nudge (sans intrusion)

La V1 interdisait toute bannière « Speak English? ». **On respecte l'esprit** (ne pas pousser, ne pas interrompre) **mais** on récupère la conversion arabophone perdue par un **nudge minimal**.

| Option | Description | Intrusion | Conversion | Verdict |
|---|---|---|---|---|
| **D1. Rien** | On laisse le visiteur trouver le switcher | nulle | laisse filer des arabophones arrivés en FR | base |
| **D2. Modale plein écran** | « Choisissez votre langue » au 1er load | **forte** | ✗ casse le hero | **Rejeté** (anti-pattern V1) |
| **D3. Bannière persistante** | Bandeau haut « Passer en arabe ? » | moyenne | ambigu, fatigue | Rejeté |
| **D4. Nudge contextuel one-shot** | Si `Accept-Language`/cookie indique AR mais page servie en FR : un **liseré discret** près du switcher, **une fois**, dismiss permanent (cookie) | **faible** | **récupère** sans agresser | **Retenu** |

**Design du D4.** Pas une bannière : une **« perle » ancrée au switcher** (petit point sauge + micro-label `بالعربية ؟`), apparition douce 1×/visiteur, disparaît au clic (bascule) **ou** au dismiss (jamais re-montrée). Respecte « ne pas pousser » (un seul signal, dismiss définitif) tout en offrant le raccourci. Mesurable (§11).

---

## 9. Matrices de scoring (synthèse pondérée)

Pondération orientée e-commerce premium : Conversion ×3, Charte/sobriété ×3, Découvrabilité ×2, A11y ×2, Effort ×1 (inversé), Risque ×1 (inversé). Échelle 1–5.

### 9.1 Placement
| Option | Conv ×3 | Charte ×3 | Découv ×2 | A11y ×2 | Effort⁻¹ | Risque⁻¹ | **Total** |
|---|---|---|---|---|---|---|---|
| **Header + drawer + footer (A1+A4+A3)** | 4 | 5 | 4 | 5 | 5 | 5 | **65** |
| Top-bar (A2) | 4 | 2 | 5 | 4 | 4 | 3 | 49 |
| Footer seul (A3) | 2 | 5 | 1 | 4 | 5 | 3 | 43 |

### 9.2 Forme
| Option | Conv ×3 | Charte ×3 | Découv ×2 | A11y ×2 | Effort⁻¹ | Risque⁻¹ | **Total** |
|---|---|---|---|---|---|---|---|
| **Dropdown endonyme (B1)** | 4 | 5 | 4 | 5 | 5 | 5 | **65** |
| Toggle segmenté (B2) | 5 | 4 | 5 | 4 | 4 | 4 | **63** ← *candidat A/B* |
| Pills (B3) | 4 | 4 | 4 | 5 | 5 | 5 | 61 |
| Select natif (B4) | 3 | 2 | 4 | 5 | 5 | 4 | 49 |

### 9.3 Transition
| Option | Conv ×3 | Charte ×3 | Découv n/a | A11y ×2 | Effort⁻¹ | Risque⁻¹ | **Total** |
|---|---|---|---|---|---|---|---|
| **C3 VT + sync (+C4 fallback)** | 5 | 5 | – | 5 | 4 | 4 | **58** |
| C4 framer voile seul | 4 | 5 | – | 5 | 4 | 5 | 55 |
| C2 soft seul | 2 | 2 | – | 3 | 5 | 3 | 35 |
| C1 reload | 1 | 2 | – | 4 | 5 | 5 | 33 |

**Conclusion chiffrée** : placement V1 confirmé, **dropdown endonyme** en tête (toggle segmenté en sérieux challenger A/B), **C3+C4** nettement devant pour la transition.

---

## 10. Proposition finale — « Le voile de langue »

Système unique, un composant `LocaleSwitcher` (déjà existant) **enrichi**, plus un hook de transition `useLocaleTransition`.

### 10.1 Placement (inchangé V1, raffiné)
- **Desktop** : header, entre nav et panier, propriété logique `me-*`.
- **Mobile** : pills en tête du drawer (sous le wordmark).
- **Footer** : pills (redondance, découvrabilité de secours).
- **Caché** sur `/admin/*` et wizard checkout.

### 10.2 Forme (specs charte)
**Déclencheur desktop (dropdown)** :
- Libellé = **endonyme** de la langue active (`العربية` sur /ar) — Inter, `text-xs`, `tracking-[0.08em]`, `text-encre/80`, soulignement discret `decoration-encre/40 underline-offset-4`.
- Chevron 12 px, opacité 60 %, rotation 180° à l'ouverture (**200 ms ease-out**).
- Panneau : `bg-creme/95 backdrop-blur border-encre/10 rounded` ; alignement **logique** `end-0` (RTL-safe) ; ombre `shadow-sm`.
- Items : endonymes en **Cormorant italic** (signal « langue », fidèle au playbook §Fonts) ; actif = `text-encre` + **point sauge** `end`-aligné ; hover `bg-encre/[0.04]`.
- Ouverture : `opacity 0→1` + `translateY(-4px→0)` en **180 ms ease-out** ; respect `prefers-reduced-motion`.

**Pills (mobile/footer)** :
- Items ≥ 44×44, endonyme court ; actif `bg-encre text-creme rounded`, inactif `text-encre/60`.
- `transition-colors 200ms`.

**Couleurs** : strictement **neutres** (encre/crème/sauge en accent ponctuel). **Aucun pop chaud, aucune pulse** — le switcher ne dispute jamais l'attention du CTA (Attention §1, Color §5).

### 10.3 Chorégraphie de transition (le cœur)
1. Au clic langue : calcul de l'URL cible (préserve querystring/UTM — V1 §10.3).
2. **Si View Transitions + pas de reduced-motion** → `document.startViewTransition(apply)`.
3. `apply()` synchronise **d'abord** `document.documentElement.lang/dir`, **puis** `router.replace(url,{locale})` (soft-nav).
4. CSS de transition charte (courbe douce, ~280 ms) :
```css
::view-transition-old(root),
::view-transition-new(root) { animation-duration: 280ms; animation-timing-function: cubic-bezier(0.22,1,0.36,1); }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),::view-transition-new(root){ animation: none; }
}
```
5. **Fallback** (Firefox / pas d'API) → **voile framer** : overlay ivoire `motion.div` opacity `0→1` (160 ms) → `apply()` → `1→0` (160 ms). Même ressenti, cross-browser.
6. **Reduced-motion** → application directe (aucune animation), toujours sans reload.

**Résultat** : la page **fond** doucement d'une langue à l'autre ; en FR→AR, la **direction se retourne dans le même fondu** ; le scroll reste ; aucun écran blanc. La bascule devient un **geste « maison »**, pas une coupure.

> **Détail RTL** : comme `dir` est posé **dans** le callback (avant la nouvelle frame), le fondu croisé montre directement la mise en miroir — on ne voit jamais l'« entre-deux » LTR/RTL. C'est ce qui distingue une bascule *premium* d'un glitch.

### 10.4 Nudge contextuel one-shot (D4)
- Condition : `cookie NEXT_LOCALE` absent **et** `Accept-Language` primaire ≠ locale servie (résolu **côté serveur**, pas de flash).
- Rendu : micro-« perle » ancrée au switcher (`بالعربية ؟` / `In English?`), apparition `opacity` 300 ms, **1×/visiteur**.
- Dismiss (clic ✕ ou bascule) → cookie `locale_nudge_dismissed` → **jamais ré-affiché**.
- Jamais sur le wizard, jamais en modale.

### 10.5 Accessibilité (reprend V1 §7, complété)
- `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `aria-label` localisé.
- Clavier complet (↑↓ Home End Esc, roving tabindex) — déjà implémenté.
- **Annonce du changement** : comme le reload natif disparaît, ajouter un `aria-live="polite"` discret (« Langue : arabe » / « اللغة: العربية ») au switch — sinon le lecteur d'écran ne signale pas la bascule en soft-nav. **Point neuf vs V1** (qui comptait sur le reload pour l'annonce).
- Focus : après bascule, focus géré (retour au déclencheur), pas de focus perdu.
- Contrastes AAA (encre/crème), `focus-visible:ring` encre.

### 10.6 Edge cases
| Cas | Comportement |
|---|---|
| Clic langue active | No-op, ferme le panneau, **pas** de transition |
| Hors-ligne / erreur soft-nav | Fallback `window.location.assign` (reload) + éventuel toast |
| Page non traduite en cible | 404 localisée avec switcher de retour |
| Reduced-motion | Bascule directe, sans animation, sans reload |
| Sans JS | `<noscript>` : liens `<a hreflang>` vers `/ar`,`/en` (dégradation gracieuse + SEO) |
| 1 seule locale active | Composant rendu `null` |

---

## 11. Mesure & A/B

**Télémétrie (events).**
- `locale_switch` : `{ from, to, surface: 'header'|'drawer'|'footer'|'nudge', page, transition: 'vt'|'veil'|'reduced'|'reload' }` (cf. `CONTRACT.md` §4, qui fait foi).
- `locale_nudge_shown` / `locale_nudge_dismissed` / `locale_nudge_accepted`.

**Hypothèses A/B testables.**
1. **H1 — Forme** : toggle segmenté (B2) vs dropdown (B1) → +découvrabilité, mesurée par `locale_switch` / sessions AR-capable, **sans** dégrader l'`add_to_cart` FR.
2. **H2 — Nudge** : D4 vs rien → ↑ taux de bascule AR **et** ↑ `add_to_cart` sur sessions arabophones, **sans** ↑ bounce.
3. **H3 — Transition** : C3/C4 (sans reload) vs C1 (reload) → ↑ pages/session après bascule, ↓ abandon au moment du switch.

**KPI nord** : *taux d'ajout au panier par langue servie* et *taux de complétion du wizard par langue*. La V2 réussit si l'écart de conversion AR vs FR **se réduit**.

---

## 12. Roadmap d'implémentation (P0 → P2) + garde-fous

| Prio | Lot | Effort | Contenu |
|---|---|---|---|
| **P0** | `useLocaleTransition` (C3+C4) | S | Hook : VT + sync `dir/lang` + soft-nav + fallback voile + reduced-motion. Branche le `LocaleSwitcher` existant dessus. |
| **P0** | `aria-live` de bascule | XS | Annonce SR (remplace l'annonce perdue du reload). |
| **P0** | CSS `::view-transition` charte | XS | Courbe douce 280 ms + reduced-motion. |
| **P1** | Nudge D4 (résolu serveur) | S | Détection `Accept-Language`, perle one-shot, cookies dismiss. |
| **P1** | Endonymes Cormorant italic dans le panneau | XS | Raffinement typo (déjà endonyme en prod). |
| **P1** | Télémétrie `locale_switch` | XS | Events + dashboard langue. |
| **P2** | A/B B1 vs B2 (toggle) | M | Flag + variantes + lecture KPI. |
| **P2** | Tests Playwright RTL no-reload + a11y axe | M | Garde-fous régression. |

**Garde-fous.**
- **Aucune régression wizard** (switcher caché) — contrat CHA-231.
- **Aucun pop chaud / pulse** sur le switcher (invariant Kolenda).
- **SEO** : `<link rel="alternate" hreflang>` conservés ; URLs localisées intactes (C3/C4 ne touchent pas l'URL hreflang).
- **Perf** : VT/fallback purement client, **0 octet** ajouté au RSC ; pas de lib supplémentaire (framer déjà présent).
- **Reduced-motion** et **sans-JS** : toujours fonctionnels.

---

## 13. Annexes

### A. Recette URL-switch (rappel V1 §10.3, conservée)
Préserve le querystring/UTM, remplace ou insère le segment locale.

### B. Pseudo-code complet du hook
```ts
// useLocaleTransition.ts (esquisse)
const DIRECTION = { fr: 'ltr', en: 'ltr', ar: 'rtl' } as const;

export function useLocaleTransition() {
  const router = useRouter();        // @/i18n/navigation
  const pathname = useRawPathname();
  const search = useSearchParams();

  return (next: Locale) => {
    if (next === currentLocale) return;            // no-op
    const url = buildSwitchUrl(pathname, search, next);
    const apply = () => {
      const html = document.documentElement;
      html.lang = next; html.dir = DIRECTION[next];
      announce(next);                              // aria-live
      router.replace(url, { locale: next });
    };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return apply();
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(apply);  // C3
    } else {
      runVeilFallback(apply);                        // C4 framer
    }
  };
}
```

### C. Cookie & SEO (inchangés V1)
`NEXT_LOCALE` (next-intl), `hreflang` alternates, `x-default = fr`.

### D. Liens internes
`locale-switcher-ui.md` (V1), `rtl-support.md`, `typography.md`, `wizard-i18n.md`, `02-design-conception/locale-detection.md`, `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`.

### E. Principes Kolenda appliqués au switcher (synthèse sourcée)

Extraits ciblés des guides `docs/kolenda/{Attention,UX,Ecommerce,Luxury,Color,Pricing}.pdf`, mappés « principe → application switcher ». **Chaque ligne valide une décision du dossier.**

**Attention & hiérarchie**
- *Attention sélective* (Attention) → la plupart des visiteurs n'ouvriront jamais le switcher : **trouvable, pas proéminent**. Valide §5/§10.
- *« Color is the most salient dimension »* (Attention) → **pas de couleur marque saturée** sur le switcher, elle est réservée au CTA. Valide §10.2 (neutres).
- *Goal-directed search rend aveugle au non-pertinent* (Attention) → un switcher discret **ne distrait pas** l'acheteuse. Valide « zéro pop/pulse ».
- *Motion onset / pulse capte l'œil* (Attention) → **jamais d'animation/pulse** sur le switcher ; le mouvement appartient au CTA. Valide §2/§10.2.
- *Visual entry point unique* (UX) → le CTA hero est le point focal ; le switcher **sous** lui dans la hiérarchie. Valide rejet top-bar (§5).

**Friction & charge cognitive**
- *« Show 4 options or fewer »* (UX) → 3 langues = idéal. Valide §4.
- *« Don't make them think »* → **endonymes** (reconnaître, pas décoder), pas de code ISO seul. Valide §6 (endonyme) + alerte « cryptic ISO labels ».
- *Match expectations / fluency* (UX) → switcher **là où on l'attend** (coin header, **miroir en RTL**). Valide §5/§10.
- *« Depict changes without disrupting » / éviter reload brutal* (UX) → **bascule en place, même route**, pas de redirect accueil. Valide §7 (no-reload).
- *Skeleton > blank, démarrer le progrès > 0, teintes froides* (UX) → **jamais de flash blanc** au switch. Valide voile ivoire C4 + reduced-motion.
- *Feedback de l'état actif + zones cliquables ≥ 40 px* (UX) → marqueur d'actif clair, pills ≥ 44 px. Valide §10.2/§10.5.
- *« Show primary essence upon loading » (anti-FOUC)* (UX) → rendre la cible **immédiatement** traduite (pas de flash de l'ancienne langue). Valide synchro `dir/lang` **dans** le callback (§10.3).

**Trust & luxe**
- *« Long fade animations » sur les sites luxe* (Luxury) → **fondu lent et doux** plutôt qu'un swap sec. Valide C3/C4.
- *« Avoid emojis / flags / friendliness backfires »* (Luxury) → **pas de drapeau**, ton retenu. Valide §6.
- *Espace généreux = valeur ; éviter l'UI tassée* (Luxury) → respiration autour du switcher.
- *« Limit black to small body text », mélanger neutres + marque, pops réservés* (Color) → texte switcher en **encre douce**, pop = CTA only. Valide §10.2.

**E-commerce & RTL**
- *Bordure haute marquée du header* (Ecommerce) → ancrer le header (où vit le switcher). 
- *Directionnalité de lecture → 1re fixation ; CTA et entrée visuelle basculent à droite en RTL* (Ecommerce/Pricing) → **miroir complet** header + switcher + CTA. Valide §2/§10 (propriétés logiques).
- *Boutons plus « cliquables » côté main dominante ; ne pas mettre le switcher dans le chemin du pouce/CTA* (Pricing) → switcher **hors** zone d'action. Valide §5 (coin opposé).

**Red flags Kolenda — tous neutralisés par la proposition** : drapeaux-langues ✗, reload/redirect brutal ✗, switcher enterré ✗, > 4 choix ✗, vol d'attention au CTA ✗, codage noir/rouge de l'actif ✗, FOUC/flash ✗, libellés ISO cryptiques ✗, oubli du miroir RTL ✗.

---

### Note de design (signature)
La bascule de langue n'est pas un réglage technique : c'est le **premier rituel** que la maison offre à une initiée arabophone ou anglophone. Qu'elle soit **douce, orientée, sans rupture** — un voile qui se lève — est parfaitement cohérent avec *« Hermès qui chuchote »*. C'est cette cohérence qui, sur ce marché, transforme un visiteur hésitant en commande.
