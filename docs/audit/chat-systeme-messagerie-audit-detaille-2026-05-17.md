# Audit detaille du systeme de messagerie chat FemiGlow

Date d'audit : 2026-05-17  
Perimetre : flux public du widget chat, envoi de message, streaming de reponse, persistance, capture lead, analytics, webhooks, logique FAQ/RAG/LLM et interfaces admin rattachees.  
Code inspecte : `apps/web/src/components/chat`, `apps/web/src/app/api/chat`, `apps/web/src/lib/chat`, `apps/web/src/lib/webhooks/outbound`.

## 1. Vue d'ensemble

Le chat FemiGlow est un widget React/Next.js monte cote client, pilote par un store Zustand persiste partiellement dans `localStorage`, et connecte a un backend Next.js route-handler. Le coeur du systeme repose sur :

- un widget public : launcher, panel, liste des messages, composer, formulaire lead ;
- une API de session : `GET /api/chat/session` cree ou recharge la session visiteur ;
- une API de message : `POST /api/chat/message` retourne un flux SSE ;
- un orchestrateur serveur : sanitation, langue, intention, FAQ vectorielle, RAG, provider LLM, streaming, persistance, couts, leads ;
- une API de suggestion pre-ecrite : `POST /api/chat/canned-pair` ;
- une API de capture lead : `POST /api/chat/lead/contact` ;
- une base Postgres/Drizzle avec tables `chat_session`, `chat_message`, `chat_conversation_event`, `chat_lead`, providers, instructions, knowledge base et embeddings.

Le flux central est le suivant :

```text
Visiteuse
  -> ChatLauncher ouvre ChatPanel
  -> useChatSession appelle GET /api/chat/session
  -> sessionService getOrCreate + snapshot
  -> ChatComposer envoie le texte
  -> useChatSend push optimiste du message user
  -> POST /api/chat/message
  -> validation + rate limit + streamReply()
  -> message user persiste
  -> FAQ ou RAG + LLM
  -> SSE start/source/chunk/end/(lead-form-offer)
  -> useChatSend lit le SSE, cadence les chunks, met a jour Zustand
  -> eventuellement LeadFormBubble
  -> POST /api/chat/lead/contact
  -> chat_lead + webhook + email interne + tracking
```

References principales :

- Frontend envoi : `apps/web/src/components/chat/hooks/use-chat-send.ts:26`
- Route message : `apps/web/src/app/api/chat/message/route.ts:24`
- Orchestrateur : `apps/web/src/lib/chat/services/orchestrator.ts:62`
- Session service : `apps/web/src/lib/chat/services/session-service.ts:36`
- Schema DB : `apps/web/src/lib/chat/db/schema.ts:30`
- Capture lead : `apps/web/src/app/api/chat/lead/contact/route.ts:52`

## 2. Montage du widget et interface cliente

### 2.1 Point d'entree

Le composant serveur `ChatWidgetMount` decide si le chat existe dans la page. Il lit le feature flag via `isChatEnabled()`. Si le chat est desactive, il retourne `null`, donc aucun JS de chat n'est monte.

Fichiers :

- `apps/web/src/components/chat/ChatWidgetMount.tsx`
- `apps/web/src/components/chat/ChatWidget.tsx`

`ChatWidget` rend simplement :

- `ChatLauncher` : bouton flottant d'ouverture ;
- `ChatPanel` : panneau conversationnel complet.

### 2.2 Panneau de chat

`ChatPanel` est le conteneur principal. Il gere :

- ouverture/fermeture via le store ;
- direction RTL si langue arabe ;
- `Escape` pour fermer ;
- lock du scroll du body a l'ouverture ;
- restauration du scroll a la fermeture ;
- correction iOS clavier via `visualViewport` et variable CSS `--chat-keyboard-inset` ;
- mise au-dessus du header/sticky CTA avec `z-index: var(--z-chat-overlay)`.

La structure rendue est :

```tsx
<ChatHeader />
<MessageList />
<ChatComposer />
```

En mobile, le panneau est full-screen (`fixed inset-0 h-[100dvh] w-full`). En desktop, il devient une bulle ancree en bas a droite/gauche (`sm:w-[380px]`, `sm:max-h[...]`).

References :

- appel `useChatSession(page)` : `apps/web/src/components/chat/ChatPanel.tsx:41`
- lock scroll body : `apps/web/src/components/chat/ChatPanel.tsx:64`
- correction clavier iOS : `apps/web/src/components/chat/ChatPanel.tsx:107`
- rendu panel : `apps/web/src/components/chat/ChatPanel.tsx:170`

### 2.3 Store client

Le store Zustand est dans `chat-store.ts`. Il contient deux familles d'etat :

Etat persiste dans `localStorage` sous la cle `femiglow-chat` :

- `sessionId`
- `language`
- `hasInteracted`
- `leadOfferDismissedSessionId`
- `leadCapturedSessionId`

Etat volatile :

- `isOpen`
- `isStreaming`
- `messages`
- `pendingAssistantId`
- `error`
- `greeting`
- `suggestions`
- `leadOffer`

Le store expose les actions :

- `open`, `close`, `toggle`
- `setSession`
- `pushUserMessage`
- `beginStreaming`, `appendDelta`, `setSources`, `endStreaming`
- `clearSuggestions`
- `receiveLeadOffer`, `openLeadForm`, `dismissLeadForm`, `setLeadFormSuccess`, etc.

Point important : les messages ne sont pas persistes en localStorage. Au reload, le store garde seulement l'identifiant de session, puis `useChatSession` recharge le snapshot serveur.

## 3. Creation et rechargement de session

### 3.1 Cote client

`useChatSession(initialPage)` est appele au montage du panel. Il appelle :

```text
GET /api/chat/session?page=<page>
```

Il ne refetch pas si le store a deja une session avec messages ou suggestions. Il refetch si le store a un `sessionId` rehydrate mais aucun contenu, pour corriger le cas reload ou les pills/messages auraient disparu.

