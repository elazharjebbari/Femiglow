# BS09 — Budget mensuel exhausted : fallback CANNED_ONLY

## Contexte
Le budget LLM mensuel est atteint à 100 %. ADR-004 niveau 3 : pas d'erreur 500, mais
basculer en mode CANNED_ONLY (FAQ + canned + lead form auto).

**État audit** : C4 (budget guard jamais appelé) + C3 (level 3 CANNED_ONLY absent) →
**features non implémentées**, donc test est `it.fails(...)` documentant le gap.

## Scénario Gherkin

```gherkin
Fonctionnalité: BS09 — Budget exhausted (FUTUR — ADR-004 level 3)

  Scénario: Visiteur arrive après dépassement budget
    Étant donné le budget mensuel total à 100% (quotaUsedEur >= quotaMonthlyEur)
    Et `serviceLevel` du système = 3 (CANNED_ONLY)

    Quand Khadija ouvre le widget
    Alors elle voit un message d'accueil normal
    Et les canned pills sont affichées

    Quand elle tape "Combien coute le kit ?"
    Alors une FAQ match est tentée (embedding cosine)
    Si match >= seuil :
      Alors la scripted reply FAQ est servie
      Et aucun appel LLM n'est fait
      Et l'event "chat_canned_served" est émis (reason=budget_exhausted)
    Sinon :
      Alors un message standardisé est servi ("Une experte va vous rappeler")
      Et le LeadFormBubble apparaît automatiquement
      Et l'event "chat_lead_auto_offered" est émis

    Et au niveau admin /admin/chat/health
    Alors le service_level affiché est "3 — CANNED_ONLY"
    Et le compteur "chat_budget_exhausted" est incrémenté
```

## État actuel

Le code **ne supporte pas** ce scénario. Les tests sont :
- `it.fails('FUTURE — CANNED_ONLY when budget exhausted', ...)` → marker visible
- Test négatif (vérifie que le système actuel crash/throw)
- Test positif activé une fois C3 + C4 livrés

## Critères de validation (post-fix)

- Aucun appel LLM si budget exhausted
- FAQ ou message standard servi
- LeadFormBubble auto si pas de FAQ match
- Service level emit correct

## Risques couverts
- C3 (test négatif puis positif)
- C4 (test régression budget guard)

## Durée : ~30 s

## Liens
- ADR-004 ([../../chat-audit-2026-05/03-adr-vs-realite.md#adr-004](../../chat-audit-2026-05/03-adr-vs-realite.md))
- Ticket CHA-AUD-17, CHA-AUD-19 dans [../04-recommandations.md](../../chat-audit-2026-05/04-recommandations.md)
