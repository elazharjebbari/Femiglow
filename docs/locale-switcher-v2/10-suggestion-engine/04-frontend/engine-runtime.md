# Runtime client — `useLocaleSuggestionEngine`

> Le runtime qui **collecte les signaux**, **évalue la politique**, applique le **defer-to-breakpoint**, et **rend** `LocaleSuggestionPrompt` au bon moment. S'appuie sur `useLocaleTransition` pour l'acceptation (bascule sans reload). Conforme CONTRACT §7 (INV-13→INV-20).

## 1. Fonctionnement optimal

1. **Amorce serveur** (prop) : `{ guessedLocale, confidence, engineConfig, suggestedSurface }` résolus en RSC (no-flash).
2. **Si moteur off** (`engineEnabled=false`, défaut) → le hook **ne fait rien** (INV-13). Coût ~0.
3. **Collecte** : `collectSignals()` met à jour en continu les signaux client (scroll, dwell, idle, exitIntent, typing, formFocused, inCheckout, modalOpen…), avec **throttle** (perf).
4. **Évaluation** : à chaque changement *pertinent* (et au plus toutes les N ms), appeler `evaluateSuggestionPolicy(signals, config)` (pure).
   - `suppress` → ne rien montrer ; émettre `locale_suggestion_evaluated` (échantillonné) + `locale_suggestion_suppressed` si pertinent.
   - `defer` → armer le **détecteur de breakpoint** (TTL).
   - `show` (au breakpoint) → monter `LocaleSuggestionPrompt`.
5. **Breakpoint** : pause de scroll (≥ N ms après activité), idle court, exit-intent (desktop), retour au top. Si TTL dépasse sans breakpoint → **abandon** (rien).
6. **Prompt** : perle (mismatch léger) ou toast (exit-rescue), **deux choix symétriques** (rester / passer). Accept → `useLocaleTransition.switchTo(suggested,'nudge')`. Dismiss → cookie session/persistant.
7. **Budget** : à chaque impression, décrémenter ; poser cooldown ; respecter cap & dismiss persistant (INV-16).

## 2. Signature

```ts
// apps/web/src/components/i18n/use-locale-suggestion-engine.ts
export function useLocaleSuggestionEngine(input: {
  guessedLocale: Locale;
  confidence: number;          // 0..1, résolu serveur
  config: SuggestionEngineConfig; // section app_config (prop)
}): {
  prompt: null | { suggested: Locale; surface: 'pearl' | 'toast'; profileMatched: string };
  accept: () => void;          // → useLocaleTransition
  dismiss: (scope: 'session' | 'persistent') => void;
};
```

## 3. Détecteur de breakpoint (defer)

```ts
// Pseudo : arme à l'état "defer", résout au 1er moment opportun
function useBreakpoint(opportune: OpportuneMoment[], ttlMs: number) {
  // écoute throttlée : scrollEnd (pause), idle, exitIntent, backToTop
  // résout once → callback(show) ; sinon clear au TTL → callback(abandon)
}
```

- **scrollEnd** : `scrollEnd = aucun scroll pendant >= QUIET_MS après une activité`.
- **idle** : `idleMs ∈ [min,max]` après engagement (pas l'idle d'inattention totale).
- **exitIntent** (desktop only) : `mouseout` vers `clientY<=0`.
- **TTL** : ex. 20–30 s ; au-delà, on renonce (pas de harcèlement).

## 4. Garanties de non-régression & perf

- **Listeners passifs** + **throttle/raf** ; détachés au démontage.
- Le hook est **inerte** si moteur off (aucun listener attaché) → 0 coût par défaut.
- **Jamais** monté pendant le wizard (INV-14) — même garde que le switcher (INV-5).
- Aucune dépendance bloquante ; tout est client, post-hydratation.

## 5. Accessibilité

- `LocaleSuggestionPrompt` : `role="dialog"` léger **non modal** (n'emprisonne pas le focus de la page) OU `role="status"` pour le toast ; **annonce** discrète (aria-live) à l'apparition.
- Clavier : focusable, Échap = dismiss session, deux boutons clairs.
- `prefers-reduced-motion` : apparition **sans animation** (statique) — on **propose quand même** (l'accessibilité ne supprime pas l'utilité), mais sans mouvement.
- Cible tactile ≥ 44 px ; contraste AAA (encre/crème).

## 6. Éléments à vérifier / tester

| Angle | À vérifier |
|---|---|
| **Off par défaut** | moteur off → 0 listener, 0 prompt (INV-13). |
| **Zones calmes** | checkout/form/deep-read → jamais de prompt (INV-14/15), même trigger actif. |
| **Moment opportun** | éligible mais pas de breakpoint → rien ; breakpoint → show (INV-17) ; TTL → abandon. |
| **Budget** | 2e affichage bloqué (cooldown/cap) ; dismiss persistant définitif (INV-16). |
| **Acceptation** | accept → bascule sans reload (réutilise `useLocaleTransition`, INV-1). |
| **No-redirect** | aucune navigation automatique sans clic (INV-20). |
| **Perf** | listeners throttlés/passifs, détachés ; 0 jank au scroll. |
| **A11y** | non-modal, clavier, reduced-motion statique, annonce. |
| **Audit** | chaque décision émet l'event d'audit avec raison + profil (INV-19). |