Fichier : `apps/web/src/components/chat/hooks/use-chat-session.ts`

### 3.2 Route serveur

`GET /api/chat/session` :

1. verifie le feature flag (`assertChatEnabled`) ;
2. lit `page` dans l'URL ;
3. appelle `sessionService.getOrCreate({ page })` ;
4. appelle `sessionService.snapshot(session.id)` ;
5. retourne un `ChatSessionSnapshot`.

Si le chat est off, la route retourne `404 Not Found`.

Fichier : `apps/web/src/app/api/chat/session/route.ts`

### 3.3 Service session

`sessionService.getOrCreate` :

1. calcule/recupere un `visitorId` via `getVisitorId()` ;
2. cherche une session active `open` pour ce visitor ;
3. si elle existe, elle est `touch` et reutilisee ;
4. sinon, charge l'instruction active `default` ;
5. assigne les variantes A/B via `assignChatVariants(visitorId)` ;
6. cree une ligne `chat_session` ;
7. ajoute un event `session_open`.

References :

- creation ou reutilisation session : `apps/web/src/lib/chat/services/session-service.ts:37`
- instruction active obligatoire : `apps/web/src/lib/chat/services/session-service.ts:44`
- event `session_open` : `apps/web/src/lib/chat/services/session-service.ts:64`

`sessionService.snapshot` :

1. recharge la session ;
2. liste les 200 derniers messages ;
3. charge les suggestions page-aware depuis `chat_canned_pair` ;
4. retourne `sessionId`, `language`, `status`, `suggestions`, `messages`, variantes.

References :

- snapshot : `apps/web/src/lib/chat/services/session-service.ts:72`
- suggestions page-aware : `apps/web/src/lib/chat/services/session-service.ts:111`

## 4. Envoi d'un message libre

### 4.1 Composer

`ChatComposer` contient la textarea et le bouton envoyer. Il :

- refuse l'envoi si texte vide ;
- refuse l'envoi si `isStreaming = true` ;
- envoie sur `Enter` sans `Shift` ;
- garde `Shift+Enter` pour nouvelle ligne ;
- affiche `Stop` pendant le streaming ;
- `Stop` appelle `cancel()` qui abort le flux.

Fichier : `apps/web/src/components/chat/ChatComposer.tsx`

### 4.2 Hook `useChatSend`

Quand la visiteuse envoie un texte :

1. trim du message ;
2. verification `sessionId` et `!isStreaming` ;
3. emission tracking `chat_message_sent` avec `session_id`, index, longueur ;
4. creation d'un message user optimiste local avec id temporaire `tmp_*` ;
5. suppression des suggestions initiales ;
6. reset de l'erreur ;
7. creation d'un `AbortController` ;
8. appel `readSseStream` vers `POST /api/chat/message`.

References :

- debut `send` : `apps/web/src/components/chat/hooks/use-chat-send.ts:26`
- tracking sent : `apps/web/src/components/chat/hooks/use-chat-send.ts:33`
- push optimiste : `apps/web/src/components/chat/hooks/use-chat-send.ts:39`
- appel SSE : `apps/web/src/components/chat/hooks/use-chat-send.ts:95`

### 4.3 Lecture SSE cote client

`readSseStream` utilise `fetch` et lit `res.body.getReader()`. Ce choix est volontaire : `EventSource` ne permet pas un `POST` avec body JSON.

Format attendu :

```text
event: start
data: {"messageId":"cm_...","language":"fr"}

event: chunk
data: {"messageId":"cm_...","delta":"Bonjour"}
```

Fichier : `apps/web/src/components/chat/sse-reader.ts`

### 4.4 Cadence humanisee

Les chunks backend ne sont pas injectes directement dans l'UI. `useChatSend` les met en file (`chunkQueue`), puis `humanizeStream` ajoute :

- delai minimum avant premier token ;
- jitter 30-60 ms ;
- pause sur ponctuation ;
- respect `prefers-reduced-motion`.

References :

- queue et cadence : `apps/web/src/components/chat/hooks/use-chat-send.ts:57`
- append delta : `apps/web/src/components/chat/hooks/use-chat-send.ts:82`
- implementation cadence : `apps/web/src/components/chat/humanize.client.ts`

### 4.5 Effet des evenements SSE sur le store

`useChatSend` traite :

- `start` : fixe la langue si elle change, appelle `beginStreaming(messageId)`, ajoute une bulle assistant vide ;
- `chunk` : mesure first token, emet `chat_message_received`, pousse le delta dans la queue ;
- `source` : attache les sources RAG au message assistant ;
- `end` : attend la fin du cadenceur, passe le message en `sent`, emet `chat_message_complete` ;
- `lead-form-offer` : met `leadOffer` dans le store, ce qui fera apparaitre `LeadFormBubble` ;
- `error` : met l'erreur dans le store et termine le streaming.

References :

- `start` : `apps/web/src/components/chat/hooks/use-chat-send.ts:100`
- `chunk` : `apps/web/src/components/chat/hooks/use-chat-send.ts:106`
- `source` : `apps/web/src/components/chat/hooks/use-chat-send.ts:118`
- `end` : `apps/web/src/components/chat/hooks/use-chat-send.ts:122`
- `lead-form-offer` : `apps/web/src/components/chat/hooks/use-chat-send.ts:133`
- `error` : `apps/web/src/components/chat/hooks/use-chat-send.ts:146`

## 5. Route `POST /api/chat/message`

La route serveur est dans `apps/web/src/app/api/chat/message/route.ts`.

Pipeline exact :

1. `assertChatEnabled()` ; si off : `404`.
2. parse JSON ; si invalide : `400 invalid-json`.
3. validation Zod `chatMessageInput` ; si invalide : `400 invalid-input`.
4. chargement session par `sessionRepo.getById`.
5. si session introuvable : `404 session-not-found`.
6. rate limit par session.
7. rate limit par IP.
8. creation d'un `AbortController`.
9. si la requete client est abort, abort du provider.
10. retour `streamSSE`, qui ecrit chaque evenement de `streamReply()`.

