# CONTRACT — Source de vérité (Locale Switcher V2)

> **Tout** fichier de ce dossier et **tout** code produit doivent se conformer à ce contrat. En cas de divergence, **ce fichier fait foi**. Modifier ce contrat = ADR (voir `01-conception/decisions-adr.md`).

## 1. Vocabulaire

| Terme | Définition |
|---|---|
| **Locale** | `'fr' \| 'ar' \| 'en'` (BCP-47). `fr` = défaut + `x-default`. |
| **Endonyme** | Nom d'une langue dans sa propre écriture : `Français`, `العربية`, `English`. |
| **Surface** | Emplacement du switcher : `header` \| `drawer` \| `footer` \| `nudge`. |
| **Voile** | Overlay de transition (fondu) qui masque l'instant de bascule. |
| **Nudge** | Suggestion contextuelle one-shot (langue navigateur ≠ langue servie). |

## 2. Noms d'artefacts (figés)

| Artefact | Nom exact | Emplacement cible |
|---|---|---|
| Composant switcher | `LocaleSwitcher` | `apps/web/src/components/i18n/LocaleSwitcher.tsx` (existant, enrichi) |
| Hook transition | `useLocaleTransition` | `apps/web/src/components/i18n/use-locale-transition.ts` (nouveau) |
| Voile fallback | `LocaleVeil` | `apps/web/src/components/i18n/LocaleVeil.tsx` (nouveau) |
| Nudge | `LocaleNudge` | `apps/web/src/components/i18n/LocaleNudge.tsx` (nouveau) |
| Helper URL | `buildSwitchUrl` | `apps/web/src/lib/i18n/build-switch-url.ts` (nouveau ou existant) |
| Config publique (API) | `GET /api/i18n/config` | route handler |
| Config admin (API) | `GET/PUT /api/admin/i18n/config` | route handler |
| Détection serveur | `resolveSuggestedLocale()` | `apps/web/src/lib/i18n/suggested-locale.ts` |
| Config (stockage) | section `i18n_locale_config` dans **`app_config`** (réutilise versioning/snapshots/audit/cache existants — voir ADR-009 ; **pas** de nouvelle table) | `app_config` + `app_config_snapshots` |
| Page admin | `/admin/i18n` | `apps/web/src/app/admin/i18n/page.tsx` |
| Flag d'activation | `localeSwitcherV2` | feature flag |

## 3. Clés de configuration (config admin-éditable)

```yaml
# Forme canonique — voir 03-data/config-schema.yaml pour le schéma complet
locales:
  - code: fr
    enabled: true
    endonym: "Français"
    order: 1
  - code: ar
    enabled: true
    endonym: "العربية"
    direction: rtl
    order: 2
  - code: en
    enabled: true
    endonym: "English"
    order: 3
defaultLocale: fr
nudge:
  enabled: true
  maxImpressionsPerVisitor: 1
surfaces:
  header: { variant: dropdown }
  drawer: { variant: pills }
  footer: { variant: pills }
transition:
  durationMs: 280
  easing: "cubic-bezier(0.22,1,0.36,1)"
```

> **Invariant config** : la config publique est **lisible sans auth** (cachée), l'écriture est **admin-only + audit**. Une config invalide ⇒ **fallback sur les valeurs par défaut** (jamais d'écran cassé).

## 4. Events analytics (noms figés)

| Event | Payload |
|---|---|
| `locale_switch` | `{ from: Locale, to: Locale, surface: Surface, page: string, transition: 'vt'\|'veil'\|'reduced'\|'reload' }` |
| `locale_nudge_shown` | `{ suggested: Locale, served: Locale, page: string }` |
| `locale_nudge_accepted` | `{ suggested: Locale, page: string }` |
| `locale_nudge_dismissed` | `{ suggested: Locale, page: string }` |

## 5. Design tokens (référence — détail dans 02-design-ui-ux/design-tokens.json)

