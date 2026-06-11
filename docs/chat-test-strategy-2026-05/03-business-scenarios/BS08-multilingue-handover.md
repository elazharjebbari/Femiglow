# BS08 — Multilingue handover : FR → AR-MA mid-conversation

## Contexte
Une visiteuse démarre en FR puis switch en darija (cas réel typique au Maroc). Le système
doit s'adapter sans perdre le contexte conversation.

## Scénario Gherkin

```gherkin
Fonctionnalité: BS08 — Switch langue mid-conversation

  Scénario: Démarrer FR puis basculer darija
    Étant donné Khadija sur "/kit" en fr-MA
    Quand elle envoie "Bonjour, je voudrais des infos sur le pack"
    Alors session.language="fr-MA"
    Et la réponse arrive en FR

    Quand elle envoie "Wakha, kayn promo daba ?"  (darija)
    Alors le détecteur identifie ar-MA (heuristique darija dans le nouveau message)
    Et session.language est mise à jour à "ar-MA"
    Et le panel direction change à "rtl"
    Et la réponse arrive en darija
    Et la mémoire LLM inclut le contexte du message FR précédent
    Et l'event "chat_language_switched" est émis (from=fr-MA, to=ar-MA)

    Quand elle retape "Et merci"  (FR de nouveau)
    Alors le détecteur reste sur ar-MA (signal isolé pas suffisant)
    Et le panel reste rtl
    OU bascule à fr-MA si seuil de confiance dépassé (cas plus complexe)
```

## Critères de validation

- `session.language` change correctement
- Direction panel update sans perte de scroll
- Mémoire LLM inclut le tour précédent même de langue différente
- Event KPI emis

## Risques couverts
- F03, F53 (language detect + multilingue)

## Durée : ~25 s
