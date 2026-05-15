# 2. Design — architecture cible

## 2.1 Vue d'ensemble des flows

### Flow A — Wizard checkout (chemin nominal)

```
User arrive sur /commander
   │
   ▼
[Step 1 — Infos]
   POST /api/checkout/lead { firstName, phone, sessionId, … }
   ├─ INSERT chat_lead (lead_captured_at=now, last_touched_step='lead')
   ├─ Schedule abandon check : aucune action, le cron scanner se chargera
   └─ Response 200 { leadId, nextStep: 'address' }
   │
   ▼
[Step 2 — Adresse]
   PATCH /api/checkout/lead/[leadId]/address { city, addressLine1, …, notes }
   ├─ UPDATE chat_lead.shipping_*, address_completed_at=now
   ├─ DISPATCH webhook event=`lead.step2_completed` (nouveau)
   │   ├─ payload sans transcript (wizard flow), avec note=shippingNotes
   │   └─ Stamp `step2_webhook_at=now()` (anti-doublon vs abandon scanner)
   └─ Response 200 { leadId, nextStep: 'payment' }
   │
   ▼
[Step 3 — Confirmation order]
   POST /api/checkout/order { leadId, items, paymentMethod, … }
   ├─ INSERT orders + order_items
   ├─ UPDATE chat_lead.purchased_at=now
   ├─ DISPATCH webhook event=`order.completed`  ← inchangé
   └─ Response 200 { orderId }
```

### Flow B — Wizard checkout (abandon step 1)

```
User fait Step 1 puis ferme l'onglet, distrait, oublie
   │
   ▼
[Step 1 — Infos]  → INSERT chat_lead, lead_captured_at=now
   │
   ▼   (5 min plus tard sans step 2)
[Cron tick `/api/cron/lead-step1-abandon`]
   ├─ SELECT chat_lead WHERE
   │     lead_captured_at < now - INTERVAL '<configured>' minutes
   │     AND address_completed_at IS NULL
   │     AND purchased_at IS NULL
   │     AND step1_abandon_webhook_at IS NULL
   ├─ Pour chaque lead :
   │   ├─ DISPATCH webhook event=`lead.step1_abandoned`
   │   │   └─ payload minimal (full_name, phone, source_channel, ip, gclid)
   │   └─ Stamp step1_abandon_webhook_at=now() (anti-doublon)
   └─ Lead ne sera plus retraité par ce scanner
```

### Flow C — Chat IA → lead

```
User chat avec IA, exprime intent
   │
   ▼
[Assistant détecte purchase-intent / objection / frustration]
   └─ Émet signal SSE `lead_form_offered`
   │
   ▼
[Front affiche LeadFormBubble, user soumet]
   POST /api/chat/lead/contact { firstName, phoneRaw, consentVersion, … }
   ├─ INSERT chat_lead (trigger_reason, snapshot_messages=[6 derniers msg])
   ├─ DISPATCH webhook event=`chat_lead.created` ← inchangé
   │   └─ payload AVEC champ conversation (nouveau)
   │       └─ Mapping snapshot_messages → conversation[{role,name,text,ts}]
   └─ Response 200 { ok, leadId, outcomeMessage }
```

## 2.2 Schéma DB — additions

### Nouvelle colonne `chat_lead`

```sql
ALTER TABLE chat_lead
  ADD COLUMN step1_abandon_webhook_at timestamp;

-- Index pour le scanner (filtre les leads à traiter rapidement)
CREATE INDEX idx_chat_lead_step1_abandon_pending
  ON chat_lead (lead_captured_at)
  WHERE address_completed_at IS NULL
    AND purchased_at IS NULL
    AND step1_abandon_webhook_at IS NULL;

-- Index pour anti-doublon webhook step2
ALTER TABLE chat_lead
  ADD COLUMN step2_webhook_at timestamp;
```

### Nouveau setting `tracking_settings`

