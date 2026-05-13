# Local streaming — `useLocalStream` hook

> Le faux streaming pour les réponses canned/FAQ. Conserve l'effet d'immédiateté du LLM **sans consommer de budget**. Conversion-critical.

## Pourquoi ?

L'effet « le bot pense, le bot écrit » est l'argument N°1 de conversion. Si on dump une string canned d'un coup, l'utilisateur **sent** qu'il a affaire à du scripté → confiance ↓, conversion ↓.

Le local stream simule la cadence humaine d'écriture. Le décalage entre LLM et canned devient imperceptible.

## API

```ts
function useLocalStream(
  fullText: string,
  opts?: LocalStreamOptions
): {
  displayed: string
  isStreaming: boolean
  progress: number              // 0–1
  cancel: () => void
  skipToEnd: () => void
}

type LocalStreamOptions = {
  wpm?: number                  // mots/minute. Default: 180
  jitterPct?: number            // ±% sur intervalle. Default: 15
  punctuationPauseMs?: number   // pause après . ! ? \n. Default: 220
  startDelayMs?: number         // délai avant 1er mot. Default: 320
  onChunk?: (chunk: string) => void
  onDone?: () => void
}
```

## Algorithme

```
function useLocalStream(fullText, opts):
  wpm = opts.wpm ?? 180
  jitterPct = opts.jitterPct ?? 15
  punctPause = opts.punctuationPauseMs ?? 220
  startDelay = opts.startDelayMs ?? 320
  
  msPerWord = 60_000 / wpm                         # ≈ 333 ms par mot @ 180wpm
  jitterRange = msPerWord * (jitterPct / 100)      # ± ~50 ms
  
  words = fullText.split(/\s+/)
  timeline = []
  
  cumulative = startDelay
  for word, i in words:
    cumulative += randomBetween(msPerWord - jitterRange, msPerWord + jitterRange)
    
    # Pause supplémentaire si mot précédent termine par ponctuation forte
    if i > 0 and /[.!?]$/.test(words[i-1]):
      cumulative += punctPause
    
    timeline.push({ word, atMs: cumulative })
  
  # React effect : monter les timers
  useEffect(() => {
    timers = timeline.map(({ word, atMs }, i) =>
      setTimeout(() => {
        setDisplayed(prev => (i === 0 ? '' : prev + ' ') + word)
        if (i === timeline.length - 1) setIsStreaming(false)
      }, atMs)
    )
    return () => timers.forEach(clearTimeout)
  }, [fullText])
```

## Variantes par langue

| Langue | wpm cible | Pourquoi |
|---|---|---|
| `fr` | 180 | Standard lecture FR adulte |
| `ar` | 145 | Lecture AR un peu plus lente (logographique partiel) |
| `ar-MA` | 175 | Darija = familier, lecture proche FR |

## Mode "réduire les animations"

Si `prefers-reduced-motion: reduce` :

```ts
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (reduced) {
  // Affichage immédiat, pas d'animation
  setDisplayed(fullText)
  setIsStreaming(false)
}
```

## Cancel & skip

- `cancel()` : stoppe le stream, displayed = ce qui était affiché à l'instant.
- `skipToEnd()` : affiche immédiatement `fullText`, marque done.

Le composant `MessageBubble` propose un bouton "Sauter" si `progress < 0.5` et `displayed.length > 80`.

## Composition avec autres bulles

Pendant que `useLocalStream` court sur une bulle, le composer reste **enabled** : l'utilisateur peut taper un nouveau message. Dans ce cas :
1. On `cancel()` le stream en cours.
2. La bulle passe `status: 'completed'` avec son `fullText` complet (pas tronqué — privilégie la cohérence DB).
3. Le nouveau tour démarre.

## Cadence percue vs réelle

| Provider | First-token p50 | Cadence p50 |
|---|---|---|
| OpenAI GPT-4o-mini | ~600 ms | ~30 ms/token (≈ 8 tokens/word) ≈ 240 ms/mot |
| Anthropic Claude Haiku | ~900 ms | ~35 ms/token ≈ 280 ms/mot |
| Local stream FR 180wpm | 320 ms | 333 ms/mot |

Conclusion : le local stream est **légèrement plus lent** que le LLM en cadence, mais **plus rapide** en first-token. Bilan : indissociable à l'œil utilisateur, conversion préservée.

## Composant exemple

```tsx
function MessageBubble({ message }: { message: ChatMessage }) {
  const isCanned = message.meta?.source === 'canned' || message.meta?.source === 'faq'
  const fullText = message.meta?.scriptedReply ?? message.content
  
  // Local stream uniquement si canned ET status === 'streaming'
  const useLocal = isCanned && message.status === 'streaming'
  
  const local = useLocalStream(fullText, {
    wpm: message.language === 'ar' ? 145 : message.language === 'ar-MA' ? 175 : 180,
    onDone: () => useChatStore.getState()._markMessageCompleted(message.id),
  })
  
  const displayed = useLocal ? local.displayed : message.content
  
  return (
    <article dir={['ar','ar-MA'].includes(message.language) ? 'rtl' : 'ltr'}>
      <SafeMarkdown content={displayed} />
      {useLocal && local.isStreaming && <span aria-hidden>▍</span>}
    </article>
  )
}
```

## Tests

| Cas | Type | Critère |
|---|---|---|
| Stream 50 mots @ 180wpm finit en ~16 s | unit | ± 2s |
| Pause après "." ajoute ~220 ms | unit | OK |
| Cancel mid-stream stoppe timers | unit | aucune fuite mémoire |
| reduced-motion → affichage immédiat | unit | OK |
| Skip → displayed === fullText | unit | OK |
| User envoie msg pendant local stream | E2E | bulle previous = fullText, nouvelle bulle démarre |
