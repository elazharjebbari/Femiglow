# Plan agence tech - Declenchement fiable du formulaire chat

Date : 2026-05-17  
Projet : FemiGlow - Chat assistant / capture lead  
Environnement cible d'execution : serveur de staging actuel `/var/www/femiglow`  
Chantier futur a synchroniser ensuite : worktree webhook `/var/www/femiglow-leads-webhook-multi-step` et, si necessaire, `/var/www/femiglow/.claude/worktrees/webhook`

## 1. Objectif

Mettre en place un systeme robuste de type "ceinture + bretelles" pour declencher le formulaire de capture lead quand l'IA invite la visiteuse a remplir le formulaire, meme si la logique actuelle de decision n'a pas emis l'evenement `lead-form-offer`.

Le systeme doit :

- detecter les reponses assistant qui proposent explicitement de remplir un formulaire, laisser un numero, etre rappelee, commander, finaliser une demande ou parler a une conseillere ;
- ouvrir le formulaire lead dans le chat sans demander a l'utilisateur de chercher "en bas" ;
- eviter strictement la redondance : pas deux formulaires, pas deux evenements incoherents, pas deux leads pour la meme identite ;
- rester compatible avec l'architecture actuelle : SSE, Zustand, `chat_lead`, `chat_conversation_event`, webhook lead, tests Vitest/MSW/Playwright ;
- etre non regressif, modulaire, maintenable et observable.

## 2. Constat actuel

Le flux actuel est sain mais il a une faille fonctionnelle :

1. L'utilisateur envoie un message libre.
2. `POST /api/chat/message` appelle `streamReply`.
3. L'orchestrateur detecte intent, FAQ, RAG, LLM.
4. Apres la reponse LLM, `shouldOfferLeadForm` peut emettre `lead-form-offer`.
5. Le frontend affiche `LeadFormBubble` uniquement s'il recoit `lead-form-offer` ou si une canned pair indique `triggersLeadForm`.

Probleme observe : l'IA peut dire dans sa reponse "remplissez le formulaire en bas", "laissez vos coordonnees", "je peux vous faire rappeler", mais le formulaire ne s'ouvre pas.

Ca arrive parce que :

- la decision actuelle depend surtout de l'intent utilisateur, pas du contenu final de la reponse assistant ;
- la reponse assistant peut proposer le formulaire par son wording, alors que `currentIntent` ne matche pas `purchase-intent`, `callback-request`, `inline-contact`, etc. ;
- le chemin FAQ vectorielle retourne tot dans `orchestrator.ts` avant la logique lead post-reponse ;
- le frontend ne possede pas aujourd'hui de fallback fiable sur le contenu final de la bulle assistant ;
- les instructions systeme peuvent mentionner un formulaire, mais aucune couche ne verifie que cette promesse UI est effectivement suivie d'une bulle formulaire.

## 3. Principe de solution

Mettre en place une detection a deux niveaux.

### Niveau 1 - Ceinture serveur

Apres generation de la reponse assistant, le backend analyse le texte final de l'assistant. Si ce texte contient une proposition explicite de formulaire/contact/rappel/commande, et si aucun formulaire n'a deja ete offert/capture pour la session, le backend emet `lead-form-offer`.

Ce niveau est la source de verite principale parce qu'il :

- connait `sessionId`, `assistantMessageId`, `intentTag`, `alreadyOffered`, leads existants ;
- peut persister un event `chat_lead_form_offered` avec une cause claire ;
- fonctionne avant que le client interprete l'UI ;
- evite les divergences multi-navigateurs.

### Niveau 2 - Bretelles frontend

Le frontend garde une detection locale tres conservative sur le contenu final de la bulle assistant. Si aucun `lead-form-offer` n'a ete recu, mais que le texte final contient une invitation forte au formulaire, il ouvre une offre locale `LeadFormBubble`.

Ce niveau est un filet de securite UX :

- utile si le SSE `lead-form-offer` est perdu, si un chemin serveur oublie de l'emettre, ou si une ancienne version backend est encore active ;
- idempotent cote store ;
- limite aux formulations fortes pour eviter les faux positifs.

Le backend reste responsable de la creation du lead quand le formulaire est soumis.

## 4. Architecture cible