```sql
INSERT INTO tracking_settings (key, value) VALUES
  ('lead.step1_abandon_timeout_minutes', '5')
  ON CONFLICT (key) DO NOTHING;
```

Setting lu par le scanner via le service `getTrackingSettings()`. Default 5 minutes si absent. Pas de migration côté schema (table existe déjà).

## 2.3 Format payload — extensions

### Schéma Zod enrichi (`lib/webhooks/outbound/payload.ts`)

```ts
export const conversationMessageSchema = z.object({
  role: z.enum(['user', 'bot', 'assistant', 'system']),
  name: z.string().max(80).optional(),
  text: z.string().max(4000),
  ts: z.string().datetime({ offset: true }),
});

export const outboundPayloadSchema = z.object({
  // existant
  id: z.string()…,
  ref: z.string().max(100).optional(),
  full_name: z.string()…,
  phone: z.string()…,
  // nouveau
  source: z.string().max(60).optional(), // alias canonique (ex. 'facebook_ad')
  conversation: z.array(conversationMessageSchema).max(50).optional(),
  // existant
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  // … etc
});
```

NB : `source` est en plus de `source_channel`. Distinction :
- `source` = canal canonique (Trello custom field "Source") — `facebook_ad`, `google_ads`, `direct`, `chat`, `referral`
- `source_channel` = sous-canal (instagram, fb-feed, fb-reel, ttclid, …)

### Mapping `snapshot_messages` → `conversation`

```ts
function snapshotToConversation(
  snapshot: Array<{ role: 'user' | 'assistant', content: string, at: string }>,
  userName: string,
): ConversationMessage[] {
  return snapshot.map((m) => ({
    role: m.role === 'user' ? 'user' : 'bot', // bot pour matcher le contrat
    name: m.role === 'user' ? userName : 'Assistant',
    text: m.content,
    ts: m.at,
  }));
}
```

Limites :
- Max 50 messages (sinon payload trop gros pour Trello card description)
- Texte tronqué à 4000 chars par message
- `name` user = `chat_lead.first_name` (ou "Visiteur" si null)

## 2.4 Builders — événements distincts

### Récapitulatif événements

| Event | Source builder | Trigger | Payload features |
|---|---|---|---|
| `order.completed` | `from-order.ts` | POST /api/checkout/order | Full payload : product, total, address, payment. Pas de conversation (sauf si chat_lead origine). |
| `lead.step2_completed` (nouveau) | `from-wizard-step2.ts` (nouveau) | PATCH /api/checkout/lead/.../address | Address + first_name + phone. Pas de produit. `note=shippingNotes`. |
| `lead.step1_abandoned` (nouveau) | `from-wizard-step1-abandon.ts` (nouveau) | Cron scanner | Minimal : full_name, phone, source_channel, gclid, ip. |
| `chat_lead.created` | `from-chat-lead.ts` (modifié) | POST /api/chat/lead/contact | Ajout du champ `conversation` (snapshot_messages mappé). `note` enrichi avec trigger_reason. |
| `cart.abandoned` | `cart-abandon-scanner.ts` (inchangé) | Cron 30min | Avec produit + adresse partielle. |

### Décision : chat_lead inclut-il conversation ?

**Oui, toujours** quand origin = chat (`source IN ('chat_widget','chat')` OU `trigger_reason IS NOT NULL`).

**Non** pour les leads wizard purs (Flow A) — ils n'ont pas de conversation chat à inclure.

### Décision : order.completed inclut-il conversation ?

