# `useLocaleTransition` — spécification du hook (cœur no-reload)

> Le hook **unique** qui réalise la bascule de langue **sans rechargement**, élégante, RTL-safe, accessible et robuste. Tout le reste (switcher, nudge) l'appelle. Conforme à `CONTRACT.md` (INV-1…INV-12).

## 1. Fonctionnement optimal visé

1. L'appelant fournit la **locale cible**.
2. Si cible == locale active → **no-op** (INV-11) : on ferme le panneau, rien d'autre.
3. On calcule l'URL cible via `buildSwitchUrl` en **préservant le querystring/UTM** (INV-4).
4. On choisit le **mode de transition** :
   - `reduced` si `prefers-reduced-motion` → application directe, **sans animation** (INV-7).
   - `vt` si `document.startViewTransition` existe → fondu croisé natif (ADR-001).
   - `veil` sinon → overlay `LocaleVeil` framer (ADR-002).
5. Dans **tous** les modes animés, le callback `apply()` exécute, **dans cet ordre** :
   1. `document.documentElement.lang = target`
   2. `document.documentElement.dir = DIRECTION[target]` (**avant** la nouvelle frame → INV-2)
   3. annonce `aria-live` (INV-10)
   4. `router.replace(url, { locale: target })` (soft-nav, **scroll préservé** INV-3)
6. On émet l'event `locale_switch` avec le `transition` effectif (`vt|veil|reduced`).
7. **Fallback ultime** : si la soft-nav échoue (offline / erreur) → `window.location.assign(url)` (reload de secours) + event `transition:'reload'`.

## 2. Signature

```ts
// apps/web/src/components/i18n/use-locale-transition.ts
type SwitchSurface = 'header' | 'drawer' | 'footer' | 'nudge';
type TransitionKind = 'vt' | 'veil' | 'reduced' | 'reload';

export function useLocaleTransition(): {
  /** Bascule vers `target` ; no-op si déjà actif. */
  switchTo: (target: Locale, surface: SwitchSurface) => void;
  /** État pour piloter LocaleVeil (mode fallback). */
  veil: { active: boolean; phase: 'in' | 'out' | null };
  /** Locale active (dérivée du pathname). */
  active: Locale;
};
```

## 3. Pseudo-code de référence

```ts
const DIRECTION: Record<Locale, 'ltr' | 'rtl'> = { fr: 'ltr', en: 'ltr', ar: 'rtl' };

export function useLocaleTransition() {
  const router = useRouter();              // @/i18n/navigation (soft-nav)
  const pathname = useRawPathname();       // next/navigation
  const search = useSearchParams();
  const active = deriveLocale(pathname);   // 1er segment ; défaut fr
  const [veil, setVeil] = useState({ active: false, phase: null });

  const apply = useCallback((target: Locale, url: string) => {
    const html = document.documentElement;
    html.lang = target;
    html.dir = DIRECTION[target];          // INV-2 (avant la frame)
    announce(target);                      // aria-live polite (INV-10)
    router.replace(url, { locale: target }); // INV-3 scroll préservé
  }, [router]);

  const switchTo = useCallback((target: Locale, surface: SwitchSurface) => {
    if (target === active) return;                 // INV-11 no-op
    const url = buildSwitchUrl(pathname, search, target); // INV-4

    const track = (kind: TransitionKind) =>
      emit('locale_switch', { from: active, to: target, surface, page: pathname, transition: kind });

    const safeApply = () => {
      try { apply(target, url); }
      catch { window.location.assign(url); track('reload'); }   // fallback ultime
    };

    if (prefersReducedMotion()) { safeApply(); track('reduced'); return; }   // INV-7

    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(safeApply);                       // ADR-001
      track('vt');
      return;
    }

    // Fallback voile framer (ADR-002)
    setVeil({ active: true, phase: 'in' });
    afterFade(() => { safeApply(); setVeil({ active: true, phase: 'out' }); }, () =>
      setVeil({ active: false, phase: null }));
    track('veil');
  }, [active, pathname, search, apply]);

  return { switchTo, veil, active };
}
```

> `announce`, `prefersReducedMotion`, `afterFade`, `buildSwitchUrl`, `emit` sont des helpers purs **testables isolément** (cf. plan de tests).

## 4. CSS de transition (charte)

```css
/* globals — courbe douce, durée charte (CONTRACT §5) */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) { animation: none; }
}
```

## 5. Éléments à vérifier / tester (tous les angles)

| Angle | À vérifier |
|---|---|
| **Fonctionnel** | no-op langue active (INV-11) ; URL correcte FR/AR/EN ; UTM préservé (INV-4) ; event émis avec bon `transition`. |
| **RTL** | `dir` passe à `rtl` au switch FR→AR **avant** le rendu (INV-2) ; pas d'état LTR visible. |
| **Reduced-motion** | bascule directe, aucune animation, toujours sans reload (INV-7). |
| **View Transitions absent** | chemin `veil` joué (phases in→apply→out) ; rendu cross-browser. |
| **Hors-ligne / erreur** | fallback `window.location.assign` ; event `transition:'reload'` ; pas d'état figé. |
| **Scroll** | position préservée après switch (INV-3). |
| **A11y** | annonce `aria-live` émise (INV-10) ; focus géré (retour déclencheur). |
| **Perf** | 0 reflow inutile ; pas de fetch bloquant ; hook purement client. |
| **Régression** | aucun impact wizard (hook non monté pendant checkout — INV-5). |
| **Idempotence** | double-clic rapide ne lance pas deux transitions concurrentes (garde `isSwitching`). |

## 6. Edge cases & garde-fous

- **Double déclenchement** : ignorer si une transition est déjà en cours.
- **SSR** : `switchTo` n'est appelé que côté client (event handler) ; aucun accès `document` au render.
- **Locale inconnue dans l'URL** (`/x/...`) : `deriveLocale` retombe sur `fr`.
- **`buildSwitchUrl`** gère : pas de préfixe (`/kit` → insère), préfixe présent (`/fr/kit` → remplace), racine (`/fr` → `/ar`).