```text
Assistant reply finalisee
  -> Backend detector assistant-reply-lead-trigger
       -> si match fort
       -> si pas deja offert/capture
       -> event DB chat_lead_form_offered
       -> SSE lead-form-offer
  -> Client recoit lead-form-offer
       -> store.receiveLeadOffer()
       -> MessageList insere LeadFormBubble

Fallback client:
  -> end SSE recu
  -> lire contenu final assistant dans Zustand
  -> detector client conservative
  -> si aucun leadOffer actif/capture/dismiss fort
  -> receiveLeadOffer({ source: client-safety-net })
```

## 5. Backend - conception detaillee

### 5.1 Nouveau service serveur

Créer un service pur :

`apps/web/src/lib/chat/services/assistant-reply-lead-trigger.ts`

Responsabilite : classifier une reponse assistant deja generee et determiner si elle contient une invitation au formulaire.

API proposee :

```ts
import type { ChatLeadTriggerReason, ChatCannedPairLeadCopyKey } from '@/lib/chat/contracts';
import type { ChatIntent } from './intent';

export type AssistantLeadTriggerSource =
  | 'assistant-reply-form'
  | 'assistant-reply-callback'
  | 'assistant-reply-purchase'
  | 'assistant-reply-human'
  | 'assistant-reply-inline-contact';

export interface AssistantReplyLeadTriggerInput {
  assistantReply: string;
  currentIntent: ChatIntent;
  language: 'fr' | 'ar' | 'ar-MA';
}

export interface AssistantReplyLeadTriggerResult {
  shouldOffer: boolean;
  reason?: ChatLeadTriggerReason;
  copyKey?: ChatCannedPairLeadCopyKey;
  source?: AssistantLeadTriggerSource;
  confidence: 'none' | 'low' | 'medium' | 'high';
  matchedPatterns: string[];
}

export function detectAssistantReplyLeadTrigger(
  input: AssistantReplyLeadTriggerInput,
): AssistantReplyLeadTriggerResult;
```

### 5.2 Regles de detection serveur

Le detecteur doit etre volontairement conservateur. Il ne doit pas ouvrir un formulaire parce que le texte contient juste "question", "aide", "conseil".

Patterns forts FR :

- `remplir le formulaire`
- `formulaire en bas`
- `formulaire ci-dessous`
- `laissez vos coordonnees`
- `laissez votre numero`
- `votre numero de telephone`
- `je peux vous faire rappeler`
- `une conseillere vous appellera`
- `on vous rappelle`
- `je transmets votre demande`
- `pour finaliser votre commande`
- `pour passer commande`
- `donnez-moi votre prenom et telephone`
- `cliquez sur le bouton`

Patterns darija / ar-MA :

- `3tini smiytek`
- `numero dyalek`
- `n3ayto lik`
- `ghadi n3ayto lik`
- `khalli numero`
- `formulaire`

Patterns arabe :

- `املئي الاستمارة`
- `اتركي رقمك`
- `رقم الهاتف`
- `سنتصل بك`
- `مستشارة`
- `لطلب المنتج`

Mapping propose :

| Famille detectee | reason | copyKey |
|---|---|---|
| rappel / conseillere / humain | `explicit-request` | `explicit-request` |
| commande / achat / finaliser | `purchase-intent` | `purchase-intent` |
| numero / coordonnees dans la reponse | `manual` ou `inline-contact` selon contexte | `manual` |
| formulaire generique | `manual` | `manual` |
| hors connaissance + proposition humain | `out-of-knowledge` | `out-of-knowledge` |
| B2B / revendeur / gros | `b2b` | `b2b` |

Regle de confiance :

- `high` : deux signaux forts ou un signal tres explicite (`remplir le formulaire`, `formulaire ci-dessous`, `laissez votre numero`) ;
- `medium` : un signal de contact/rappel/commande clair ;
- `low` : signal ambigu, ne doit pas declencher en prod ;
- `none` : aucun match.

Decision finale : declencher seulement si `confidence` est `high` ou `medium`.

### 5.3 Integration dans `orchestrator.ts`

Ajouter une fonction utilitaire interne :

```ts
async function maybeEmitLeadOfferFromAssistantReply(input: {
  sessionId: string;
  assistantMessageId: string;
  assistantReply: string;
  currentIntent: ChatIntent;
  language: ChatLanguage;
  alreadyOffered: boolean;
}): Promise<LeadOfferPayload | null>
```

Elle applique dans l'ordre :

1. verifier `lead_form_enabled` ;
2. verifier `leadRepo.hasLeadForSession(sessionId)` ;
3. verifier qu'aucune offre n'a deja ete emise pour la session ou pour ce `assistantMessageId` ;
4. appeler `shouldOfferLeadForm` existant ;
5. si `shouldOfferLeadForm` retourne false, appeler `detectAssistantReplyLeadTrigger` ;
6. si match fort :
   - append event `chat_lead_form_offered` avec payload :

