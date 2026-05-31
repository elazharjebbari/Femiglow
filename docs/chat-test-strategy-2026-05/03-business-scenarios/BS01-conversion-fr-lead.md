# BS01 — Conversion FR : visiteur curieux → lead

## Contexte business
Une visiteuse arrive sur `/kit` avec un intérêt général (vu via une publicité Meta). Elle a
des questions sur le produit, la livraison, le prix. L'objectif est qu'à la fin elle laisse
ses coordonnées via le `LeadFormBubble`.

**Couvre P0→P4 du funnel** (open_rate, engagement, useful_reply, strong_intent, lead_capture).

## Persona

- **Khadija**, 32 ans, Casablanca
- Découvre FemiGlow via un reel Instagram
- Parle FR (langue principale)
- Mobile (iPhone 13, Safari)
- Première visite

## État initial

- Cookie `visitor_id` absent
- Page `/kit` chargée (LCP < 2,5 s)
- Feature flag `CHAT_ENABLED=true`
- Providers OpenAI + Anthropic configurés
- Database seedée avec :
  - 1 instruction active (FR)
  - 3 canned pairs sur `/kit`
  - 5 FAQ entries FR (incluant `price`, `delivery`)
  - Knowledge sources FR (kit description, delivery cities)

## Scénario Gherkin

```gherkin
Fonctionnalité: BS01 — Conversion FR via chat
  En tant que Khadija (visiteuse curieuse)
  Je veux poser mes questions sur le pack FemiGlow
  Afin d'être rappelée pour passer commande

  Contexte:
    Étant donné que je suis Khadija, 32 ans, à Casablanca
    Et que je navigue sur "/kit" depuis Instagram
    Et que la locale est "fr-MA"

  Scénario: Parcours nominal jusqu'à capture lead
    Étant donné que la page "/kit" est chargée
    Quand le widget se monte (idle callback)
    Alors le launcher apparaît bas-droite en <1s
    Et il a un label accessible "Ouvrir le chat"

    Quand je clique sur le launcher
    Alors le panel s'ouvre en plein écran (mobile)
    Et je vois un message d'accueil contextuel "/kit"
    Et 3 suggestions pills sont visibles

    Quand je clique sur la pill "Combien coûte le kit ?"
    Alors un message user "Combien coûte le kit ?" est ajouté
    Et une réponse scriptée arrive en streaming (typewriter visible)
    Et la réponse mentionne "199 MAD" et "économie de 90 MAD"

    Quand je tape "Et la livraison à Casa ?"
    Et j'appuie sur Entrée
    Alors une réponse arrive en streaming
    Et la réponse mentionne "Livraison gratuite" et "24-48h"
    Et au moins une source RAG est attachée

    Quand je tape "Ok je veux commander"
    Et j'envoie
    Alors une réponse arrive (intent purchase-intent détecté)
    Et un événement `lead-form-offer` arrive avec reason="purchase-intent"
    Et une LeadFormBubble apparaît avec le copy "Voulez-vous être rappelée ?"

    Quand je remplis "Khadija" + "0612345678" + coche le consentement
    Et je clique sur "Me rappeler"
    Alors un POST /api/chat/lead/contact part avec ces données
    Et la bubble passe en état "Merci Khadija, on vous rappelle"
    Et l'événement KPI "chat_lead_captured" est émis
    Et le webhook lead.captured est envoyé au CRM externe
    Et un Slack alert "Nouveau lead — Khadija" est posté

    Et côté admin /admin/chat/leads
    Alors Khadija apparaît en haut de la liste avec status "pending"
    Et phone="0612345678" et reason="purchase-intent"
```

## Critères de validation (E2E assertions)

| # | Étape | Assertion |
|---|-------|-----------|
| 1 | Page load | `widget.launcher()` visible en <1s |
| 2 | Click launcher | `widget.panel()` visible + composer focusé |
| 3 | Greeting | 3 canned pills visibles (`getByRole('list', { name: /suggestions/i })`) |
| 4 | Click pill prix | Message scripted dans MessageList contient "199 MAD" |
| 5 | Question livraison | Reply contient "Casablanca" ET "gratuite" |
| 6 | Sources RAG | Au moins 1 chip `[data-role="source"]` visible |
| 7 | Purchase intent | LeadFormBubble apparaît |
| 8 | Form submit | POST `/api/chat/lead/contact` reçu (intercept) |
| 9 | DB row | `chat_lead.phone='0612345678'` existe |
| 10 | Webhook | `getWebhookCalls()` contient event=lead.captured |
| 11 | Admin list | `/admin/chat/leads` row Khadija visible |

## Données de test (fixtures)

```typescript
// e2e/business-scenarios/BS01.data.ts
export const BS01_PERSONA = {
  firstName: 'Khadija',
  phone: '0612345678',
  language: 'fr-MA',
  city: 'Casablanca',
  viewport: { width: 390, height: 844 },  // iPhone 13
  referrer: 'https://l.instagram.com/',
};
```

## Risques couverts

| Audit ID | Couvre |
|----------|--------|
| C5 | Vérifie que SSE end est bien émis (pas message_complete) |
| C4 | Budget guard appelé (régression test côté backend) |
| M6 | reason='purchase-intent' distinct de 'engagement' |

## Durée estimée

- E2E execution : ~25 s
- Setup (seed data) : ~3 s

## Variantes (test.each)

- Pill cliquée vs question tapée (engagement détaillée)
- Mobile vs desktop
- Visiteur avec ad UTM Meta vs direct