References :

- validation feature flag : `apps/web/src/app/api/chat/message/route.ts:25`
- validation input : `apps/web/src/app/api/chat/message/route.ts:42`
- lookup session : `apps/web/src/app/api/chat/message/route.ts:52`
- rate limit session/IP : `apps/web/src/app/api/chat/message/route.ts:67`
- abort client : `apps/web/src/app/api/chat/message/route.ts:94`
- boucle `streamReply` : `apps/web/src/app/api/chat/message/route.ts:98`

Le helper `streamSSE` encode les evenements au format :

```text
event: <nom>
data: <json>

```

Headers :

- `Content-Type: text/event-stream; charset=utf-8`
- `Cache-Control: no-store, no-transform`
- `X-Accel-Buffering: no`
- `Connection: keep-alive`

Fichier : `apps/web/src/lib/chat/services/stream.ts`

## 6. Orchestrateur serveur `streamReply`

`streamReply` est le coeur metier. Il prend :

```ts
{
  session: ChatSessionRow,
  text: string,
  signal?: AbortSignal
}
```

et retourne un `AsyncIterable<ChatStreamEvent>`.

### 6.1 Sanitation, langue et intention

Au debut :

1. `sanitizeAndRedact(input.text)` :
   - trim ;
   - normalisation des espaces ;
   - limite 2000 caracteres ;
   - masque email, telephone, IBAN, carte bancaire, CNI, codes postaux ;
   - conserve `contentRaw` et `contentSafe`.
2. `detectLanguage(contentSafe)` :
   - detecte `fr`, `ar`, `ar-MA`.
3. `detectIntent(contentSafe)` :
   - classe l'intention par regex ponderee.
4. `charterFilter.inbound(contentSafe)` :
   - bloque si la charte refuse l'entree.

References :

- sanitation/langue/intention : `apps/web/src/lib/chat/services/orchestrator.ts:65`
- charter inbound : `apps/web/src/lib/chat/services/orchestrator.ts:70`

Important : le LLM ne recoit jamais le texte brut si une PII est detectee. Il recoit `contentSafe`.

### 6.2 Embedding partage

L'orchestrateur essaye d'embedder la question une seule fois via `embedTexts([contentSafe])`.

Ce vecteur sert a deux choses :

- upgrade d'intent vectoriel si la regex tombe sur `misc` ;
- matching FAQ vectoriel.

Si aucun provider embedding n'est disponible, l'erreur `EmbeddingProviderUnavailableError` est ignoree proprement : la conversation continue avec regex + RAG/LLM si possible.

References :

- embedding : `apps/web/src/lib/chat/services/orchestrator.ts:82`
- upgrade intent vectoriel : `apps/web/src/lib/chat/services/orchestrator.ts:104`

### 6.3 Persistance du message user

Le message user est persiste avant toute reponse assistant :

Table : `chat_message`  
Champs principaux :

- `sessionId`
- `role = user`
- `content = contentSafe`
- `contentRaw`
- `contentSafe`
- `language`
- `status = sent`

Puis un event `message_sent_user` est ajoute avec :

- `messageId`
- `redactions`
- `intent`
- `intentSource`
- `charter`

La session est aussi mise a jour avec la langue detectee.

References :

- creation message user : `apps/web/src/lib/chat/services/orchestrator.ts:125`
- event user : `apps/web/src/lib/chat/services/orchestrator.ts:135`
- update langue session : `apps/web/src/lib/chat/services/orchestrator.ts:142`

### 6.4 Instruction active et memoire conversationnelle

L'orchestrateur charge l'instruction active `default` via `instructionRepo.active('default')`. Si aucune instruction active n'existe, il retourne un evenement SSE :

```json
{ "event": "error", "data": { "code": "no-instruction" } }
```

Ensuite il charge la memoire courte :

```ts
messageRepo.recentForMemory(sessionId, 12)
```

Cette memoire contient les 12 derniers messages `user`/`assistant` avec `status = sent`.

References :

- instruction active : `apps/web/src/lib/chat/services/orchestrator.ts:144`
- memoire 12 messages : `apps/web/src/lib/chat/services/orchestrator.ts:153`

### 6.5 Escalade frustration

Si l'intention detectee est `frustration`, l'orchestrateur appelle `notifyFrustrationSpike` en fire-and-forget. Cet appel ne bloque pas le flux.

Reference : `apps/web/src/lib/chat/services/orchestrator.ts:155`

### 6.6 Cascade FAQ vectorielle

Avant d'appeler un LLM, le systeme teste une FAQ vectorielle :

1. si `questionVector` existe ;
2. appel `faqRepo.matchByEmbedding(questionVector, { language, audience: 'all' })` ;
3. si une entree passe son threshold :
   - cree un message assistant `sent` ;
   - `modelName = faq:<key>` ;
   - event `message_sent_agent` avec source `faq` ;
   - stream SSE immediat :

```text
start
chunk (reply complete)
end
```

Dans ce cas, aucun LLM n'est appele.

References :

- match FAQ : `apps/web/src/lib/chat/services/orchestrator.ts:177`
- persistance assistant FAQ : `apps/web/src/lib/chat/services/orchestrator.ts:185`
- events SSE FAQ : `apps/web/src/lib/chat/services/orchestrator.ts:213`

### 6.7 RAG knowledge base

Si la FAQ ne matche pas, l'orchestrateur tente un RAG :

```ts
ragService.retrieve({
  question: contentSafe,
  language,
  topK: 4,
})
```

Le RAG :

- embedde la question ;
- cherche dans `chat_knowledge_embedding` avec pgvector ;
- retourne les chunks lies aux sources `chat_knowledge_source` ;
- applique un re-rank heuristique ;
- renvoie les meilleurs chunks.