```json
{
  "messageId": "cm_...",
  "reason": "manual",
  "copyKey": "manual",
  "source": "assistant-reply-form",
  "confidence": "high",
  "matchedPatterns": ["formulaire ci-dessous"]
}
```

7. retourner le payload SSE `lead-form-offer`.

### 5.4 Correction du chemin FAQ

Aujourd'hui, le chemin FAQ peut retourner avant la logique lead post-reponse. Il faut extraire la logique d'offre lead dans une fonction partagee appelee :

- apres reponse FAQ ;
- apres reponse LLM ;
- potentiellement apres canned pair si besoin futur.

Plan technique :

1. Creer `buildLeadOfferAfterAssistantReply(...)`.
2. Dans le chemin FAQ :
   - persister le message assistant FAQ ;
   - emettre `start`, `chunk`, `end` comme aujourd'hui ;
   - appeler la logique d'offre ;
   - si payload, emettre `lead-form-offer` ;
   - return.
3. Dans le chemin LLM :
   - remplacer la logique inline actuelle par le helper ;
   - garder la creation auto lead inline-contact inchangee.

### 5.5 Idempotence backend

Il faut eviter doublons sur trois niveaux.

Niveau session :

- `leadRepo.hasLeadForSession(sessionId)` bloque si un lead existe deja.

Niveau evenement :

- ajouter dans `eventRepo` une methode :

```ts
hasLeadOfferForSession(sessionId: string): Promise<boolean>
hasLeadOfferForMessage(sessionId: string, messageId: string): Promise<boolean>
```

Elle cherche `chat_conversation_event.type = 'chat_lead_form_offered'`.

Niveau payload :

- si un `lead-form-offer` a deja ete emis par `shouldOfferLeadForm`, le detecteur assistant ne doit pas en emettre un second ;
- si le fallback assistant detecte une proposition mais que `alreadyOffered = true`, il ne doit rien emettre.

Option DB : pas de migration obligatoire au depart. L'idempotence peut rester applicative via `eventRepo`. Si les doublons persistent en prod, ajouter plus tard une contrainte partielle ou une table dediee `chat_lead_offer`.

## 6. Frontend - conception detaillee

### 6.1 Nouveau detecteur client

Créer :

`apps/web/src/components/chat/assistant-reply-lead-trigger.client.ts`

Il doit reprendre une version subset des patterns serveur, sans logique metier lourde.

API :

```ts
export interface ClientAssistantLeadTriggerResult {
  shouldOffer: boolean;
  reason: ChatLeadTriggerReason;
  copyKey: ChatCannedPairLeadCopyKey;
  source: 'client-safety-net';
  matchedPattern: string;
}

export function detectClientAssistantLeadTrigger(
  assistantContent: string,
  language: ChatLanguage,
): ClientAssistantLeadTriggerResult | null;
```

Contraintes :

- ne matche que les patterns explicites ;
- ne matche pas les phrases informatives du type "nous avons un formulaire" ;
- ne declenche pas pendant le streaming ;
- ne declenche qu'apres `end`.

### 6.2 Integration dans `useChatSend`

Apres `end`, juste apres `endStreaming`, le hook peut :

1. verifier si une offre SSE `lead-form-offer` a deja ete recue pour ce `messageId` ;
2. lire le contenu final du message assistant dans le store ;
3. appeler `detectClientAssistantLeadTrigger`;
4. si match :
   - appeler `receiveLeadOffer({ messageId, reason, copyKey })` ;
   - emettre tracking `chat_lead_form_offered` avec `source: client-safety-net` ;
   - optionnel : `POST /api/chat/event` pour persister un event UI `chat_lead_form_view` ou un nouveau type si ajoute.

### 6.3 Idempotence frontend

Le store protege deja :

- `leadCapturedSessionId` : pas de re-offre apres capture ;
- `leadOfferDismissedSessionId` : bloque les offres soft ;
- `STRONG_LEAD_REASONS` : autorise les raisons fortes.

Ajouter une protection volatile :

```ts
leadOfferSourceMessageId: string | null
```

ou reutiliser `leadOffer.triggeringMessageId`.

Regle :

- si `leadOffer.status !== 'idle'`, ne pas declencher ;
- si `leadOffer.triggeringMessageId === assistantMessageId`, ne pas declencher ;
- si `leadCapturedSessionId === sessionId`, ne pas declencher.

