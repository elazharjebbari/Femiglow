# BS10 — Tools (futur ADR-002) : visiteur demande statut commande

## Contexte
Promesse ADR-002 : `get_order_status(orderNumber, email)` permet au chat de répondre
factuellement sur le statut d'une commande, sans hallucination.

**État audit** : C1 — tools framework totalement absent. Test est `it.fails(...)` qui sera
activé post-implémentation.

## Scénario Gherkin

```gherkin
Fonctionnalité: BS10 — Tools — get_order_status (FUTUR — ADR-002)

  Scénario: Visiteur demande statut commande → tool call → réponse factuelle
    Étant donné Souad a passé une commande "FG-2026-12345" il y a 2 jours
    Et son email est souad@example.com
    Et le système supporte le tool `get_order_status` (FUTUR)

    Quand Souad envoie "Où est ma commande FG-2026-12345 ?"
    Alors l'intent "order-status" est détecté
    Et le tool `get_order_status` est sélectionné par le routeur hybride
    Et le LLM appelle le tool avec `{orderNumber:"FG-2026-12345", email:"souad@example.com"}`
    Et le tool retourne `{status:"shipped", carrier:"Sendit", eta:"2026-05-27"}`
    Et le LLM compose la réponse : "Votre commande est expédiée via Sendit, livraison prévue le 27 mai"
    Et l'event `chat_tool_call_log` est inséré avec latency + result
    Et la table `chat_tool_call_log` contient une nouvelle row

  Scénario: Email ne match pas → demande clarification
    Quand Souad envoie "Où est ma commande FG-2026-99999 ?"
    Et le tool retourne `{error:"not_found"}`
    Alors le LLM répond "Je ne trouve pas cette commande. Pouvez-vous vérifier le numéro ?"
    Et propose un LeadFormBubble pour transfert à une humaine

  Scénario: Provider ne supporte pas tools (Ollama)
    Étant donné Ollama est primary et ne supporte PAS les tools
    Quand Souad envoie "Où est ma commande ?"
    Alors le routeur skip le tool et passe en mode RAG-only
    Et la réponse est plus générique
    Et l'event "chat_tool_unsupported" est émis
```

## État actuel

Tous les tests sont `it.fails(...)` ou skipped. Liste :
- Tools framework absent → tous les tests négatifs (pas de table `chat_tool_call_log`, pas
  de `tools[]` dans `ChatStreamRequest`)
- Validations Zod tools : pas encore là

## Critères (post-implémentation)

- `chat_tool_call_log` row insérée
- Latency P95 < 2s pour tool call
- Audit log accessible côté admin
- Provider allowlist respectée (OpenAI/Anthropic OK, Gemini partiel, Ollama non)

## Risques couverts
- C1 (tools framework absent — test guide l'implémentation)
- F58 (matrix providers + tools support)

## Durée (post-implementation) : ~40 s

## Liens
- ADR-002 ([../../chat-audit-2026-05/03-adr-vs-realite.md#adr-002](../../chat-audit-2026-05/03-adr-vs-realite.md))
- Tickets CHA-AUD-24 à CHA-AUD-29 dans [../04-recommandations.md](../../chat-audit-2026-05/04-recommandations.md)
