# BS04 — Panne provider primary → fallback Anthropic

## Contexte
ADR-004 niveau 1 : quand OpenAI échoue (3 fails dans 30s, breaker OPEN), le système doit
basculer **silencieusement** vers Anthropic. Le visiteur ne doit rien percevoir d'anormal.

## Scénario Gherkin

```gherkin
Fonctionnalité: BS04 — Failover provider primary

  Scénario: OpenAI down → bascule Anthropic transparente
    Étant donné providers configurés : openai (priority 1), anthropic (priority 2)
    Et OpenAI répond 500 à toutes les requêtes
    Et Anthropic répond normalement

    Quand visiteur Khadija envoie "Combien coute le kit ?"
    Alors le router tente OpenAI (échec)
    Et incrémente le compteur fail openai à 1
    Et tente Anthropic (succès)
    Et la réponse est streamée au visiteur normalement
    Et l'event KPI "chat_provider_failover" est émis (openai→anthropic)

    Quand 2 autres requêtes openai échouent (3 fails total)
    Alors le breaker openai passe à OPEN
    Et les requêtes suivantes skip openai directement (sans tenter)
    Et l'event "chat_circuit_breaker_opened" est émis

    Quand 61 secondes passent
    Alors le breaker passe à HALF_OPEN
    Et la prochaine requête tente openai
    Si openai répond OK, breaker repasse CLOSED
```

## Critères de validation

- `provider-router.ts` : breaker openai → OPEN après 3 fails
- Latence visiteur reste < 5s (P95) malgré failover
- KPI events `chat_provider_failover` + `chat_circuit_breaker_opened` émis
- Visiteur reçoit réponse normale (pas de message d'erreur)

## Setup test
```typescript
// Force OpenAI 500
server.use(http.post('https://api.openai.com/v1/chat/completions',
  () => new HttpResponse(null, { status: 500 })));
// Anthropic OK
server.use(http.post('https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({ /* OK stream */ })));
```

## Risques couverts
- C3 (level 1 failover validé)
- C6 (race breaker concurrent — variante avec 2 workers parallèles)

## Variantes
- BS04-bis : tous les providers down → event error + (futur) fallback CANNED_ONLY (test négatif documenté tant que C3 levels 2+ absents)

## Durée : ~30 s