### 6.4 UI/UX

Objectif UX : l'IA ne doit plus dire "formulaire en bas" sans que le formulaire soit visible immediatement.

Comportement cible :

- la bulle formulaire apparait directement sous la reponse assistant qui l'a proposee ;
- auto-scroll vers la bulle ;
- pas de deuxieme bulle si l'offre SSE et le fallback client se declenchent ;
- la copy doit etre coherente avec la raison :
  - `purchase-intent` : "Je vous reserve le rituel et une conseillere finalise avec vous."
  - `explicit-request` : "Laissez votre prenom et telephone, une conseillere vous rappelle."
  - `manual` : "Laissez vos coordonnees, on vous accompagne."
  - `out-of-knowledge` : "Je prefere qu'une conseillere confirme avec vous."

Amelioration de wording systeme recommandee :

- remplacer "remplissez le formulaire en bas" par "je vous affiche le formulaire juste ici".
- ajouter dans les instructions systeme : "Si tu invites a remplir un formulaire, formule-le clairement ; le systeme affichera automatiquement la bulle de contact."

## 7. Data et observabilite

### 7.1 Evenements

Utiliser `chat_conversation_event` sans migration immediate.

Payload `chat_lead_form_offered` enrichi :

```json
{
  "messageId": "cm_...",
  "reason": "manual",
  "copyKey": "manual",
  "source": "assistant-reply-form",
  "confidence": "high",
  "matchedPatterns": ["formulaire ci-dessous"],
  "detectorVersion": "assistant-reply-lead-trigger/v1"
}
```

Sources possibles :

- `lead-decision`
- `assistant-reply-form`
- `assistant-reply-callback`
- `assistant-reply-purchase`
- `assistant-reply-human`
- `client-safety-net`
- `canned-pair`

### 7.2 KPIs

Ajouter ou suivre :

- taux de reponses assistant avec proposition formulaire ;
- taux d'offres backend vs fallback frontend ;
- taux de doublons evites ;
- taux `lead_form_view -> submit` ;
- taux `assistant-reply-trigger -> submit` ;
- erreurs route lead ;
- nombre de `client-safety-net` par jour : si eleve, le backend rate encore des cas.

### 7.3 Requetes SQL de controle

Offres par source :

```sql
SELECT payload->>'source' AS source, count(*)
FROM chat_conversation_event
WHERE type = 'chat_lead_form_offered'
  AND occurred_at >= now() - interval '7 days'
GROUP BY 1
ORDER BY 2 DESC;
```

Doublons par session :

```sql
SELECT session_id, count(*)
FROM chat_conversation_event
WHERE type = 'chat_lead_form_offered'
  AND occurred_at >= now() - interval '7 days'
GROUP BY session_id
HAVING count(*) > 1
ORDER BY count(*) DESC;
```

Fallback client a surveiller :

```sql
SELECT date_trunc('day', occurred_at) AS day, count(*)
FROM chat_conversation_event
WHERE type = 'chat_lead_form_offered'
  AND payload->>'source' = 'client-safety-net'
GROUP BY 1
ORDER BY 1 DESC;
```

## 8. Plan de conception

### Phase C0 - Validation produit

Livrables :

- liste validee des phrases qui doivent declencher le formulaire ;
- liste des phrases qui ne doivent pas declencher ;
- mapping reason/copyKey valide.

Critere d'acceptation :

- au moins 30 cas positifs et 30 cas negatifs couverts en tests unitaires.

### Phase C1 - Design backend

Livrables :

- service `assistant-reply-lead-trigger.ts` pur et teste ;
- helper d'orchestration post-reponse ;
- eventRepo idempotence ;
- integration FAQ + LLM.

Critere d'acceptation :

- aucune duplication d'offre sur une meme reponse ;
- chemin FAQ couvert ;
- chemin LLM couvert ;
- chemin provider error inchange.

### Phase C2 - Design frontend

Livrables :

- detecteur client conservative ;
- integration `useChatSend` apres `end` ;
- protections store ;
- tracking source `client-safety-net`.

Critere d'acceptation :

- pas de double bulle si SSE puis fallback ;
- bulle visible sous le message assistant ;
- dismiss/capture continuent a fonctionner.

### Phase C3 - QA automatisee

Livrables :

- tests Vitest unitaires backend/frontend ;
- tests MSW pour flux API/SSE ;
- tests Playwright desktop/mobile ;
- scenarios non regression.