| Token | Valeur | Usage |
|---|---|---|
| `motion.switch.duration` | `280ms` | fondu de bascule |
| `motion.switch.easing` | `cubic-bezier(0.22,1,0.36,1)` | courbe douce |
| `motion.veil.fadeIn` / `fadeOut` | `160ms` / `160ms` | voile fallback |
| `motion.panel.open` | `180ms ease-out` | ouverture dropdown |
| `color.switcher.text` | `encre/80` | libellé (jamais noir pur) |
| `color.switcher.active` | `encre` + point `sauge` | langue active |
| `color.switcher.hover` | `encre/[0.04]` | fond hover |
| `tap.min` | `44px` | cible tactile |

> **Interdits charte** : aucune couleur saturée/marque sur le switcher, aucun pop chaud, **aucune pulse**, aucun drapeau, aucun emoji.

## 6. Invariants (à protéger par tests)

- **INV-1** — Une bascule **ne recharge jamais** la page (sauf fallback hors-ligne/erreur explicite).
- **INV-2** — En FR→AR, `<html dir>` passe à `rtl` **dans le même fondu** (jamais d'état intermédiaire visible LTR).
- **INV-3** — Le **scroll est préservé** au switch.
- **INV-4** — Le **querystring/UTM est préservé** (`/fr/kit?utm=x` → `/ar/kit?utm=x`).
- **INV-5** — Le switcher est **absent** sur `/admin/*` (côté chrome public) et **pendant le wizard checkout** (CHA-231).
- **INV-6** — **0 latin** sur les pages `/ar` (hors `FemiGlow`) et **0 fuite FR/EN** (scanners existants restent verts).
- **INV-7** — `prefers-reduced-motion` ⇒ bascule **instantanée sans animation**, toujours sans reload.
- **INV-8** — **Sans JS** ⇒ liens `<a hreflang>` fonctionnels (dégradation gracieuse + SEO).
- **INV-9** — SEO : `<link rel="alternate" hreflang>` conservés, URLs localisées intactes.
- **INV-10** — Le changement de langue est **annoncé** aux lecteurs d'écran (`aria-live="polite"`).
- **INV-11** — Cliquer la **langue active** = no-op (pas de transition, pas de navigation).
- **INV-12** — Config invalide / API down ⇒ **valeurs par défaut**, switcher fonctionnel.

## 7. Moteur de suggestion linguistique (extension — voir `10-suggestion-engine/`)

Couche **intelligente, pilotable, auditable** qui décide **s'il faut**, **à qui** et **quand** proposer une bascule de langue. **Désactivée par défaut pour tout le monde.** Le `LocaleNudge` one-shot du plan de base devient une **présentation** gouvernée par ce moteur (ADR-010).

### 7.1 Artefacts (figés)
| Artefact | Nom exact | Emplacement cible |
|---|---|---|
| Hook runtime moteur | `useLocaleSuggestionEngine` | `apps/web/src/components/i18n/use-locale-suggestion-engine.ts` |
| Politique (pure) | `evaluateSuggestionPolicy(signals, config)` | `apps/web/src/lib/i18n/suggestion-policy.ts` |
| Collecte de signaux | `collectSignals()` | `apps/web/src/lib/i18n/suggestion-signals.ts` |
| Devinette de langue | `guessPreferredLocale(strategies)` | `apps/web/src/lib/i18n/guess-preferred-locale.ts` |
| Prompt (UI) | `LocaleSuggestionPrompt` | `apps/web/src/components/i18n/LocaleSuggestionPrompt.tsx` |
| Config (section) | `i18n_suggestion_engine` dans `app_config` | `app_config` + snapshots (ADR-009) |
| Page admin | onglet « Moteur » de `/admin/i18n` (ou `/admin/i18n/engine`) | — |
| Vue d'audit | `/admin/i18n/engine/audit` | — |
| Flag | `localeSuggestionEngine` (off par défaut) | feature flag |

### 7.2 Concepts
- **Signal** : fait observable (langue d'accès, Accept-Language, cookie, historique, comportement in-page : scroll, dwell, idle, intent de sortie, hover sur le switcher, clics sur contenu d'une autre langue…).
- **Profil de déclenchement** (`trigger profile`) : ensemble de conditions sur les signaux qui **autorise** la proposition (ex. « visiteuse AR qui a fini de lire le hero et marque une pause »).
- **Profil d'exclusion** (`never profile`, **zone calme**) : conditions qui **interdisent** absolument (checkout, lecture longue active, formulaire en cours…). **Priorité absolue** sur les triggers.
- **Moment opportun** : breakpoint de tâche / faible charge mentale (Adamczyk & Bailey 2004) — jamais en pleine interaction.
- **Décision** : `{ eligible: boolean, profileMatched: string|null, reason: string, suggested: Locale }`.

### 7.3 Events (figés — étendent CONTRACT §4)
| Event | Payload |
|---|---|
| `locale_suggestion_evaluated` | `{ suggested, served, decision: 'show'\|'suppress', reason, profileMatched, page }` (audit/debug, échantillonnable) |
| `locale_suggestion_shown` | `{ suggested, served, profileMatched, page, trigger }` |
| `locale_suggestion_accepted` | `{ suggested, page, msToDecision }` |
| `locale_suggestion_dismissed` | `{ suggested, page, scope: 'session'\|'persistent' }` |
| `locale_suggestion_suppressed` | `{ suggested, served, reason, neverProfile, page }` |

**Vocabulaire `reason` (figé)** : `engine-off` · `no-trigger` · `low-confidence` · `same-locale` · `budget` · `dismissed-persistent` · `defer-expired` · `<NEVER-*>` (id du profil d'exclusion qui a matché, ex. `NEVER-CHECKOUT`). Les tests s'appuient sur ces chaînes — toute ajout passe par ADR.

**Ordre d'évaluation (figé, subtil)** : les **profils `never` sont évalués AVANT** le court-circuit `engineEnabled` (INV-14 prime INV-13). Donc en checkout, même moteur off, la décision est `suppress` avec `reason = NEVER-CHECKOUT` (pas `engine-off`). C'est volontaire : la zone calme est un plancher absolu.

### 7.4 Invariants moteur (à protéger par tests)
- **INV-13** — **Désactivé par défaut pour tous.** Aucune proposition tant qu'un profil de déclenchement n'est pas explicitement activé en admin.
- **INV-14** — **Zones calmes inviolables** : jamais pendant le **checkout/wizard**, ni pendant un **formulaire actif**. Priorité absolue sur tout trigger (INV-5 reste vrai).
- **INV-15** — Jamais pendant une **lecture longue engagée** (profil deep-read : dwell élevé + scroll régulier dans un article).
- **INV-16** — **Fréquence bornée** : ≤ 1 proposition par fenêtre de cooldown/visiteur ; dismiss persistant ⇒ plus jamais (sauf reset admin).
- **INV-17** — **Moment opportun seulement** : déclenchement au breakpoint (fin de section, pause/idle courte, intent de sortie), jamais au milieu d'un geste (scroll rapide, frappe, clic en cours).
- **INV-18** — **Entièrement pilotable** : activer/désactiver global et par profil ; **créer/éditer/supprimer** des profils de déclenchement ET d'exclusion ; régler poids, seuils, cooldown, caps — sans redéploiement.
- **INV-19** — **Auditable** : chaque évaluation (montrée OU supprimée) est traçable avec sa **raison** et le **profil** ; une vue d'audit le confirme.
- **INV-20** — **Respect & non-intrusion** : pas de géoloc IP comme signal dur ; **jamais d'auto-redirect** (toujours choix utilisateur) ; le prompt est dismissible et n'interrompt jamais une action en cours.

### 7.5 Garde-fous config moteur
Config invalide/absente ⇒ **moteur off** (INV-13) — jamais d'affichage par erreur. La zone calme (INV-14) est **non désactivable** par config (hard-coded floor).

## 8. Définition de « Done » (par étape du plan)

Une étape n'est **Done** que si :
1. Le code compile (`typecheck` 0 erreur sur fichiers touchés).
2. Les tests de l'étape sont **verts** (unit + intégration concernés).
3. Les **invariants impactés** sont couverts par au moins un test (y compris un **test négatif** : casser l'invariant fait échouer un test).
4. Aucune **régression** sur la batterie de garde (wizard, scanners i18n, build).
5. Lint + format OK.
