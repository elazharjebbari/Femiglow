# Scénarios métier — Webhooks entrants & événements

Personas :
- **Stalwart** (MTA, source des événements SMTP outbound).
- **Listmonk** (moteur de broadcast, source des événements campagne/abonné).
- **Imane**, opérateur care, surveille `/admin/emails/events` et le cockpit.

---

## S-WHK-1 — « Le mail de Kaoutar est livré, le KPI bouge » (chemin nominal)

**Contexte** : la confirmation de commande de `kaoutar@exemple.test` a été envoyée
(`email_outbox.status='sent'`, `smtp_message_id='<msg-42@femiglow-maroc.com>'`).

1. Stalwart livre le message et POST `delivery.delivered` avec `messageId='<msg-42@...>'`.
2. Le récepteur authentifie (header timing-safe), parse, corrèle par `smtp_message_id`.
3. Transaction : `outbox.status='delivered'` + `email_event(delivered)` + bridge `user_event(email.delivered, source=email)`.
4. **Oracle UI** : Imane recharge `/admin/emails/events`, voit la ligne `email.delivered` (badge vert source=email), total 24h +1. Le KPI « Livrés 7j » du dashboard s'incrémente.

**Garantie** : c'est exactement le flux **cassé en prod** (W-URL : 0 delivered jamais reçu).
Le test prouve que *quand* l'événement arrive, l'état transitionne.

---

## S-WHK-2 — « Adresse morte : hard bounce, chaîne complète » (chemin critique F-072)

**Contexte** : `ancienne-adresse@exemple.test` n'existe plus chez le destinataire.

1. Stalwart POST `delivery.failed` `errorCode=550 reason='5.1.1 user unknown'`.
2. `isHardBounce(550)=true` → **transaction unique** applique les 5 effets :
   - `outbox.status='bounced_permanent'`, `bounceType='hard'`.
   - `email_event(bounced_hard)`.
   - `email_suppression(reason='hard_bounce')` (ON CONFLICT DO NOTHING).
   - `email_subscriber_link.status='blocklisted'`.
   - `listmonk.subscribers.blocklist(['ancienne-adresse@exemple.test'])`.
3. **Oracle** : un envoi ultérieur (transactionnel **ou** campagne Listmonk) vers cette
   adresse est bloqué (`isSuppressed` côté FemiGlow + blocklist côté Listmonk).

**Garantie** : couvre W-SOFT (distinction), W-BLK (blocklist), W-OUT (outbox màj).

---

## S-WHK-3 — « Soft bounce : on ne supprime PAS à vie » (anti-régression W-SOFT)

1. Stalwart POST `delivery.failed errorCode=452 'mailbox full'` (temporaire).
2. `isHardBounce(452)=false` → `bounced_soft` + `email_event(bounced_soft)` + incrément compteur.
3. **AUCUNE** suppression, **AUCUN** blocklist.
4. La boîte se libère ; un envoi ultérieur passe normalement.
5. Si N soft consécutifs (cible : seuil configurable) → alors seulement escalade en suppression.

**Garantie** : le bug audit « soft → suppression à vie » devient impossible.

---

## S-WHK-4 — « Stalwart retente : pas de double effet » (anti-rejeu W-REPLAY)

1. Réseau instable : Stalwart livre le `delivery.failed (550)` **3 fois**.
2. L'index unique `(source, smtp_message_id, type, ts)` + `ON CONFLICT DO NOTHING`
   garantit : **1** `email_event`, **1** suppression, outbox transitionné une seule fois.
3. **Oracle** : `SELECT count(*) FROM email_event WHERE ... = 1` et `email_suppression` = 1 ligne.

---

## S-WHK-5 — « Événement orphelin : on ne jette rien » (W-CORR / W-ORPH)

1. Stalwart POST `delivery.delivered messageId='<inconnu@x>'` (race : l'outbox n'a pas
   encore son `smtp_message_id` écrit, ou message émis par un autre système).
2. **Cible** : au lieu du `200 {ignored:'unknown-message-id'}` qui **jette l'info**, on
   persiste `email_event(outboxId=NULL, correlation='orphan', rawJson)`.
3. Un job de réconciliation (ou un retry de corrélation) peut plus tard rattacher l'event.
4. **Oracle** : `SELECT count(*) FROM email_event WHERE outbox_id IS NULL` = 1 (l'info survit).

---

## S-WHK-6 — « Listmonk termine une campagne, l'opérateur voit les chiffres » (transitions gardées W-TRANS)

1. Imane lance la campagne « Soldes Aïd » ; FemiGlow crée `email_campaign_link(status='sending')`.
2. Listmonk POST `campaign.completed id=7 sent=4200 views=900 clicks=120 bounces=18`.
3. Dispatcher : `status='sent'` + compteurs.
4. **Course** : un `campaign.started id=7` retardé arrive **après**. La garde voit
   `status='sent'` (terminal) → **ignore**. Les compteurs ne sont pas écrasés à 0.
5. **Oracle** : `email_campaign_link.status='sent'`, `sentCount=4200` inchangé.

---

## S-WHK-7 — « Payload tronqué d'un proxy : pas de retry-storm » (W-MALF)

1. Un reverse-proxy coupe le body → Listmonk POST un JSON partiel (signature HMAC valide
   sur ce body partiel).
2. Le schéma Zod échoue. **Cible** : persistance `email_event(type='malformed', orphan)`
   + **`200`** côté Listmonk (sinon Listmonk re-livre en boucle → retry-storm).
3. Côté Stalwart, le même cas renvoie `400` (Stalwart back-off correctement sur 4xx).
4. **Oracle** : la trace existe en DB, et le compteur d'erreurs de la file Listmonk
   ne diverge pas.