Si le RAG echoue, la conversation continue sans contexte.

References :

- appel RAG : `apps/web/src/lib/chat/services/orchestrator.ts:237`
- service RAG : `apps/web/src/lib/chat/rag/service.ts`

### 6.8 Construction du prompt LLM

Le prompt final est compose de :

1. message system = instruction active dans la langue choisie ;
2. contexte RAG concatene, si disponible ;
3. memoire recente de la conversation ;
4. dernier message user `contentSafe`.

Le choix de langue d'instruction :

- `ar` -> `bodyAr` si disponible ;
- `ar-MA` -> `bodyArMa` si disponible ;
- sinon `body`.

References :

- construction contexte RAG : `apps/web/src/lib/chat/services/orchestrator.ts:253`
- messages LLM : `apps/web/src/lib/chat/services/orchestrator.ts:265`

### 6.9 Selection provider

`providerRouter.choose('chat')` selectionne un provider actif :

- trie par priorite via `providerRepo.listByRole`;
- saute les providers avec circuit breaker ouvert ;
- saute les providers ayant depasse leur quota mensuel ;
- instancie l'adapter via `instantiateProvider`.

Si aucun provider n'est disponible, SSE `error` avec `code = no-provider`.

References :

- selection provider : `apps/web/src/lib/chat/services/orchestrator.ts:276`
- router : `apps/web/src/lib/chat/services/provider-router.ts`

### 6.10 Streaming assistant LLM

Avant d'appeler le provider, l'orchestrateur cree un message assistant vide :

- `role = assistant`
- `content = ''`
- `status = streaming`
- `providerId`
- `modelName`
- `parentMessageId = userMessage.id`

Puis il emet :

```text
event: start
data: { messageId, language }
```

S'il y a des sources RAG, il emet aussi :

```text
event: source
data: { messageId, sources: [...] }
```

Ensuite `adapter.streamChat(req)` renvoie un stream de chunks. Chaque `chunk.delta` est :

- ajoute a `aggregated` ;
- emis au client via SSE `chunk`.

References :

- pre-creation assistant : `apps/web/src/lib/chat/services/orchestrator.ts:290`
- SSE start/source : `apps/web/src/lib/chat/services/orchestrator.ts:302`
- loop streaming provider : `apps/web/src/lib/chat/services/orchestrator.ts:321`

### 6.11 Finalisation assistant

Apres la fin du stream provider :

1. `final()` recupere tokens, cout et modele final ;
2. calcule `latencyMs` et `firstTokenMs` ;
3. applique `charterFilter.outbound` ;
4. met a jour le message assistant :
   - `content = aggregated`
   - `contentSafe = aggregated`
   - `tokensIn`
   - `tokensOut`
   - `latencyMs`
   - `firstTokenMs`
   - `cost`
   - `modelName`
   - `status = sent`
   - `ragHits`
5. incremente le cout provider ;
6. ajoute event `message_sent_agent` ;
7. marque le provider en succes ;
8. emet SSE `end`.

References :

- final provider : `apps/web/src/lib/chat/services/orchestrator.ts:337`
- charter outbound : `apps/web/src/lib/chat/services/orchestrator.ts:341`
- update assistant : `apps/web/src/lib/chat/services/orchestrator.ts:354`
- cout provider : `apps/web/src/lib/chat/services/orchestrator.ts:368`
- event agent : `apps/web/src/lib/chat/services/orchestrator.ts:371`
- SSE end : `apps/web/src/lib/chat/services/orchestrator.ts:381`

### 6.12 Gestion des erreurs provider

Si le provider echoue pendant le stream :

- `providerRouter.recordFailure(row.id, retryable)` ;
- message assistant passe en `status = error` ;
- `errorCode` est rempli ;
- event `error` en DB ;
- SSE `error` vers le client.

Reference : `apps/web/src/lib/chat/services/orchestrator.ts:550`

## 7. Capture lead apres reponse

Apres le `end`, l'orchestrateur execute une logique lead best-effort. Elle ne doit pas casser la reponse chat.

### 7.1 Toggle runtime

Le systeme lit :

```ts
getRuntimeBool('lead_form_enabled', true)
```

Si false, pas d'offre lead.

Reference : `apps/web/src/lib/chat/services/orchestrator.ts:394`

### 7.2 Detection telephone inline

Point critique : le telephone est detecte dans `sanitized.contentRaw`, pas dans `contentSafe`.

Raison : `sanitizeAndRedact` remplace les numeros par `[telephone]` avant envoi au LLM. Si la detection utilisait `contentSafe`, elle ne verrait plus le numero.

References :

- commentaire critique : `apps/web/src/lib/chat/services/orchestrator.ts:386`
- detection raw : `apps/web/src/lib/chat/services/orchestrator.ts:403`

### 7.3 Decision d'offrir le formulaire

`shouldOfferLeadForm` recoit :

- l'historique recent ;
- l'intention courante ;
- la reponse assistant ;
- `alreadyOffered` ;
- `enabled`.

Raisons possibles :

- `inline-contact` : numero detecte ;
- `explicit-request` : demande de rappel/humain ;
- `purchase-intent` : achat explicite ;
- `b2b` ;
- `frustration` ;
- `out-of-knowledge` ;
- `objection-repeat` ;
- `long-no-progress` ;
- `after-hours` ;
- engagement long.

Si la decision est positive :

1. event DB `chat_lead_form_offered` ;
2. SSE `lead-form-offer` avec `messageId`, `reason`, `copyKey`.

References :

- decision : `apps/web/src/lib/chat/services/orchestrator.ts:433`
- event + SSE offer : `apps/web/src/lib/chat/services/orchestrator.ts:440`
- regles : `apps/web/src/lib/chat/services/lead-decision.ts`

### 7.4 Creation automatique de lead sur telephone tape en clair

Si la visiteuse tape son numero directement dans le chat :