Critere d'acceptation :

- suite chat verte ;
- scenario "IA propose formulaire" reproduit et corrige ;
- scenario "pas de proposition formulaire" ne declenche rien.

### Phase C4 - Runbook staging

Livrables :

- deploiement sur serveur de staging actuel ;
- verification DB ;
- verification manuelle ;
- rollback documente.

Critere d'acceptation :

- formulaire visible quand l'IA propose le formulaire ;
- aucun double formulaire observe ;
- aucun double lead cree.

## 9. Plan de developpement detaille

### Etape 1 - Ajouter le detecteur backend

Fichiers :

- `apps/web/src/lib/chat/services/assistant-reply-lead-trigger.ts`
- `apps/web/src/lib/chat/services/assistant-reply-lead-trigger.test.ts`

Actions :

1. Implementer les patterns FR/ar/ar-MA.
2. Retourner reason/copyKey/source/confidence.
3. Ajouter tests positifs/negatifs.

Tests :

```bash
cd /var/www/femiglow/apps/web
pnpm vitest run src/lib/chat/services/assistant-reply-lead-trigger.test.ts
```

### Etape 2 - Ajouter l'idempotence eventRepo

Fichiers :

- `apps/web/src/lib/chat/repos/event.ts`
- `apps/web/src/lib/chat/repos/event.test.ts` si pattern existant, sinon test service avec mock.

Actions :

1. Ajouter `hasLeadOfferForSession`.
2. Ajouter `hasLeadOfferForMessage`.
3. Utiliser `type = chat_lead_form_offered`.

Tests :

```bash
cd /var/www/femiglow/apps/web
pnpm vitest run src/lib/chat/repos/event.test.ts
```

Si test repo DB trop lourd, couvrir via orchestration mockee.

### Etape 3 - Refactoriser la decision lead post-reponse

Fichiers :

- `apps/web/src/lib/chat/services/orchestrator.ts`
- eventuellement nouveau fichier `apps/web/src/lib/chat/services/lead-offer-after-reply.ts`

Actions :

1. Extraire logique existante de `shouldOfferLeadForm`.
2. Ajouter fallback `detectAssistantReplyLeadTrigger`.
3. Enrichir payload event avec `source`.
4. Appeler le helper dans le chemin LLM.
5. Appeler le helper dans le chemin FAQ avant `return`.
6. Garder l'auto-lead inline-contact.

Tests :

```bash
cd /var/www/femiglow/apps/web
pnpm vitest run src/lib/chat/services/orchestrator.test.ts
pnpm vitest run src/lib/chat/services/orchestrator-lead-capture.test.ts
```

### Etape 4 - Ajouter le detecteur frontend

Fichiers :

- `apps/web/src/components/chat/assistant-reply-lead-trigger.client.ts`
- `apps/web/src/components/chat/assistant-reply-lead-trigger.client.test.ts`

Actions :

1. Implementer subset de patterns forts.
2. Retourner `null` si doute.
3. Tester FR/ar/ar-MA.

Tests :

```bash
cd /var/www/femiglow/apps/web
pnpm vitest run src/components/chat/assistant-reply-lead-trigger.client.test.ts
```

### Etape 5 - Integrer le fallback dans `useChatSend`

Fichiers :

- `apps/web/src/components/chat/hooks/use-chat-send.ts`
- `apps/web/src/components/chat/hooks/use-chat-send.test.tsx`
- `apps/web/src/components/chat/chat-store.ts` si nouveau champ necessaire.

Actions :

1. Memoriser si un `lead-form-offer` SSE a ete recu pour `messageId`.
2. Apres `end`, lire la bulle assistant finale.
3. Si pas d'offre, appliquer detecteur client.
4. Appeler `receiveLeadOffer`.
5. Emettre tracking avec source `client-safety-net`.
6. Verifier que `dismiss` et `leadCapturedSessionId` bloquent correctement.

Tests :

```bash
cd /var/www/femiglow/apps/web
pnpm vitest run src/components/chat/hooks/use-chat-send.test.tsx
```

### Etape 6 - Tests MSW / API

Fichiers :

- `apps/web/src/lib/chat/providers/openai.test.ts` si utile ;
- `apps/web/src/lib/chat/services/orchestrator.test.ts` ;
- handlers MSW existants dans `apps/web/src/test/msw`.

Scenarios :

