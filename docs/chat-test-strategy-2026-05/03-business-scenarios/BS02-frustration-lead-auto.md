# BS02 — Frustration FR : 2 messages → lead form auto

## Contexte
Un visiteur tente d'obtenir une réponse précise mais reçoit 2 fois consécutivement une
réponse qui ne le satisfait pas. Le système doit détecter la frustration et offrir
proactivement la capture de lead (règle 4 de F33).

## Persona
- **Imane**, 28 ans, Marrakech
- Cherche une info précise (composition exacte)
- Mobile (Android Chrome)

## Scénario Gherkin

```gherkin
Fonctionnalité: BS02 — Frustration → offre lead automatique

  Scénario: Visiteur frustré reçoit offre lead form sans demander
    Étant donné que je suis Imane sur "/kit"
    Et que le widget est ouvert
    Quand je tape "C'est quoi exactement dans le pack ?"
    Et j'envoie
    Alors je reçois une réponse vague (manque de précision RAG)
    Et l'événement chat_user_frustration_detected n'est PAS encore émis

    Quand je tape "Ça ne répond pas à ma question"
    Et j'envoie
    Alors un événement chat_user_frustration_detected est émis (score>0.7)
    Et la réponse est suivie d'un event "lead-form-offer" reason="frustration"
    Et une LeadFormBubble apparaît avec copy "Voulez-vous qu'une experte vous reprenne ?"

    Quand je remplis le form et soumets
    Alors le lead est créé avec reason="frustration" dans chat_lead
    Et un Slack alert "Lead frustration" est posté avec contexte du fil
```

## Critères de validation

- `chatConversationEvent` contient `chat_user_frustration_detected` après 2e message
- `LeadFormBubble` apparaît avec copy spécifique frustration
- `chat_lead.reason === 'frustration'`
- Slack alert envoie avec attachment contenant les 2 messages user

## Données

```typescript
export const BS02_FRUSTRATION_TRIGGER = {
  message1: 'C\'est quoi exactement dans le pack ?',
  message2: 'Ça ne répond pas à ma question',
  expectedFrustrationScore: 0.7,
};
```

## Risques couverts
- M6 (reason distinct frustration vs engagement)
- F56 (Slack alert)

## Durée : ~20 s
