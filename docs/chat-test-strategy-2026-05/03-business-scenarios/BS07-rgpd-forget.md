# BS07 — RGPD : visiteur demande oubli

## Contexte
RGPD article 17 (droit à l'effacement). Le visiteur demande la suppression de ses données.

## Scénario Gherkin

```gherkin
Fonctionnalité: BS07 — Droit à l'oubli (RGPD)

  Scénario: Visiteur demande suppression de ses données
    Étant donné Khadija a 10 messages dans une session existante
    Et elle a un lead capturé (`chat_lead`)
    Et un visitor_id `aid_known` persistant

    Quand elle clique sur "Effacer mes données" (footer widget) ou tape "supprime mes données"
    Alors un modal de confirmation s'affiche
    Quand elle confirme
    Alors POST /api/chat/session/forget est envoyé
    Et tous les `chat_message` sont anonymisés (content="[forgotten]") OU supprimés
    Et la session est marquée `forgotten_at=NOW()`
    Et le `chat_lead` associé est marqué `forgotten_at` (soft delete RGPD)
    Et le cookie `chat_session_id` est supprimé
    Et l'event `chat_session_forgotten` est émis

    Et côté admin /admin/chat/conversations
    Alors la conversation apparaît avec status "forgotten"
    Et le contenu des messages est masqué

    Et côté admin /admin/chat/leads
    Alors le lead Khadija apparaît avec status "forgotten" (toujours pour audit conformité)
    Mais le téléphone est masqué [forgotten]
```

## Critères de validation

- DB : `chat_session.forgotten_at` non null
- DB : tous `chat_message.content === '[forgotten]'` (ou supprimés selon politique)
- DB : `chat_lead.forgotten_at` non null + phone masqué
- Cookie absent côté client
- Admin UI affiche masquage correct
- KPI event émis

## Données

```typescript
export const BS07_FORGET = {
  expectedMaskedContent: '[forgotten]',
  expectedMaskedPhone: '[forgotten]',
};
```

## Risques couverts
- F54 (RGPD cross-cutting)
- F16 (API forget)
- Conformité légale CNDP Maroc + RGPD UE

## Notes opérationnelles
- Audit log entry conservé (action=forget, actor=visitor, timestamp)
- Reverse impossible (test négatif : tentative de "re-créer" → 410 Gone)

## Durée : ~20 s