1. Provider retourne "Je vous affiche le formulaire juste ici" -> SSE contient `lead-form-offer`.
2. Provider retourne conseil neutre -> pas de `lead-form-offer`.
3. FAQ retourne "remplissez le formulaire" -> SSE contient `lead-form-offer`.
4. `alreadyOffered = true` -> pas de doublon.
5. lead existant -> pas d'offre.

Commande :

```bash
cd /var/www/femiglow/apps/web
pnpm vitest run src/lib/chat/services/orchestrator.test.ts src/lib/chat/services/orchestrator-lead-capture.test.ts
```

### Etape 7 - Tests Playwright

Fichiers :

- `apps/web/e2e/chat-lead-capture.spec.ts`
- eventuellement nouveau `apps/web/e2e/chat-form-trigger-safety-net.spec.ts`

Scenarios desktop :

1. Mock `/api/chat/message` avec SSE `start/chunk/end` sans `lead-form-offer`, chunk contenant "Je vous affiche le formulaire juste ici".
2. Verifier apparition `chat-lead-offer`.
3. Cliquer CTA, verifier `chat-lead-form`.
4. Soumettre, verifier appel `/api/chat/lead/contact`.

Scenario anti-doublon :

1. Mock SSE avec `lead-form-offer`.
2. Chunk contient aussi une phrase trigger.
3. Verifier un seul `chat-lead-offer`.

Scenario mobile :

1. viewport mobile ;
2. ouvrir chat ;
3. recevoir reponse trigger ;
4. verifier formulaire visible et composer non masque.

Commande :

```bash
cd /var/www/femiglow/apps/web
pnpm exec playwright test e2e/chat-lead-capture.spec.ts --workers=1
pnpm exec playwright test e2e/chat-form-trigger-safety-net.spec.ts --workers=1
```

### Etape 8 - Verification globale

Commandes :

```bash
cd /var/www/femiglow/apps/web
pnpm test -- src/lib/chat/services/assistant-reply-lead-trigger.test.ts
pnpm test -- src/components/chat/assistant-reply-lead-trigger.client.test.ts
pnpm test -- src/components/chat/hooks/use-chat-send.test.tsx
pnpm test -- src/lib/chat/services/orchestrator.test.ts
pnpm test -- src/lib/chat/services/orchestrator-lead-capture.test.ts
pnpm exec playwright test e2e/chat-lead-capture.spec.ts --workers=1
```

## 10. Matrice de tests

| Niveau | Scenario | Attendu |
|---|---|---|
| Unit backend | "remplissez le formulaire ci-dessous" | `shouldOffer=true`, `manual` |
| Unit backend | "une conseillere vous appellera" | `explicit-request` |
| Unit backend | "pour finaliser votre commande" | `purchase-intent` |
| Unit backend | "voici les ingredients" | aucun trigger |
| Unit backend | arabe "اتركي رقمك" | trigger |
| Unit backend | darija "n3ayto lik" | trigger |
| Orchestrator LLM | reponse assistant trigger | SSE `lead-form-offer` |
| Orchestrator LLM | reponse neutre | pas de `lead-form-offer` |
| Orchestrator FAQ | FAQ trigger | SSE `lead-form-offer` |
| Orchestrator idempotence | `alreadyOffered=true` | pas de double event |
| Frontend hook | SSE sans offer mais chunk trigger | `LeadFormBubble` apparait |
| Frontend hook | SSE avec offer + chunk trigger | une seule bulle |
| Frontend store | lead capture deja faite | pas de re-offre |
| Playwright desktop | reponse "formulaire" | offre puis formulaire visible |
| Playwright mobile | clavier/formulaire | pas de masquage, scroll OK |
| MSW | provider OpenAI mock trigger | flux complet stable |

## 11. Plan MSW

Utiliser MSW pour simuler :

- provider OpenAI stream ;
- webhook outbound ;
- route tracking si necessaire ;
- erreurs reseau.

Handlers cibles :

```ts
http.post('https://api.openai.com/v1/chat/completions', () => {
  return new HttpResponse(streamSse([
    'Je vous affiche le formulaire juste ici pour que notre conseillere vous rappelle.'
  ]));
});
```

Scenarios :

1. provider repond avec formulaire ;
2. provider repond sans formulaire ;
3. provider repond avec texte trigger puis erreur finale ;
4. webhook lead retourne 200 ;
5. webhook lead timeout mais formulaire reste succes.

## 12. Plan Playwright

### Desktop