1. `detectInlineContact` extrait numero, prenom eventuel, pays, confiance ;
2. si confiance `high` ou `medium`, on calcule `identityHash` ;
3. si aucun lead avec cette identite dans la session :
   - creation d'un `chat_lead` avec `triggerReason = inline-contact` ;
   - `firstName = detection.firstName ?? 'Visiteur'` ;
   - `consentVersion = CHAT_LEAD_CONSENT_VERSION + inline-fallback` ;
   - snapshot des 6 derniers messages ;
   - event `chat_lead_auto_created` ;
   - alerte hot lead ;
   - webhook inline-contact fire-and-forget.

Ce filet de securite permet de ne pas perdre un numero meme si le formulaire n'est jamais soumis.

References :

- condition telephone : `apps/web/src/lib/chat/services/orchestrator.ts:470`
- creation auto lead : `apps/web/src/lib/chat/services/orchestrator.ts:489`
- event auto lead : `apps/web/src/lib/chat/services/orchestrator.ts:509`
- webhook inline : `apps/web/src/lib/chat/services/orchestrator.ts:527`

## 8. Formulaire lead cote client

`LeadFormBubble` s'affiche dans `MessageList` apres le message assistant declencheur.

Etats UI :

- `offered` : texte + CTA + bouton "plus tard" ;
- `open` : formulaire prenom, pays, telephone, note ;
- `submitting` : bouton bloque ;
- `error` : erreur traduite ;
- `success` : message de confirmation.

Champs :

- prenom : requis, min 2, max 40 ;
- pays : `MA`, `FR`, `BE`, `CH`, `DZ`, `TN` ;
- telephone : `tel`, min 6, max 20, pattern numerique souple ;
- note : facultative, max 200 ;
- honeypot `_phone_alt`, cache.

Tracking emis :

- `chat_lead_form_view`
- `chat_lead_form_focus`
- `chat_lead_form_submit`
- `chat_lead_form_dismiss`
- `generate_lead` apres succes.

Soumission :

```text
POST /api/chat/lead/contact
```

Payload :

```json
{
  "sessionId": "cs_...",
  "triggeringMessageId": "cm_...",
  "triggerReason": "purchase-intent",
  "firstName": "Sara",
  "phoneRaw": "0612345678",
  "countryHint": "MA",
  "note": "facultatif",
  "consent": true,
  "consentVersion": "2026-05-06",
  "language": "fr"
}
```

Fichier : `apps/web/src/components/chat/LeadFormBubble.tsx`

## 9. Route `POST /api/chat/lead/contact`

Pipeline exact :

1. feature flag chat ;
2. toggle runtime `lead_form_enabled` ;
3. parse JSON ;
4. validation Zod `chatLeadContactInput` ;
5. honeypot : si rempli, repond faux succes `cl_dummy` ;
6. rate limit IP ;
7. lookup session ;
8. normalisation telephone `parsePhone` ;
9. dedup par `(session, identityHash)` ;
10. si lead inline-contact existe deja, upgrade du lead ;
11. sinon creation d'un nouveau `chat_lead` ;
12. event `chat_lead_form_submit` ;
13. alerte hot lead ;
14. webhook lead ;
15. email interne `lead-notification` ;
16. reponse `{ ok, leadId, outcomeMessage, webhookStatus }`.

References :

- toggle lead : `apps/web/src/app/api/chat/lead/contact/route.ts:62`
- validation Zod : `apps/web/src/app/api/chat/lead/contact/route.ts:73`
- honeypot : `apps/web/src/app/api/chat/lead/contact/route.ts:80`
- rate limit IP : `apps/web/src/app/api/chat/lead/contact/route.ts:92`
- session : `apps/web/src/app/api/chat/lead/contact/route.ts:105`
- parse phone : `apps/web/src/app/api/chat/lead/contact/route.ts:110`
- identity hash/dedup : `apps/web/src/app/api/chat/lead/contact/route.ts:119`
- snapshot messages : `apps/web/src/app/api/chat/lead/contact/route.ts:135`
- upgrade inline-contact : `apps/web/src/app/api/chat/lead/contact/route.ts:148`
- creation lead : `apps/web/src/app/api/chat/lead/contact/route.ts:172`
- event submit : `apps/web/src/app/api/chat/lead/contact/route.ts:194`
- webhook : `apps/web/src/app/api/chat/lead/contact/route.ts:207`
- email interne : `apps/web/src/app/api/chat/lead/contact/route.ts:221`

## 10. Suggestions rapides et canned pairs

Les suggestions initiales ne sont pas du texte libre envoye au LLM. Ce sont des "canned pairs" :

1. `sessionService.snapshot` charge jusqu'a 4 suggestions via `cannedPairRepo.listForPage`.
2. `MessageList` affiche les pills.
3. Au clic, `useCannedPair.triggerPill(key, label)` :
   - pousse un message user optimiste ;
   - retire les suggestions ;
   - appelle `POST /api/chat/canned-pair` ;
   - recoit une reponse assistant pre-ecrite ;
   - simule une frappe via `humanizeStream` ;
   - si la pair declenche un lead, appelle `receiveLeadOffer`.

La route `POST /api/chat/canned-pair` :

- valide feature flag ;
- parse/valide input ;
- appelle `cannedPairService.trigger`.

`cannedPairService.trigger` :

- charge la session ;
- refuse session fermee ;
- charge la pair par key ;
- refuse pair non publiee/desactivee ;
- choisit label/reply localises ;
- cree un message user et un message assistant en DB ;
- ajoute event `suggestion_clicked` ;
- touche la session ;
- retourne DTOs + flags CTA/lead.

Fichiers :

- `apps/web/src/components/chat/hooks/use-canned-pair.ts`
- `apps/web/src/app/api/chat/canned-pair/route.ts`
- `apps/web/src/lib/chat/services/canned-pair-service.ts`

## 11. Modele de donnees

### 11.1 Tables principales

