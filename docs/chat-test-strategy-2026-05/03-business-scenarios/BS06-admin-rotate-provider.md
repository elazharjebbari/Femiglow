# BS06 — Admin rotate provider (OpenAI → Gemini)

## Contexte
L'équipe ops décide de tester Gemini comme primary (coût). Opération critique : on ne
veut PAS interrompre les conversations en cours.

## Persona
- **Fatima**, ops manager, rôle "admin"

## Scénario Gherkin

```gherkin
Fonctionnalité: BS06 — Rotation provider primary

  Scénario: Bascule OpenAI → Gemini sans interruption
    Étant donné providers : openai (priority 1, active), gemini (priority 2, active)
    Et une conversation Khadija en cours (stream actif)

    Quand admin Fatima va sur "/admin/chat/providers"
    Et change priority openai → 2 et gemini → 1
    Et clique "Sauvegarder"
    Alors la DB est mise à jour
    Et l'audit log indique le changement
    Et la stream Khadija en cours continue avec OpenAI (n'est pas interrompue)

    Quand un nouveau visiteur arrive
    Alors le router sélectionne Gemini en priorité 1
    Et l'event "chat_provider_active_changed" est émis

    Quand admin clique "Reset breaker" sur openai (s'il était OPEN)
    Alors le compteur fail est remis à 0
    Et l'événement "chat_breaker_reset" est émis
```

## Critères de validation

- DB provider configs updated (priority swap)
- Conversation en cours **non interrompue** (assertion sur stream existant)
- Nouvelles requêtes routées vers Gemini
- Reset breaker remet compteurs à zéro

## Risques couverts
- F45 (admin providers CRUD)
- F31 (router state mgmt)

## Durée : ~35 s
