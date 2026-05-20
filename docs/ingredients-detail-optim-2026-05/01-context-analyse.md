# 01 — Contexte & analyse

## 1. État actuel

### 1.1 Composant cible

`apps/web/src/components/sections/IngredientsDetails.tsx` (57 lignes) +
`apps/web/src/components/commerce/IngredientsTable.tsx` (60 lignes).

Rendu actuel pour chaque sous-produit (×3 : Paste, Powder, Polissoir) :

```
<figure>
  <figcaption>1 Paste — 15 g</figcaption>
  <div role="region" aria-label="…" tabindex=0 overflow-x-auto>
    <table border-collapse w-full text-sm>
      <thead bg-sauge-soft>
        <tr> Ingrédient | INCI | Fonction | Origine | % </tr>
      </thead>
      <tbody divide-y divide-encre/10>
        <tr> … 3 lignes typiques … </tr>
      </tbody>
    </table>
  </div>
  <ul aria-label="Certifications">
    <li chips champagne>Cosmos Organic — Ecocert</li>
    …
  </ul>
</figure>
```

### 1.2 Position dans le funnel `/kit`

```
[Hero] → [Wizard] → [Composition 3 cards] → [Vidéo Les gestes]
                                                    ↓
                                          ▶ Le détail (INCI) ◀  TOI
                                                    ↓
                  [Feed produit] → [Wizard ×2] → [Comparatif] → …
```

**Rôle** : transition rationnelle entre le pivot émotionnel (vidéo) et la
zone de comparaison (vs vernis classique). Permet à la cliente de
**dé-risquer** l'achat — vérifier que la maison ne ment pas, lire les
origines, compter les certifications, puis redescendre vers la décision.

### 1.3 Données existantes

`SubProduct` actuel (`lib/schemas/product.ts`) :

| Champ | Type | Statut |
|---|---|---|
| `id`, `name`, `shortDescription`, `volume`, `image` | requis | OK |
| `ingredients[]` (chacun : `name`, `inci`, `function`, `origin`, `concentrationPct?`, `description?`) | requis | OK |
| `certifications[]` (label + body) | requis | OK |
| `sensation`, `contextualImage`, `accentColor` | optionnels | OK (refonte composition phase 1) |

**Constat** : `Ingredient.description` existe mais n'est **pas affiché** par
`IngredientsTable`. Il sera réutilisé pour l'intro narrative en phase 1.

## 2. Lecture Kolenda

### 2.1 Section dédiée — §4.5 Le détail (INCI)

**Objectif** : prouver la qualité de la formulation et le sérieux du
laboratoire **sans dénaturer la voix émotionnelle**.

**Principes activés** :

| Principe | Source | Application attendue |
|---|---|---|
| Luxury §6 — Savoir-faire artisanal | p. 17 | Intro narrative voix maison « 12 % de cire fondue à basse T° par la coopérative apicole du Moyen Atlas. Une noisette filme dix doigts. » |
| Copywriting §14 — Pas de science lourde | p. 51 | Bannir le jargon non-décodé. Mot « biologiste » réservé à `/maison`. |
| UX §7 — Hide unnecessary | p. 53-54 | Accordion INCI replié par défaut sur mobile, tooltip sur termes techniques |
| Color §6, §7 — Gris-sauge + encre | p. 18 | Lignes alternées `#FBFAF6` / `#F7F4EE`, bordures `#C7CCC2`, noir réservé au petit corps |
| Copywriting §9 — Easy to imagine | p. 37-38 | « Une noisette filme dix doigts » dans la description gestuelle ; le `15 g` reste sur l'étiquette |
| Attention §53 — Section ≥ 5 items repliée | UX p. 53 | Accordion mobile |

### 2.2 Principes transverses applicables