```ts
test('ouvre le formulaire si l assistant propose le formulaire sans event SSE explicite', async ({ page }) => {
  await page.route('**/api/chat/message', route => route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: [
      'event: start',
      'data: {"messageId":"cm_test","language":"fr"}',
      '',
      'event: chunk',
      'data: {"messageId":"cm_test","delta":"Je vous affiche le formulaire juste ici."}',
      '',
      'event: end',
      'data: {"messageId":"cm_test","latencyMs":120}',
      '',
    ].join('\\n'),
  }));
});
```

Assertions :

- `chat-lead-offer` visible ;
- `chat-lead-form` visible apres CTA ;
- pas plus d'un `chat-lead-offer`.

### Mobile

Assertions :

- `chat-panel` visible full-screen ;
- `chat-lead-offer` visible apres reponse ;
- CTA clickable ;
- `chat-lead-form` visible ;
- `chat-input` reste accessible.

## 13. Plan UI/UX/design

### Objectif visuel

La bulle formulaire doit etre percue comme la suite naturelle de la reponse assistant. Pas comme un pop-up marketing separe.

Regles :

- insertion inline sous le message assistant declencheur ;
- pas de modal ;
- auto-scroll doux ;
- microcopy courte ;
- CTA principal clair ;
- bouton "Plus tard" conserve ;
- respect RTL ;
- taille tactile mobile >= 44 px ;
- pas de chevauchement avec composer ;
- pas de double animation si fallback client arrive apres SSE.

### Microcopy recommandee

Cas `manual` :

"Je vous affiche le formulaire ici pour qu'une conseillere FemiGlow vous accompagne rapidement."

Cas `explicit-request` :

"Laissez votre prenom et telephone, une conseillere vous rappelle rapidement."

Cas `purchase-intent` :

"Laissez vos coordonnees, on vous aide a finaliser votre commande du rituel."

Cas `out-of-knowledge` :

"Je prefere qu'une conseillere confirme ce point avec vous. Laissez vos coordonnees ici."

### Instruction IA a ajuster

Ajouter dans l'instruction active :

```text
Quand tu proposes a la visiteuse de laisser ses coordonnees, ne dis pas "en bas".
Dis plutot : "je vous affiche le formulaire juste ici".
Ne promets pas un formulaire si tu ne veux pas declencher une prise de contact.
```

## 14. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Faux positif sur une phrase informative | formulaire trop agressif | patterns conservateurs + tests negatifs |
| Double formulaire | UX confuse | guards backend + store + tests anti-doublon |
| Chemin FAQ oublie | bug persiste | helper partage appele FAQ + LLM |
| Fallback client masque un bug serveur | observabilite source `client-safety-net` |
| Lead deja capture | spam | `leadCapturedSessionId` + `leadRepo.hasLeadForSession` |
| Dismiss ignore | frustration | respecter dismiss pour raisons soft |
| Multilingue incomplet | perte conversion ar/ar-MA | tests FR/ar/ar-MA |
| Regression streaming | chat casse | tests `use-chat-send` + Playwright |

## 15. Runbook d'execution sur staging actuel

Important : ce plan doit etre execute dans le serveur de staging actuel :

```bash
cd /var/www/femiglow
```

Ne pas demarrer le chantier directement dans le worktree webhook. Le worktree webhook sera traite plus tard :

```bash
/var/www/femiglow-leads-webhook-multi-step
/var/www/femiglow/.claude/worktrees/webhook
```

### 15.1 Pre-check

```bash
cd /var/www/femiglow
git status --short
git worktree list
cd apps/web
pnpm --version
```

Verifier que le staging pointe bien sur la DB de staging attendue :

```bash
cd /var/www/femiglow/apps/web
node -e "console.log(process.env.NODE_ENV || 'no NODE_ENV')"
```

Si l'environnement charge `.env`, verifier sans exposer les secrets :

```bash
cd /var/www/femiglow
grep -E '^(NEXT_PUBLIC_SITE_URL|CHAT_ENABLED|DATABASE_URL|POSTGRES|OUTBOUND_WEBHOOK_URL)=' .env .env.local 2>/dev/null | sed 's/=.*/=<set>/'
```

### 15.2 Implementation

1. Creer les detecteurs backend/frontend.
2. Ajouter tests unitaires.
3. Refactoriser l'orchestrateur.
4. Integrer fallback client.
5. Ajouter/adapter tests Playwright.
6. Lancer tests ciblés.

### 15.3 Tests ciblés