`chat_instruction_version`  
Stocke les instructions systeme versionnees. Une seule instruction active par scope grace a l'index unique partiel.

Reference : `apps/web/src/lib/chat/db/schema.ts:30`

`chat_theme_preset`  
Stocke tokens, layout, motion, salutations par page.

Reference : `apps/web/src/lib/chat/db/schema.ts:56`

`chat_provider_config`  
Stocke les providers chat/embedding/moderation/rerank :

- kind : openai, gemini, anthropic, mistral, etc. ;
- priority ;
- role ;
- modeles ;
- cle API chiffree ;
- parametres ;
- quota ;
- cout consomme ;
- `egressAllowed`.

Reference : `apps/web/src/lib/chat/db/schema.ts:94`

`chat_session`  
Session visiteur :

- `visitorId`
- `fingerprintHash`
- `language`
- `page`, `referrer`, `utm`
- instruction/theme/variant
- status `open|idle|archived|purged`
- conversion order
- consent

Reference : `apps/web/src/lib/chat/db/schema.ts:148`

`chat_message`  
Messages user/assistant/system/tool :

- contenu safe/brut ;
- langue ;
- tokens ;
- latence ;
- provider/modele ;
- RAG hits ;
- moderation ;
- cout ;
- status.

Reference : `apps/web/src/lib/chat/db/schema.ts:193`

`chat_knowledge_source`, `chat_knowledge_chunk`, `chat_knowledge_embedding`  
Base de connaissance RAG :

- source markdown/url/pdf/docx/faq/snippet ;
- chunks ;
- embeddings pgvector 1536 dimensions.

References :

- source : `apps/web/src/lib/chat/db/schema.ts:242`
- chunk : `apps/web/src/lib/chat/db/schema.ts:278`
- embedding : `apps/web/src/lib/chat/db/schema.ts:308`

`chat_conversation_event`  
Journal append-only KPI. Il trace :

- session open ;
- widget open/close ;
- messages user/agent ;
- feedback ;
- suggestion clicked ;
- rate limits ;
- conversion ;
- lead form offered/view/focus/dismiss/submit ;
- webhook sent/failed ;
- auto lead ;
- frustration.

Reference : `apps/web/src/lib/chat/db/schema.ts:334`

`chat_rate_limit_bucket`  
Buckets de rate limit par `ip`, `session`, `visitor`.

Reference : `apps/web/src/lib/chat/db/schema.ts:414`

`chat_runtime_setting`  
Toggles DB runtime. Le flag env reste le kill switch principal.

Reference : `apps/web/src/lib/chat/db/schema.ts:440`

`chat_lead`  
Lead capture in-chat ou checkout. Pour le chat :

- `sessionId`
- `triggeringMessageId`
- `triggerReason`
- `firstName`
- `phoneE164`, `phoneRaw`
- consent
- visitor/fingerprint/page/referrer/utm
- langue/intention
- snapshot messages
- webhook status
- outcome agent humain
- champs funnel checkout eventuels.

Reference : `apps/web/src/lib/chat/db/schema.ts:457`

## 12. Contrats HTTP et SSE

### 12.1 `GET /api/chat/session`

Reponse :

```json
{
  "sessionId": "cs_...",
  "language": "fr",
  "status": "open",
  "greeting": "",
  "suggestions": [
    { "key": "kit-reserve", "label": "..." }
  ],
  "messages": [
    {
      "id": "cm_...",
      "role": "assistant",
      "content": "...",
      "language": "fr",
      "status": "sent",
      "createdAt": "..."
    }
  ],
  "themeVariantId": "default",
  "variantOpaqueId": "default"
}
```

### 12.2 `POST /api/chat/message`

Input :

```json
{
  "sessionId": "cs_...",
  "text": "Bonjour, je veux commander",
  "lang": "fr",
  "context": {
    "page": "/kit",
    "currentCart": [{ "sku": "kit", "qty": 1 }]
  }
}
```

Contraintes :

- `text` : min 1, max 2000 ;
- `sessionId` obligatoire ;
- `lang` optionnel.

Evenements SSE possibles :

- `start` : `{ messageId, language }`
- `source` : `{ messageId, sources }`
- `chunk` : `{ messageId, delta }`
- `end` : `{ messageId, latencyMs }`
- `lead-form-offer` : `{ messageId, reason, copyKey }`
- `error` : `{ messageId?, code, message? }`

### 12.3 `POST /api/chat/canned-pair`

Input :

```json
{
  "sessionId": "cs_...",
  "key": "kit-reserve",
  "language": "fr"
}
```

Reponse :

```json
{
  "ok": true,
  "userMessage": {},
  "assistantMessage": {},
  "ctaLabel": null,
  "ctaUrl": null,
  "allowFollowupLlm": true,
  "triggersLeadForm": false,
  "leadFormCopyKey": null
}
```

### 12.4 `POST /api/chat/lead/contact`

Input detaille dans la section 8.

Reponse :

```json
{
  "ok": true,
  "leadId": "cl_...",
  "outcomeMessage": "Merci ! Une conseillere vous appellera tres vite...",
  "webhookStatus": "sent"
}
```

## 13. Analytics et evenements

Il y a deux couches d'analytics :

1. Cote client via `useTracking().emit(...)`, qui pousse les events marketing/dataLayer.
2. Cote serveur via `eventRepo.append(...)`, qui alimente `chat_conversation_event`.

Evenements client notables :

- `chat_message_sent`
- `chat_message_received`
- `chat_message_complete`
- `chat_lead_form_offered`
- `chat_lead_form_view`
- `chat_lead_form_focus`
- `chat_lead_form_submit`
- `chat_lead_form_dismiss`
- `generate_lead`

Evenements serveur notables :

