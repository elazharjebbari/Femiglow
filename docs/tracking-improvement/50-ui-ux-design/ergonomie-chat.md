# 50.7 — Ergonomie du chat (mobile + clavier)

## Périmètre

Le chat n'est PAS directement touché par les chantiers tracking, mais
l'audit a relevé qu'il bénéficierait des mêmes principes d'ergonomie.
Ce document liste les bonnes pratiques OUTILS (et inclut les fixes
déjà appliqués lors de la session précédente).

## État actuel (acquis)

✅ **`MobileFocusGuard`** — bloque l'auto-zoom iOS sur focus de textarea  
✅ **`text-lg`** (18px) sur la textarea — au-dessus du seuil iOS 16px  
✅ **`min-h-[2.75rem]` + `max-h-32`** — auto-grow avec limite  
✅ **`enterKey = send, Shift+Enter = newline`** — pattern standard  
✅ **44×44 target** sur bouton Send (WCAG 2.5.5)  
✅ **`dir="rtl"`** auto pour langue arabe  
✅ **Body scroll lock** pendant chat ouvert (mobile)

## À renforcer (non-prioritaire mais utile)

### 1. Annonce ARIA quand le bot écrit

```typescript
<div
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
>
  {isStreaming ? 'Assistant FemiGlow rédige une réponse…' : ''}
</div>
```

### 2. Skip-link pour fermer rapidement

Sur mobile, le bouton X est en haut. Ajouter un raccourci clavier :
```
[Esc] = fermer le chat
[/]   = focus composer
```

### 3. Annonce de nouveau message

Pour les utilisateurs avec screen reader, annoncer chaque nouveau message :

```typescript
<div aria-live="polite" className="sr-only">
  {latestMessage ? `Nouveau message : ${latestMessage.role === 'assistant' ? 'FemiGlow' : 'Vous'}: ${latestMessage.text}` : ''}
</div>
```

### 4. Bouton "Revenir en bas" si l'utilisateur scrolle

Quand la conversation est longue, l'utilisateur peut scroller vers le haut.
Ajouter un FAB "↓ Nouveau message" qui ramène en bas.

### 5. Préserver le draft

Si l'utilisateur ferme le chat avec du texte saisi, le restaurer à la
prochaine ouverture (`localStorage.chat_draft`).

### 6. Indicateur de typing du bot

Bulle animée "..." pendant que le bot stream :

```
┌───────────────────┐
│ ● ● ●             │
└───────────────────┘
   (animation pulse)
```

### 7. Gestion du clavier virtuel mobile

État actuel : `h-[100dvh]` + `pb-[env(safe-area-inset-bottom)]`. Bon.

Optimisation possible : utiliser `visualViewport.height` pour redimensionner
dynamiquement la zone messages quand le clavier apparaît :

```typescript
useEffect(() => {
  if (typeof window === 'undefined' || !window.visualViewport) return;
  const onResize = () => {
    const vp = window.visualViewport!;
    document.documentElement.style.setProperty('--vp-height', `${vp.height}px`);
  };
  window.visualViewport.addEventListener('resize', onResize);
  return () => window.visualViewport!.removeEventListener('resize', onResize);
}, []);
```

Puis dans le CSS : `height: var(--vp-height, 100dvh)`.

### 8. Réactions rapides (out of scope)

Future amélioration : boutons réaction sur messages bot ("👍 Utile" / "👎 Inutile")
pour collecter du feedback.

## Performance perçue chat

| Symptôme | Solution |
|---|---|
| Lag à l'ouverture | Lazy-load ChatPanel (déjà fait via dynamic import) |
| Lag au focus input | Pas de re-render parent — utiliser refs (déjà fait) |
| Stream lent | Optimiser SSE parser (chunks early-paint) |
| Scroll saccadé | `overscroll-contain` + virtualized list si > 50 messages |

## Tests à ajouter (chat)

- E2E mobile : ouvrir chat → focus textarea → vérifier pas de zoom auto (DÉJÀ)
- E2E desktop : ouvrir chat → Enter envoie → bot répond → ferme
- A11y : axe-core sur ChatPanel ouvert
- Keyboard : Tab navigation, Escape ferme