| # | Principe | Application |
|---|---|---|
| Attention §12 | Mots directionnels | « ↓ Voir le pack ci-dessous » à la fin de chaque sous-produit |
| Ecommerce §14 | Aération qualité vs densité deal | Section composition aérée `py-16 sm:py-24` (déjà OK) |
| Luxury §11 | Silence — pas de défensive | Pas de FAQ « pourquoi si cher » dans cette section |
| UX §10 | 40×40 px minimum tap | Chevrons accordéon, boutons tooltip |
| UX §11 | Tap feedback (`:active`) | Sur chaque accordion-toggle, scale 0.97 |
| Copywriting §10 | Directional consistency | Verbes alignés dans la narration : « lustre / révèle / filme » |
| Copywriting §11 | Digits vs mots — hybride | Lettres pour l'expérience (« une noisette »), digits pour la preuve (12 %, 199 MAD) |
| Color §6 | Gris tirent vers sauge | `text-encre/70`, `border-encre/10` — pas de gris pur |

## 3. Audit forces & faiblesses

### 3.1 Forces actuelles (à préserver absolument)

| # | Force | Pourquoi c'est important |
|---|---|---|
| F1 | **Promesse claire dans le subtitle** « Tout est dit : noms d'usage, INCI, fonction, origine, concentration. Pas d'angle mort. » | Active la transparence radicale Kolenda §11 |
| F2 | **5 colonnes complètes** Ingrédient · INCI · Fonction · Origine · % | Haute densité informative = preuve de sérieux |
| F3 | **A11y solide** : `role="region"`, `aria-label`, `tabIndex`, `focus-visible outline` | Standard WCAG 2.1 AA |
| F4 | **Certifications structurées** (label + body, ex. `Cosmos Organic — Ecocert`) | Conforme §4.5, évite le « 100 % » vide de §3.3 Copywriting |
| F5 | **Container `width="wide"`** | Lecture confortable du tableau sur grand écran |
| F6 | **Aération `py-16 sm:py-24`** | §14 Ecommerce — densité deal vs aération qualité |
| F7 | **`bg-creme-warm`** distinct des sections voisines | Rythme couleur cohérent avec §1 Color (alternance neutres) |
| F8 | **Lien d'ancre `id={anchor}-{sub.id}`** sur chaque sous-bloc | Permet liens profonds futurs |

### 3.2 Faiblesses critiques

| # | Faiblesse | Impact mobile | Impact conversion | Gravité |
|---|---|---|---|---|
| W1 | **Scroll horizontal forcé** dans le tableau 5 cols × mobile 375 px | ⚠️⚠️⚠️ Très friction | -15 à -20 % scroll-through estimé | **Bloquant** |
| W2 | **Aucun accordéon** : 3 tableaux dépliés = ~80 vh chacun | ⚠️⚠️ Scroll fatigue | -10 % completion vers pack | **Bloquant** |
| W3 | **Pas d'intro narrative** voix maison sous chaque titre | ⚠️ Ton détoné | Casse Kolenda §4.5 « fiche d'atelier » | **Majeur** |
| W4 | **Pas de tooltip INCI** | ⚠️ Jargon non-décodé | Émet un doute « je comprends pas, peut-être suspect » | **Majeur** |
| W5 | **Pas de lien retour** vers `#commander-femiglow` sous chaque tableau | ⚠️ Dead-end mobile | -5 % retour conversion | **Important** |
| W6 | **Toutes les 5 colonnes ont le même poids visuel** | ⚠️ Pas de hiérarchie scan | L'œil ne sait pas où regarder en priorité | **Important** |
| W7 | **Pas d'identité par sous-produit** (accent color non-réutilisé) | ⚠️ Uniformité plate | Casse la cohérence avec section Composition (qui les colore) | **Important** |
| W8 | **Pas de tri par `%` décroissant** (Kolenda transparence) | ⚠️ Lecture désordonnée | L'eau (`Aqua 60 %`) devrait apparaître en premier | **Mineur** |
| W9 | **Pas de mention gestuelle** dans le titre (« noisette = 10 doigts ») | ⚠️ Easy to imagine §9 raté | Manque l'ancrage sensoriel Kolenda Copywriting | **Important** |
| W10 | **Lignes non alternées** (Kolenda §4.5 demande `#FBFAF6` / `#F7F4EE`) | ⚠️ Lecture longue fatigante | Lecture ligne par ligne moins fluide | **Mineur** |