- `session_open`
- `message_sent_user`
- `message_sent_agent`
- `suggestion_clicked`
- `rate_limit_hit`
- `chat_lead_form_offered`
- `chat_lead_form_submit`
- `chat_lead_auto_created`
- `chat_lead_form_upgrade`
- `chat_lead_webhook_sent`
- `chat_lead_webhook_failed`
- `inline_contact_webhook_sent`
- `inline_contact_webhook_failed`
- `frustration_detected`

La route publique `POST /api/chat/event` permet aussi de persister certains evenements UI simples : widget open/close, suggestion clicked, language switch, rate limit, lead form view/focus/dismiss.

Fichier : `apps/web/src/app/api/chat/event/route.ts`

## 14. Conditions d'erreur importantes

### 14.1 Cote API message

- chat desactive : `404 Not Found`
- JSON invalide : `400 invalid-json`
- input invalide : `400 invalid-input`
- session introuvable : `404 session-not-found`
- rate limit session/IP : `429 rate-limited`
- provider indisponible : SSE `error no-provider`
- instruction absente : SSE `error no-instruction`
- erreur stream : SSE `error stream-failed` ou code provider

### 14.2 Cote client

- si `fetch` SSE retourne non-OK : erreur `SSE failed: HTTP <status>` ;
- si SSE `error` : `store.error = code` ;
- si abort par bouton Stop : pas d'erreur affichee si `AbortError`.

### 14.3 Cote lead

- lead form desactive : `503 lead-form-disabled`
- input invalide : `400 invalid-input`
- honeypot rempli : faux succes `cl_dummy`
- rate limit IP : `429 rate-limited`
- session introuvable : `404 session-not-found`
- telephone invalide : `422 invalid-phone`
- doublon non inline-contact : `409 lead-already-captured`

## 15. Comment reproduire le systeme a l'identique

### 15.1 Prerequis fonctionnels

Pour reproduire le chat, il faut imperativement :

1. Un widget React avec store client :
   - session persistante ;
   - messages volatils ;
   - etat streaming ;
   - lead offer.
2. Une route de session :
   - visitor id ;
   - get active session ;
   - create session si absente ;
   - snapshot messages + suggestions.
3. Une route message SSE :
   - validation input ;
   - rate limit ;
   - orchestrateur async generator ;
   - helper SSE.
4. Un orchestrateur :
   - sanitize/redact ;
   - detect language ;
   - detect intent regex + vector ;
   - persist user ;
   - instruction active ;
   - memory window ;
   - FAQ vectorielle ;
   - RAG ;
   - provider router ;
   - stream provider ;
   - persist assistant ;
   - couts/tokens ;
   - lead decision ;
   - inline auto lead.
5. Une base Postgres :
   - sessions ;
   - messages ;
   - events ;
   - providers ;
   - instructions ;
   - knowledge source/chunk/embedding ;
   - leads ;
   - rate limits.
6. Une capture lead :
   - formulaire client ;
   - validation serveur ;
   - normalisation phone ;
   - identity hash ;
   - webhook ;
   - email interne.

### 15.2 Sequence minimale d'un message

```text
Client:
  send(text)
  trim
  push tmp user message
  clear suggestions
  POST /api/chat/message { sessionId, text }

Server route:
  assert enabled
  validate input
  get session
  consume rate limit session
  consume rate limit ip
  streamSSE(streamReply)

Orchestrator:
  sanitize contentRaw/contentSafe
  detect language
  detect intent
  check inbound charter
  embed question if possible
  persist user message
  event message_sent_user
  update session language
  load instruction
  load recent memory
  optional FAQ match
  optional RAG
  choose provider
  create assistant message streaming
  yield start
  yield sources if any
  for each provider chunk:
    aggregate
    yield chunk
  final provider
  update assistant sent
  event message_sent_agent
  yield end
  evaluate lead decision
  optional yield lead-form-offer
  optional auto-create inline-contact lead

Client:
  start -> beginStreaming
  chunk -> humanizeStream -> appendDelta
  source -> setSources
  end -> endStreaming
  lead-form-offer -> receiveLeadOffer
```

### 15.3 Schema logique minimal

```text
chat_session 1---N chat_message
chat_session 1---N chat_conversation_event
chat_session 1---N chat_lead
chat_instruction_version 1---N chat_session
chat_provider_config 1---N chat_message
chat_knowledge_source 1---N chat_knowledge_chunk 1---N chat_knowledge_embedding
chat_message 1---N chat_feedback
```

### 15.4 Elements a ne pas oublier

- Le message local user est optimiste et temporaire ; le vrai message user serveur est stocke en DB mais n'est pas renvoye immediatement dans le SSE.
- Le client voit surtout le `messageId` assistant.
- Les chunks backend sont recadences cote client ; le temps vu par la visiteuse n'est donc pas exactement le temps provider brut.
- Les numeros sont masques avant LLM mais detectes depuis `contentRaw` pour les leads.
- La FAQ vectorielle peut court-circuiter totalement le LLM.
- Le RAG peut echouer sans casser le chat.
- Les webhooks/alertes lead sont majoritairement non bloquants ou best-effort.
- Le circuit breaker provider est en memoire process.
- Le kill switch env peut retirer le widget et rendre les routes 404.

## 16. Carte des fichiers a connaitre

Frontend public :