**Conditionnel** : si `chat_lead.session_id` rattaché à une `chat_session` qui a >=1 message, alors oui (le user a chatté avant d'acheter). Sinon non.

## 2.5 Configurabilité admin

### Setting `lead.step1_abandon_timeout_minutes`

- Stockage : `tracking_settings` (key/value/updated_at)
- Default : `5`
- Range valide : `[1, 60]` (clampé côté serveur)
- Lecture : helper `getLeadStep1AbandonTimeoutMinutes()` avec cache 60s
- UI : composant `LeadAbandonTimeoutSetting.tsx` dans `/admin/tracking/settings`
  - Input number, range 1-60
  - Bouton "Sauvegarder"
  - Tooltip explicatif : "Si le client commence un formulaire (nom+phone) puis ne valide pas son adresse dans ce délai, on envoie quand même le lead au CRM avec les infos minimales."

### Setting `lead.step2_webhook_enabled`

- Stockage : idem
- Default : `true`
- Bouleen pour pouvoir couper temporairement l'envoi webhook step2 sans déployer

## 2.6 Anti-doublons (idempotency)

| Cas | Mécanisme | Détail |
|---|---|---|
| Step 1 dispatché 2× (retry navigateur) | `Idempotency-Key` header + scope `lead_create` | Existe déjà |
| Webhook step2 envoyé 2× (retry réseau) | `outbound_webhook_log.idempotency_key` UNIQUE | Existe déjà |
| Step1 abandonné, user revient et fait step2 ensuite | `step1_abandon_webhook_at` est stamped → scanner ne le retraitera plus. Step2 fire le webhook step2_completed (event distinct). Receveur Trello peut soit fusionner soit créer une 2e carte. | Nouvelle colonne |
| Cart abandon + step1 abandon sur même lead | Events distincts (`lead.step1_abandoned` vs `cart.abandoned`). Chacun a son timestamp anti-doublon (`step1_abandon_webhook_at` vs `abandon_webhook_at`). | Indépendants par design |

## 2.7 Sécurité & privacy

- **HMAC signature** : header `x-femiglow-signature: sha256=<hmac>` calculé sur le body raw. Le receveur Trello vérifie.
- **Phone PII** : déjà E.164 normalisé. Pas de logging du phone en clair dans `outbound_webhook_log.last_error` (filtrage).
- **Conversation PII** : les messages utilisateur peuvent contenir des infos personnelles. Le receveur du webhook doit être conforme RGPD. La conservation est implicite côté Trello/CRM (durée variable selon paramètre client).
- **Consent** : le webhook fire uniquement si `chat_lead.consent_version IS NOT NULL` (consentement collecté au step 1).

## 2.8 Observabilité

| Métrique | Source | Alerting |
|---|---|---|
| Webhook success rate par event | `outbound_webhook_log` `status='sent' / total` | Slack si < 90% sur 1h |
| Latency p95 webhook | `outbound_webhook_log.latency_ms` | Slack si > 3000ms sur 1h |
| Leads step1 abandonnés / jour | Count `chat_lead WHERE step1_abandon_webhook_at IS NOT NULL` group by day | Daily digest |
| Conversation length avg | `chat_lead WHERE source='chat_widget'` AVG(jsonb_array_length(snapshot_messages)) | Daily digest |
| Failed webhooks à rejouer | `outbound_webhook_log WHERE status='failed' AND created_at > now()-24h` | Hourly check |

## 2.9 Décisions ouvertes (à valider avec le user)

1. **Faut-il envoyer step1_abandoned au webhook même si phone n'est pas validé E.164 ?** → Proposition : non, skip avec log (cohérent avec phone-gate actuel).
2. **Le step2_completed webhook bloque-t-il l'utilisateur s'il échoue ?** → Proposition : non, fire-and-forget (cohérent avec order webhook). L'user voit le step 3 quoi qu'il arrive.
3. **Faut-il un endpoint admin de "rejeu" pour les webhooks failed ?** → Proposition : oui, simple bouton "Retry" dans `/admin/leads/webhooks` qui re-dispatch avec nouvelle idempotency-key suffixée `:retry-N`.
4. **Conservation conversation côté payload : limite 50 messages ?** → Proposition : oui, 50 messages max OR 30Ko de payload total. Au-delà, tronquer aux 50 derniers messages.
