# Motion design

## 1. Principes

1. **Subtilité avant tout** : le mouvement guide l'attention, jamais ne la vole.
2. **Cohérence** : mêmes durées et easings dans toute l'app.
3. **Accessibilité** : respecter `prefers-reduced-motion` → désactiver toutes les animations non essentielles.
4. **Performance** : préférer `transform` et `opacity` (GPU-friendly) à `width`/`height`/`top`/`left`.
5. **Feedback < 100ms** : toute action utilisateur doit recevoir un retour visuel immédiat.

## 2. Durées

| Token | Valeur | Usage |
|---|---|---|
| `duration-instant` | 0ms | Réservé pour `prefers-reduced-motion` |
| `duration-fast` | 100ms | Hover, focus, press feedback |
| `duration-default` | 150ms | Toasts in/out, dropdowns, tooltips |
| `duration-medium` | 250ms | Modales open/close, accordéons |
| `duration-slow` | 400ms | Transitions de step wizard |
| `duration-deliberate` | 600ms | Loading skeletons, succès final (avant redirect) |
| `duration-loop` | 1500ms | Spinners, pulse (loops infinis) |

## 3. Easing curves

| Token | Valeur CSS | Usage |
|---|---|---|
| `ease-out` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Entrées (apparitions) — décélère doucement |
| `ease-in` | `cubic-bezier(0.4, 0.0, 1, 1)` | Sorties (disparitions) — accélère |
| `ease-in-out` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Transitions bidirectionnelles (slider) |
| `ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Confirmation succès (rare, modéré) |
| `ease-linear` | `linear` | Spinners, progress bars |

**Règle d'or** : entrées en `ease-out`, sorties en `ease-in`. C'est physiquement intuitif (un objet ralentit en arrivant, accélère en partant).

## 4. Patterns de transitions

### 4.1 Apparition d'une card
```css
.card-enter {
  opacity: 0;
  transform: translateY(8px);
}
.card-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}
```

### 4.2 Toast in/out
```css
.toast-enter   : translateX(100%), opacity 0
.toast-active  : translateX(0), opacity 1     duration 200ms ease-out
.toast-exit    : translateX(0), opacity 1
.toast-exit-active: translateX(100%), opacity 0  duration 150ms ease-in
```

### 4.3 Modale open
```
Overlay : opacity 0 → 1  duration 150ms ease-out
Body    : scale 0.96, translateY(8px), opacity 0
        → scale 1, translateY(0), opacity 1
          duration 200ms ease-out
```

### 4.4 Modale close
```
Body    : scale 1 → 0.98, opacity 1 → 0  duration 150ms ease-in
Overlay : opacity 1 → 0  duration 150ms ease-in (légère délai 50ms)
```

### 4.5 Stepper progression
```
Active step circle : scale 1 → 1.1 → 1  duration 300ms ease-bounce (légère)
Connector line     : strokeDasharray animée (gauche → droite) 250ms ease-in-out
```

### 4.6 Validation result (errors apparaissent)
```
Error chip : opacity 0, translateY(-8px)
           → opacity 1, translateY(0)
             duration 200ms ease-out (stagger 50ms entre items)
```

### 4.7 Activate button (loading → success)
```
Normal      : "Activer"
Click       : background pulse + spinner   "Activation..."   (loop 1500ms)
Success     : background → vert success    "✓ Activé"        (200ms ease-out)
After 800ms : fade out + redirect          (ease-in)
```

### 4.8 JSON preview update (live edit)
```
Highlighted lines (modified) :
  background: ambre-100
  animation: highlight-fade 1000ms ease-out
  ↓
  background: transparent (final)
```

### 4.9 Drift banner apparition
```
Translate Y: -100% → 0
Opacity: 0 → 1
Duration: 300ms ease-out
(persistant, ne disparaît pas seul)
```

## 5. Animations en loop

| Animation | Loop | Description |
|---|---|---|
| Spinner CTA | 1500ms linear infinite | Rotation 360° |
| Pulse (status indicator) | 2000ms ease-in-out infinite alternate | Opacity 0.5 ↔ 1 |
| Skeleton shimmer | 1800ms ease-in-out infinite | Gradient sweep gauche → droite |
| Notification dot | 1000ms ease-in-out infinite alternate | Scale 0.95 ↔ 1.05 |

## 6. Stagger (animations en cascade)

Quand plusieurs items apparaissent (liste, grille de cards), staggerer pour éviter l'effet "tout d'un coup" :

```js
// React Spring / Framer Motion
items.map((item, i) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05, duration: 0.2, ease: 'easeOut' }}
  />
))
```

Stagger maximum : 8 items (au-delà ça devient lent). Si plus, n'animer que les 8 premiers et le reste sans transition.

## 7. Prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Exceptions à garder même avec reduced-motion :
- **Loading spinners** : sinon l'utilisateur ne sait pas que ça charge. Remplacer par un texte "Chargement…".
- **Highlight changements** (ambre-100 background) : conserver le changement de couleur, supprimer l'animation de fade.

## 8. Anti-patterns à éviter

- **Animations gratuites** (parallaxe, flottement permanent). Pas en admin.
- **Bounce excessif** (>30% overshoot). Donne un côté enfantin.
- **Animations > 500ms** sur des micro-interactions. L'utilisateur s'impatiente.
- **Mouvement horizontal en RTL** non miroirisé. Casse l'immersion arabe.
- **Animations cumulatives** : si 5 toasts apparaissent en 1 seconde, ne pas tous les animer en stagger — afficher direct.

## 9. Performance

- Préférer `transform` et `opacity` aux propriétés layout (`width`, `height`, `top`, `left`).
- `will-change: transform` uniquement pendant l'animation (retirer après).
- Pas plus de 3 animations parallèles à l'écran.
- Test sur dispositif bas de gamme (Lighthouse "Slow 4G" + CPU 4x slowdown).
- Cible : 60fps constant pendant les transitions.

## 10. Audio cues (futur, hors v1)

Pas de sons en v1. Réflexion v2 :
- Cling court sur activation réussie (volume bas, mute par défaut).
- Buzz sur erreur critique (drift critique). Désactivable.

L'audio est un dual-edge : utile pour assistance mais agressif si mal calibré. Pas la peine d'investir tant que pas demandé.
