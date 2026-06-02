# F07 — Funnel chat optimiste (`LeadFormBubble`)

**Surface :** `LeadFormBubble` (`chat-lead-form`, `chat-lead-submit`),
`POST /api/chat/lead/contact`, `chat-store`. **Public :** acheteuse.

## 1. Fonctionnement optimal
- L'offre de lead apparaît (`chat-lead-offer`) ; l'acheteuse ouvre le formulaire,
  saisit prénom + téléphone (+ pays), soumet.
- **flag ON** : le **succès est affiché immédiatement** (`copy.successFallback`),
  `saveLeadPrefill` posé ; l'**envoi + le tracking valorisé** (`generate_lead` avec
  `value`/`leadId` **serveur**) + `markLeadAsPurchaseCookie` continuent en **tâche
  de fond**. **flag OFF** : succès après réponse (message serveur).
- En optimiste, un **échec réseau ne ramène pas** l'UI en erreur (best-effort ;
  le serveur dédupe par identité).

## 2. Points à vérifier (tous angles)
### UI/UX
- Succès **instantané** flag ON (status `success`) ; pas de gel.
- Message de succès affiché (fallback en optimiste, serveur en legacy).
- Honeypot `_phone_alt` → succès silencieux sans envoi.
### Frontend / tracking (critique métier)
- `generate_lead` émis **avec la valeur serveur** (value/currency) — **pas** perdu en optimiste (sinon ROAS sous-évalué).
- `markLeadAsPurchaseCookie` appelé.
### Backend
- Le lead est envoyé (`/api/chat/lead/contact`) ; dédup serveur par (session, identité).
### Robustesse
- Échec réseau optimiste → pas d'erreur UI (best-effort) ; legacy → message d'erreur.
### a11y/i18n
- Form labellisé, FR/AR/EN, RTL, axe 0 violation.

## 3. Oracle principal
> Flag ON, avec une réponse qui **ne résout jamais**, le statut passe à `success`
> immédiatement ; flag OFF, il reste `submitting`. Le `generate_lead` porte la
> valeur serveur quand la réponse arrive.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md) · [`business-scenarios.md`](business-scenarios.md)