```bash
cd /var/www/femiglow/apps/web
pnpm vitest run src/lib/chat/services/assistant-reply-lead-trigger.test.ts
pnpm vitest run src/components/chat/assistant-reply-lead-trigger.client.test.ts
pnpm vitest run src/components/chat/hooks/use-chat-send.test.tsx
pnpm vitest run src/lib/chat/services/orchestrator.test.ts
pnpm vitest run src/lib/chat/services/orchestrator-lead-capture.test.ts
pnpm exec playwright test e2e/chat-lead-capture.spec.ts --workers=1
```

### 15.4 Verification manuelle staging

Demander dans le chat :

1. "Je veux commander le kit"
2. "Est-ce qu'une conseillere peut me rappeler ?"
3. "Tu peux me donner le formulaire ?"
4. "Je veux laisser mon numero"
5. "Combien coute le rituel ?" puis attendre si l'IA propose le formulaire.

Attendu :

- la reponse IA ne dit plus "en bas" sans action ;
- la bulle formulaire apparait sous la reponse ;
- un seul formulaire apparait ;
- apres soumission, un seul lead est cree ;
- webhook status visible en admin ;
- email notification fire-and-forget.

### 15.5 Verification DB

```sql
SELECT id, session_id, type, payload, occurred_at
FROM chat_conversation_event
WHERE type = 'chat_lead_form_offered'
ORDER BY occurred_at DESC
LIMIT 20;
```

Verifier les sources :

```sql
SELECT payload->>'source' AS source, count(*)
FROM chat_conversation_event
WHERE type = 'chat_lead_form_offered'
  AND occurred_at >= now() - interval '1 day'
GROUP BY 1;
```

Verifier absence de doublons recents :

```sql
SELECT session_id, count(*)
FROM chat_conversation_event
WHERE type = 'chat_lead_form_offered'
  AND occurred_at >= now() - interval '1 day'
GROUP BY session_id
HAVING count(*) > 1;
```

### 15.6 Rollback

Rollback applicatif :

```bash
cd /var/www/femiglow
git status --short
git revert <commit_sha>
```

Rollback rapide si non commite :

```bash
cd /var/www/femiglow
git diff -- apps/web/src/lib/chat apps/web/src/components/chat apps/web/e2e
```

Puis revenir par patch inverse uniquement sur les fichiers du chantier. Ne pas toucher aux modifications non liees.

Rollback fonctionnel sans revert code :

- desactiver temporairement le fallback frontend via flag runtime si un flag est ajoute ;
- sinon desactiver uniquement le trigger assistant-reply dans une constante serveur ;
- ne pas desactiver tout le chat sauf incident critique.

## 16. Definition of Done

Le chantier est termine seulement si :

- le backend detecte une reponse assistant qui invite au formulaire ;
- le chemin LLM et le chemin FAQ declenchent correctement ;
- le frontend ouvre le formulaire si le SSE d'offre manque ;
- aucun double formulaire n'apparait quand backend + frontend matchent tous les deux ;
- aucun double lead n'est cree pour la meme identite/session ;
- les tests Vitest unitaires passent ;
- les tests d'orchestrateur passent ;
- le test Playwright du scenario bug passe ;
- verification manuelle sur staging OK ;
- les events `chat_lead_form_offered` contiennent une source exploitable ;
- le runbook a ete suivi sur `/var/www/femiglow`.

## 17. Notes pour le futur worktree webhook

Le chantier doit d'abord etre livre et valide sur le staging actuel `/var/www/femiglow`.

Ensuite seulement, reporter ou adapter dans le worktree webhook :

- `/var/www/femiglow-leads-webhook-multi-step` : branche `leads-webhook-multi-step`, DB separee, `.env` deja existant ;
- `/var/www/femiglow/.claude/worktrees/webhook` : worktree webhook additionnel a inspecter avant toute reprise.

Points a verifier dans le worktree webhook :

- compatibilite `chat_lead` et champs webhook ;
- statut `webhookStatus` ;
- idempotency keys outbound ;
- scanner step1/step2 abandon ;
- absence de divergence sur `leadRepo` ;
- reprise des tests webhook existants apres merge.

## 18. Synthese executive

La correction ne doit pas etre un simple ajout de regex cote client. Le bon design est une double securite :

1. backend post-reponse, source de verite, persistant, observable ;
2. frontend fallback, strictement idempotent, pour proteger l'UX si l'evenement SSE manque.

Ce design corrige le bug visible par l'utilisatrice, garde le systeme non regressif, respecte l'architecture actuelle, et donne a l'equipe une observabilite claire sur les cas ou l'IA promet un formulaire.