### 3.3 Score Kolenda actuel

**Conformité** : **5/12 conforme · 1 améliorable · 6 à corriger**.

La section transmet l'info mais **rate sa fonction émotionnelle** (la
« fiche d'atelier » Luxury §6) et **frustre sur mobile** (long scroll,
scroll horizontal forcé sur le tableau).

## 4. Hypothèses conversion

Si on corrige W1+W2+W3+W4+W5 (les 5 bloquants/majeurs) :

| Hypothèse | Mécanisme | Cible numérique |
|---|---|---|
| H1 | Accordéon mobile → réduit la fatigue scroll | +10 % scroll-through vers pack |
| H2 | Tooltip INCI → décode le jargon, retire le doute | +5 % engagement, +3 % conversion finale |
| H3 | Intro narrative → ton fiche d'atelier reconnecte avec voix maison | +15 % temps moyen sur section |
| H4 | Cards mobile verticales → fin du scroll horizontal | +12 % scroll-through |
| H5 | Lien retour pack → ferme la boucle conversion | +8 % clics direct vers `#commander-femiglow` depuis section |

**Conversion globale estimée pour la section** : **+12 à +18 %** sur le
scroll-through-to-conversion-final via section.

## 5. Anti-patterns à éviter

Issus de la lecture Kolenda :

- ❌ Pas de jargon non-décodé (« technologie filmogène brevetée »)
- ❌ Pas de logos certifications XXL — garder les chips
- ❌ Pas de couleur chaude sur cette section (réservée au bloc prix)
- ❌ Pas de FAQ défensive ici (« Pourquoi si cher ? ») — voir §11 Silence
- ❌ Pas de tableaux dépliés par défaut sur mobile (UX §7)
- ❌ Pas d'animation snappy < 200 ms (Attention §3)
- ❌ Pas de « 100 % » vide — toujours préciser la certification (Copywriting §12)
- ❌ Pas de rouge erreur (Color §8) — utiliser l'encre pour les croix éventuelles

## 6. Risques projet identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Refonte du tableau casse les anchors SEO actuels (`#ingredients-details-1-paste`) | Faible | Moyen | Préserver les ID dans la refonte responsive |
| `inciDefinition` saisie incomplète pour les 15 ingrédients | Moyen | Mineur | Phase 1.5 — fallback `name` si définition absente |
| Tooltip mobile sortie de modale (Esc, tap-out) mal gérée | Moyen | Important | Test E2E spécifique pour focus trap + Esc |
| Régression cosmétique sur desktop (priorité mobile) | Faible | Mineur | Visual regression Playwright (cf. doc 07) |
| Conflit avec l'admin éditeur composition (déjà partiellement planifié dans `composition-reveal-optim`) | Moyen | Moyen | Phase 5 — fusionner avec l'éditeur si déjà construit, sinon créer dédié |

## 7. Décisions à figer avant le go

| Décision | Options | Recommandation |
|---|---|---|
| Tooltip — popover ou `<details>` natif ? | A) Popover custom (positionné, focus trap, Esc) · B) `<details>` natif HTML5 | **A** — meilleur UX mobile (positioning auto), conforme WCAG ARIA tooltip pattern |
| Accordéon — `<details>` ou stateful custom ? | A) `<details>` natif · B) Stateful `useState` | **A** — natif suffit, pas d'animation custom requise |
| Premier sous-produit ouvert ou tous fermés ? | A) Premier ouvert · B) Tous fermés | **A** — donne une preuve immédiate, évite l'écran vide |
| Position du lien « ↓ Voir le pack » | A) Sous chaque sous-produit · B) Une fois en pied de section | **A** — chaque sortie d'accordéon est un point de bascule conversion |
| Sortir un editor admin dédié ou fusionner avec /admin/kit/composition planifié ? | A) Dédié `/admin/kit/composition/[id]` · B) Inclus dans un futur editor unifié | **A** — découpe le scope, peut être livré indépendamment |
