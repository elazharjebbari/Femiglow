# Profils comportementaux & signaux

> La taxonomie **source** : les signaux observés, les **profils de déclenchement** (qui *peut* recevoir une proposition) et les **profils d'exclusion** (qui n'en reçoit *jamais*). Tout est **données** (config), donc créable/éditable en admin (INV-18). Le catalogue exécutable vit dans `../02-config/profiles-catalog.csv` et `../03-data/signals-catalog.csv`.

## 1. Signaux (entrées du moteur)

Catégories (détail exhaustif → `03-data/signals-catalog.csv`) :

| Catégorie | Exemples de signaux | Origine |
|---|---|---|
| **Langue/contexte** | `servedLocale`, `accessLocale` (langue d'accès = locale de l'URL d'entrée), `acceptLanguage[]`, `cookieLocale` (NEXT_LOCALE), `priorLocale` (visite précédente), `guessedLocale` + `confidence` | serveur + cookie |
| **Source d'arrivée** | `referrer`, `utm_*`, `entryPath`, `adLocale` (langue de la créa Meta) | serveur |
| **Engagement** | `dwellMs`, `scrollDepth`, `scrollVelocity`, `sectionsRead`, `idleMs`, `pageViewsInSession`, `returningVisitor` | client |
| **Intention** | `exitIntent` (souris vers chrome navigateur), `hoverSwitcher`, `clickedOtherLangContent`, `searchedInLang` | client |
| **Tâche en cours** | `inCheckout`, `formFocused`, `videoPlaying`, `typing`, `modalOpen` (chat) | client |
| **Budget** | `cooldownActive`, `impressionsThisVisitor`, `dismissedPersistent`, `quietHours` | cookie/serveur |
| **Accessibilité** | `prefersReducedMotion`, `keyboardOnly` | client |

> **Robustesse** : chaque signal a une **valeur par défaut sûre** (absence ⇒ valeur la plus conservatrice). Un signal manquant ne doit **jamais** ouvrir un déclenchement (fail-safe vers « ne pas montrer »).

## 2. Profils d'exclusion (`never`) — priorité absolue (INV-14/15)

Évalués **en premier** ; s'ils matchent, la décision est `suppress` immédiate, quelle que soit la confiance.

| ID | Nom | Condition (signaux) | Raison |
|---|---|---|---|
| `NEVER-CHECKOUT` | En paiement | `inCheckout == true` | zone calme inviolable (Zeigarnik) |
| `NEVER-FORM` | Formulaire actif | `formFocused == true \|\| typing` | tâche en cours |
| `NEVER-DEEP-READ` | Lecture longue | `dwellMs > 45s && scrollDepth croissant && article route` | flux de lecture (INV-15) |
| `NEVER-FRESH` | Trop tôt | `dwellMs < 3s` | pas de breakpoint encore |
| `NEVER-FAST-SCROLL` | Scroll rapide | `scrollVelocity > seuil` | charge/anti-moment |
| `NEVER-MODAL` | Modale ouverte | `modalOpen (chat)` | ne pas empiler |
| `NEVER-VIDEO` | Vidéo plein écran | `videoPlaying fullscreen` | immersion |
| `NEVER-DISMISSED` | A déjà refusé | `dismissedPersistent` | respect (INV-16) |
| `NEVER-BUDGET` | Budget épuisé | `cooldownActive \|\| cap atteint` | fréquence (INV-16) |
| `NEVER-SAME-LANG` | Pas pertinent | `guessedLocale == servedLocale \|\| confidence < seuil` | inutile |

> Ces exclusions forment un **plancher non désactivable** par config pour les plus critiques (checkout, form actif) — CONTRACT §7.5.

## 3. Profils de déclenchement (`trigger`) — désactivés par défaut (INV-13)

Évalués **après** les exclusions, par **priorité**. Le premier qui matche ET dont le **moment** est opportun produit `show`.

| ID | Nom | Condition (signaux) | Moment opportun |
|---|---|---|---|
| `TRIG-ENTRY-MISMATCH` | Arrivée en langue non préférée | `guessedLocale != servedLocale && confidence ≥ haute` (ex. accès `/fr`, Accept-Language `ar`) | au 1er breakpoint (pause scroll après hero) |
| `TRIG-RETURNING-PREF` | Visiteuse de retour avec préférence connue | `returningVisitor && priorLocale != servedLocale` | dès breakpoint léger |
| `TRIG-AD-LANG` | Créa Meta dans une autre langue | `adLocale != servedLocale` | après 1ère section |
| `TRIG-HESITATION` | Hésitation + signal langue | `hoverSwitcher \|\| clickedOtherLangContent` | immédiat (intent explicite) |
| `TRIG-EXIT-RESCUE` | Intent de sortie + mismatch | `exitIntent && guessedLocale != servedLocale` | sur exit-intent (desktop) |
| `TRIG-IDLE-BREAK` | Pause après engagement | `idleMs ∈ [court] && dwellMs > 10s && scrollDepth modéré` | pendant la pause |

> Chaque trigger porte : `enabled` (défaut **false**), `priority`, `minConfidence`, `cooldownHours`, `maxImpressions`, `surface` (perle/toast), `opportuneMoment` (liste de breakpoints acceptés).

## 4. Modèle d'évaluation (politique)

```
evaluateSuggestionPolicy(signals, config):
  if matchAny(config.neverProfiles, signals):        return suppress(reason, neverProfile)   # INV-14/15
  if not config.engineEnabled:                        return suppress('engine-off')           # INV-13
  candidates = config.triggerProfiles
               .filter(enabled)
               .filter(p => matches(p, signals))
               .filter(p => signals.confidence >= p.minConfidence)
               .filter(p => budgetOk(p, signals))     # INV-16
               .sortBy(priority)
  if candidates.empty:                                return suppress('no-trigger')
  if not opportuneNow(candidates[0], signals):        return defer(candidates[0])            # INV-17 (file d'attente + TTL)
  return show(candidates[0], signals.guessedLocale)
```

- **`defer`** : la suggestion est mise en attente du prochain breakpoint (TTL court ; sinon abandon — pas de harcèlement).
- **Déterministe & pur** : `evaluateSuggestionPolicy` est une **fonction pure** (mêmes entrées → même sortie) → testable exhaustivement.

## 5. Extensibilité (créer ses profils — INV-18)

Un profil = **données** : `{ id, kind: 'trigger'|'never', enabled, priority, conditions[], minConfidence, budget, surface, opportuneMoment[] }`.
- L'admin **crée** un profil en composant des conditions sur les signaux du catalogue (UI no-code, cf. `02-config/admin-feature-spec.md`).
- Aucun déploiement requis ; validation Zod + preview.
- Un profil `never` créé par l'admin a **toujours** priorité sur les triggers.

## 6. Éléments à vérifier / tester

- Exclusions **priment** sur triggers (test : checkout + trigger actif → `suppress`).
- Engine off (défaut) → toujours `suppress('engine-off')` (INV-13).
- Signal manquant → comportement conservateur (jamais `show`).
- `defer` → `show` uniquement au breakpoint, sinon abandon au TTL (INV-17).
- Budget : 2e évaluation après une impression → `suppress('budget')` (INV-16).
- Dismiss persistant → `suppress` définitif.
- Profil custom créé en admin → pris en compte sans redeploy (INV-18).
- Déterminisme : table de vérité (signaux → décision) reproductible.