- `apps/web/src/components/chat/ChatWidgetMount.tsx`
- `apps/web/src/components/chat/ChatWidget.tsx`
- `apps/web/src/components/chat/ChatLauncher.tsx`
- `apps/web/src/components/chat/ChatPanel.tsx`
- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/components/chat/MessageList.tsx`
- `apps/web/src/components/chat/MessageBubble.tsx`
- `apps/web/src/components/chat/ChatComposer.tsx`
- `apps/web/src/components/chat/LeadFormBubble.tsx`
- `apps/web/src/components/chat/chat-store.ts`
- `apps/web/src/components/chat/hooks/use-chat-session.ts`
- `apps/web/src/components/chat/hooks/use-chat-send.ts`
- `apps/web/src/components/chat/hooks/use-canned-pair.ts`
- `apps/web/src/components/chat/sse-reader.ts`
- `apps/web/src/components/chat/humanize.client.ts`

Routes publiques :

- `apps/web/src/app/api/chat/session/route.ts`
- `apps/web/src/app/api/chat/message/route.ts`
- `apps/web/src/app/api/chat/canned-pair/route.ts`
- `apps/web/src/app/api/chat/lead/contact/route.ts`
- `apps/web/src/app/api/chat/event/route.ts`
- `apps/web/src/app/api/chat/feedback/route.ts`
- `apps/web/src/app/api/chat/theme/route.ts`
- `apps/web/src/app/api/chat/health/route.ts`

Services backend :

- `apps/web/src/lib/chat/services/session-service.ts`
- `apps/web/src/lib/chat/services/orchestrator.ts`
- `apps/web/src/lib/chat/services/stream.ts`
- `apps/web/src/lib/chat/services/sanitize.ts`
- `apps/web/src/lib/chat/services/intent.ts`
- `apps/web/src/lib/chat/services/intent-vector.ts`
- `apps/web/src/lib/chat/services/embeddings.ts`
- `apps/web/src/lib/chat/services/provider-router.ts`
- `apps/web/src/lib/chat/services/lead-decision.ts`
- `apps/web/src/lib/chat/services/phone-detect.ts`
- `apps/web/src/lib/chat/services/lead-webhook.ts`
- `apps/web/src/lib/chat/services/lead-alerts.ts`
- `apps/web/src/lib/chat/services/frustration-alerts.ts`
- `apps/web/src/lib/chat/services/canned-pair-service.ts`
- `apps/web/src/lib/chat/rag/service.ts`

Repos DB :

- `apps/web/src/lib/chat/db/schema.ts`
- `apps/web/src/lib/chat/db/client.ts`
- `apps/web/src/lib/chat/repos/session.ts`
- `apps/web/src/lib/chat/repos/message.ts`
- `apps/web/src/lib/chat/repos/event.ts`
- `apps/web/src/lib/chat/repos/lead.ts`
- `apps/web/src/lib/chat/repos/provider.ts`
- `apps/web/src/lib/chat/repos/instruction.ts`
- `apps/web/src/lib/chat/repos/faq.ts`
- `apps/web/src/lib/chat/repos/canned-pair.ts`
- `apps/web/src/lib/chat/repos/knowledge.ts`

Admin :

- `apps/web/src/app/admin/chat/page.tsx`
- `apps/web/src/app/admin/chat/conversations/page.tsx`
- `apps/web/src/app/admin/chat/conversations/[id]/page.tsx`
- `apps/web/src/app/admin/chat/leads/page.tsx`
- `apps/web/src/app/admin/chat/faq/page.tsx`
- `apps/web/src/app/admin/chat/suggestions/page.tsx`
- `apps/web/src/app/admin/chat/providers/page.tsx`
- `apps/web/src/app/admin/chat/instructions/page.tsx`
- `apps/web/src/components/admin/chat/*`

Tests utiles :

- `apps/web/e2e/chat-visitor.spec.ts`
- `apps/web/e2e/chat-mobile-ux.spec.ts`
- `apps/web/e2e/chat-lead-capture.spec.ts`
- `apps/web/e2e/chat-admin.spec.ts`
- `apps/web/src/components/chat/hooks/use-chat-send.test.tsx`
- `apps/web/src/components/chat/lead-form-flow.test.tsx`
- `apps/web/src/lib/chat/services/orchestrator.test.ts`
- `apps/web/src/lib/chat/services/orchestrator-lead-capture.test.ts`
- `apps/web/src/app/api/chat/lead/contact/route.test.ts`

## 17. Points de vigilance techniques

1. Le rapport entre `contentRaw` et `contentSafe` est central. Pour la confidentialite LLM, utiliser `contentSafe`. Pour detecter les telephones inline, utiliser `contentRaw`.
2. La route SSE ne renvoie pas le message user serveur. Le client garde l'optimistic user local jusqu'au prochain snapshot.
3. La FAQ vectorielle sort du flux avant la decision lead post-LLM. Dans l'etat actuel, le chemin FAQ retourne avant la logique lead de fin d'orchestrateur.
4. Le provider breaker est in-memory. En multi-instance, chaque process a son propre etat.
5. Le RAG et l'embedding sont tolerants aux pannes : cela degrade la qualite mais ne bloque pas la conversation.
6. Les webhooks lead sont concus pour ne pas casser l'UX, mais le statut est trace en DB.
7. `leadOfferDismissedSessionId` bloque les offres soft apres dismiss, mais les raisons fortes (`explicit-request`, `purchase-intent`, `inline-contact`, `manual`) peuvent repasser.
8. Le formulaire lead n'a pas de checkbox explicite de consentement ; il envoie `consent: true` et affiche une note de transparence.
9. Les suggestions canned-pair court-circuitent le LLM et creent directement les deux messages en DB.
10. En cas de reload, `useChatSession` doit recharger snapshot car messages/suggestions ne sont pas persistants localement.

## 18. Resume operationnel

Le chat FemiGlow est un systeme hybride : il donne l'impression d'une conversation live grace au SSE et au cadenceur client, mais il optimise cout et controle editorial avec une cascade avant LLM : canned pairs, FAQ vectorielle, RAG, puis provider IA. Tout est rattache a une session visiteur persistante, les messages sont stockes en DB, les evenements sont append-only, et la conversion est traitee comme un sous-flux complet : detection d'intention, offre formulaire, capture telephone, dedup, webhook, notification interne et suivi admin.

Pour reproduire le fonctionnement a l'identique, la partie la plus importante n'est pas seulement le widget : c'est la chaine complete `store client -> session snapshot -> SSE message -> orchestrateur -> DB events/messages -> lead decision -> lead form/contact`, car chaque etape porte une responsabilite differente et plusieurs comportements critiques sont volontairement best-effort pour ne jamais bloquer la conversation.
