# Scénarios métier — Parcours client emailing

Personas :
- **Kaoutar**, 29 ans, Casablanca. Commande un kit FemiGlow, donne son email à la fin.
- **Nourelhouda**, s'inscrit à la newsletter depuis le footer.
- **Imane**, opératrice care, reçoit la notification interne quand un lead chaud tombe.

---

## S-CLI-1 — « Kaoutar commande un kit, opte pour l'email, reçoit sa confirmation, puis se désabonne » (parcours complet, ≥ 4 étapes)

C'est le scénario pivot du module. Il traverse F-090, F-091, F-095 et le drift `lead_tag`.

1. **Commande** — Kaoutar finalise sur la page checkout. À ce stade elle **n'a pas** encore
   donné d'email → `POST /api/checkout/order` crée la commande, `leadSnapshot.email=null`,
   **aucune** order-confirmation partie (comportement attendu, documenté `CLI-INT-CONF-ABSENT`).
2. **Opt-in (page merci)** — step 4, Kaoutar coche « recevez nos conseils », saisit
   `kaoutar@exemple.test`, valide. Le front `PATCH /api/checkout/order/<orderId>/email`.
   - **État cible** : transaction OK → `chat_lead.email`, `leads.email/consentMarketing`,
     **`lead_tag('post-purchase-optin')`**, `user_event('lead.email_optin_post_purchase')`.
   - **Bug prod** : l'INSERT `lead_tag` échoue en 500 (drift uuid/text). `CLI-INT-OPTIN-DRIFT`
     est ROUGE tant que le schéma n'est pas aligné.
3. **Confirmation** — l'opt-in (ou une automation sur l'event) déclenche
   `order-confirmation` vers `kaoutar@exemple.test`, idempotente par `orderId`. Kaoutar
   reçoit « Confirmation commande o_test… — 199.00 MAD, 1 article, livraison 2-4 jours ouvrés ».
   **Oracle E2E** : l'email est lisible dans Mailpit (`readLastEmail`).
4. **Désabonnement** — plus tard, Kaoutar clique « se désinscrire » (lien `List-Unsubscribe`).
   `GET /api/mail/unsubscribe?t=<token>` → `email_suppression(unsubscribe)` +
   `email_subscriber_link.status='disabled'` + blocklist Listmonk. Page « Désinscription confirmée ✓ ».
5. **Garantie finale** — un envoi ultérieur (transactionnel ou campagne) vers Kaoutar est
   **bloqué partout**. `CLI-E2E-008` : aucun nouveau message dans Mailpit après le désabonnement.

**Couvre** : C-OPTIN, C-CONF, C-UNSUB. C'est le test de non-régression du bug n°1 du système.

---

## S-CLI-2 — « Le drift qui fait 500 » (intégration vraie DB, F-090)

1. DB de test migrée avec **les vraies migrations drizzle** (pas de mock).
2. Seed : une `orders` liée à un `chat_lead`, un `leads` legacy.
3. `PATCH /api/checkout/order/<orderId>/email` avec `{email, emailConsent:true}`.
4. **Oracle** : la route répond `200` **et** `SELECT * FROM lead_tag WHERE tag='post-purchase-optin'`
   renvoie 1 ligne. Si le type de `lead_tag.leadId` diverge (uuid en DB vs text drizzle),
   l'INSERT lève → la route fait `500` → le test échoue **bruyamment**. C'est précisément la
   couche qui manquait (les mocks acceptaient n'importe quel type).
5. **Replay** : rejouer le même PATCH (même `Idempotency-Key`) → `status:'email_optin_saved'`,
   replay=true, **toujours 1 seul** `lead_tag` (`CLI-INT-OPTIN-REPLAY`).

---

## S-CLI-3 — « Nourelhouda s'inscrit à la newsletter » (double opt-in, F-092)

1. `NewsletterForm` : Nourelhouda saisit son email, coche le consentement, soumet.
   - Grille d'échecs front : 401/422/500/hang → message clair, **jamais de faux succès**,
     consentement non coché ⇒ envoi bloqué (`CLI-MSW-002..006`).
2. `POST /api/newsletter` → `newsletter-confirm` enqueue (idempotent par email).
3. Nourelhouda clique le lien → `GET /api/newsletter/confirm?t=<token>` :
   - **`email_subscriber_link(status='enabled', doubleOptinConfirmedAt)`** créé (`CLI-INT-NL-SUBLINK`).
   - **Sync Listmonk** déclenchée (`CLI-INT-NL-SYNC`) — comble le gap prod « 0 subscriber_link, jamais sync ».
4. Page « Inscription confirmée ✨ ».
5. **Oracle** : après confirmation, `email_subscriber_link` contient la ligne **et** Listmonk
   a reçu le `POST /api/subscribers` (intercepté MSW).

---

## S-CLI-4 — « La notification interne survit à un bounce » (allowlist, F-094)

1. Un hard bounce a, par erreur, suppressé `info@femiglow-maroc.com` (adresse interne).
2. Imane attend une notification de lead chaud.
3. Un nouveau lead chat tombe → `lead-notification` vers `info@femiglow-maroc.com`.
4. **Bug audit** : `isSuppressed('info@...')===true` ⇒ l'envoi serait **bloqué**, Imane ne voit rien.
5. **État cible** : `sendTransactional` consulte une **allowlist** des adresses internes ⇒
   l'adresse interne **n'est jamais bloquée**, même suppressée. `CLI-INT-INTERNAL-ALLOWLIST`.
6. **Oracle** : l'outbox contient bien la notification (`status != 'suppressed'`).

---

## S-CLI-5 — « Le mail de confirmation ne part jamais deux fois » (idempotence, F-091)

1. Réseau instable : le client re-soumet le checkout (même `orderId`, retry idempotency).
2. `sendTransactional` utilise `idempotencyKey='order-confirm:<orderId>'`.
3. **Oracle** : `SELECT count(*) FROM email_outbox WHERE template='order-confirmation' AND
   payload_json->>'orderId' = '<orderId>'` = 1. Une seule confirmation, jamais de doublon.

---

## S-CLI-6 — « password-reset est une fausse promesse » (dead-code, F-097)

1. Le template `password-reset.tsx` existe ; un opérateur pourrait croire la feature active.
2. `CLI-UNIT-PWRESET-DEADCODE` grep tout le source pour un call-site `sendTransactional(...'password-reset'...)`.
3. **Oracle** : 0 call-site ⇒ le test échoue avec un message explicite « template présent mais
   jamais déclenché — soit câbler, soit retirer ». Empêche la fausse promesse de dormir.
