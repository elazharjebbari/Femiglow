# Module 09 — Parcours client emailing (CLI-*)

> Réf. inventaire : **F-090..F-097**.
> Couvre tous les emails déclenchés par le **client** ou par son action :
> opt-in post-achat, confirmation de commande, newsletter (double opt-in),
> accusé contact, notification interne de lead, désabonnement, panier abandonné,
> reset mot de passe.

---

## 1. Périmètre

| Réf | Fonctionnalité | Surface | Acteur |
|---|---|---|---|
| F-090 | Opt-in email post-achat (page merci) | UI publique + API | Client |
| F-091 | Confirmation de commande | backend déclenché | Client |
| F-092 | Formulaire newsletter + double opt-in | UI publique | Client |
| F-093 | Accusé réception contact | UI publique | Client |
| F-094 | Notification interne nouveau lead chat | backend déclenché | Opérateur |
| F-095 | Page unsubscribe publique | UI publique | Client |
| F-096 | Email panier abandonné | backend | Client |
| F-097 | Reset mot de passe | backend | Client |

### Fichiers sources concernés

- `src/app/api/checkout/order/[orderId]/email/route.ts` — **PATCH** opt-in post-achat (drift `lead_tag`).
- `src/app/api/checkout/order/route.ts` (lignes ~325-363) — envoi `order-confirmation` si email présent.
- `src/components/forms/NewsletterForm.tsx`, `src/app/api/newsletter/route.ts`, `src/app/api/newsletter/confirm/route.ts`, `src/lib/mail/templates/newsletter-confirm.tsx`.
- `src/app/api/contact/route.ts`, `src/lib/mail/templates/contact-acknowledgement.tsx`.
- `src/app/api/chat/lead/contact/route.ts` + `src/lib/mail/templates/lead-notification.tsx` + `src/lib/chat/services/lead-alerts.ts`.
- `src/app/api/mail/unsubscribe/route.ts` (GET/POST RFC 8058) + `src/lib/mail/unsub-token.ts`.
- `src/lib/mail/templates/cart-abandoned.tsx` + scanner `cart-abandon-scanner.ts`.
- `src/lib/mail/templates/password-reset.tsx` (jamais câblé — code mort).
- `src/lib/mail/send.ts` (`sendTransactional`, suppression check), `src/lib/db/schema.ts` (`leads`, `lead_tag`, `orders`).

---

## 2. Fonctionnement OPTIMAL (état cible)

### 2.1 Opt-in email post-achat — F-090 (le bug n°1)

Page merci (step 4) : le client coche « Je veux recevoir des conseils par email »,
saisit son email, valide. Le front appelle `PATCH /api/checkout/order/<orderId>/email`.

**État cible** :
1. Validation Zod (`optInEmailInputSchema`) : email valide + `emailConsent===true` (consentement explicite obligatoire).
2. Lookup `orders`, vérif `chatLeadId` présent.
3. **Idempotence** par `scope='email_optin'` + payload : un replay (double-clic, retry réseau) renvoie le même résultat, **un seul** tag créé.
4. Transaction cohérente : `chat_lead.email/email_consent`, `leads.email/consentMarketing`,
   **insert `lead_tag('post-purchase-optin')`**, `user_event('lead.email_optin_post_purchase')`.
5. Réponse `200 { status:'email_optin_saved' }`.

**Le drift à attraper** : `lead_tag.leadId` est `uuid` en DB mais typé `text` côté drizzle (ou inversement).
L'INSERT du tag fait **500** en prod (34 échecs/30j). **Seul un test d'intégration contre le
vrai schéma migré** déclenche l'erreur — les mocks la masquent. C'est `CLI-INT-OPTIN-DRIFT`.

### 2.2 Confirmation de commande — F-091

`POST /api/checkout/order` : après création de commande, **si** `leadSnapshot.email` est présent,
on `sendTransactional({template:'order-confirmation', idempotencyKey:'order-confirm:<orderId>'})`.

**Bug prod** : 0 envoyée en 30j pour 128 commandes → l'email est **absent au moment du checkout**
(capturé seulement après coup via l'opt-in cassé). **État cible** :
1. Si l'email est connu au checkout → confirmation partie, **idempotente par `orderId`**.
2. Si l'email arrive **après** (opt-in post-achat réussi) → l'opt-in déclenche la confirmation
   (ou une automation sur `lead.email_optin_post_purchase`).
3. Contenu exact : `firstName`, `orderId`, `orderTotal` formaté **`199.00 MAD`** (devise MAD, locale fr),
   `itemsCount`, `deliveryEstimate` (`2-4 jours ouvrés` ou `retrait en boutique`).

### 2.3 Newsletter double opt-in bout-en-bout — F-092

1. `NewsletterForm` POST `/api/newsletter` (consent `literal(true)`).
2. Route : génère token HMAC, `sendTransactional('newsletter-confirm', idempotencyKey:'newsletter-confirm:<email>')`.
3. Client clique le lien → `GET /api/newsletter/confirm?t=<token>` → **upsert `email_subscriber_link(status='enabled', doubleOptinConfirmedAt)`**.
4. **État cible (gap prod)** : `email_subscriber_link` est ensuite **synchronisé vers Listmonk**
   (audit : 0 ligne en prod, newsletter jamais poussée). La confirmation crée la ligne *et* déclenche la sync.
5. Page HTML de confirmation rendue (sans JS client).

### 2.4 Accusé contact — F-093

`POST /api/contact` → `sendTransactional('contact-acknowledgement')`. OK apparent ; on densifie
(grille d'échecs front + idempotence + suppression respectée).

### 2.5 Notification interne lead — F-094

Nouveau lead chat → notification interne (`lead-notification` + alerte Slack `notifyHotLead`).
**Risque audit** : l'adresse interne (`info@femiglow-maroc.com`) peut être **suppressée** par un
bounce et alors **ne plus recevoir** les notifications. **État cible** : **allowlist** des adresses
internes — `sendTransactional` ne bloque **jamais** une adresse interne, même suppressée.

### 2.6 Unsubscribe public — F-095

`GET/POST /api/mail/unsubscribe?t=<token>` (RFC 8058 one-click). Token HMAC valide →
`email_suppression(reason='unsubscribe')` + `email_subscriber_link.status='disabled'`.
**État cible (garantie forte)** : après désabonnement, l'adresse ne reçoit **plus aucun email
NULLE PART** — ni transactionnel FemiGlow (`isSuppressed`), ni campagne Listmonk (blocklist),
ni newsletter. C'est `CLI-INT-UNSUB-NOWHERE`.

### 2.7 Panier abandonné — F-096

Template `cart-abandoned` + automation `cart-abandoned-1h`. **État cible** : contexte
**personnalisé** (produit réel du panier, prénom, lien de reprise) au lieu du placeholder figé.

### 2.8 Reset mot de passe — F-097

`password-reset.tsx` existe mais **aucun call-site** (code mort). État cible : soit câblé sur un
vrai flow, soit explicitement marqué hors-périmètre. Test = `CLI-UNIT-PWRESET-DEADCODE`
(détecte l'absence de call-site pour éviter la fausse promesse).

---

## 3. Diagramme

`parcours-client-email.puml` — séquence du parcours complet « Kaoutar » (commande → opt-in →
confirmation → désabonnement) avec les points de rupture audit annotés.

---

## 4. Écarts audit ciblés

| Code | Constat prod | Garantie de test |
|---|---|---|
| C-OPTIN | PATCH opt-in **500** (drift `lead_tag` uuid/text) — 34 échecs/30j | `CLI-INT-OPTIN-DRIFT` : intégration vraie DB, devient ROUGE sur le drift. |
| C-CONF | order-confirmation **jamais** envoyée (0/30j) — email absent au checkout | `CLI-INT-CONF-PRESENT` : email présent ⇒ confirmation partie ; `CLI-INT-CONF-LATE` : opt-in tardif la déclenche. |
| C-SUBLINK | `email_subscriber_link`=0 ligne (newsletter jamais sync Listmonk) | `CLI-INT-NL-SUBLINK` : confirm crée la ligne ; `CLI-INT-NL-SYNC` : sync Listmonk déclenchée. |
| C-INTERNAL | notification lead vulnérable à suppression de l'adresse interne | `CLI-INT-INTERNAL-ALLOWLIST` : adresse interne suppressée reçoit quand même. |
| C-PWRESET | password-reset jamais câblé | `CLI-UNIT-PWRESET-DEADCODE` : détecte l'absence de call-site. |
| C-UNSUB | tests unsubscribe à densifier | `CLI-INT-UNSUB-NOWHERE` : plus aucun envoi nulle part. |
| C-CART | cart-abandoned inactif + contexte placeholder | `CLI-INT-CART-CONTEXT` : contexte personnalisé réel. |

---

## 5. Stratégie de test (couches)

- **Intégration vraie DB (couche 3)** : `specs/optin-postpurchase.integration.test.ts` — le test
  qui devient rouge sur le drift `lead_tag`. + confirmation idempotente, sublink, allowlist, unsub.
- **E2E (couche 4)** : `specs/e2e-thankyou-optin.spec.ts` — page merci réelle : saisie, consentement,
  succès, erreurs, idempotence replay, lecture de l'email via Mailpit.
- **Composant + MSW (couche 2)** : `NewsletterForm` / `ContactForm` (grille d'échecs 401/422/500/hang).
- **Unit (couche 1)** : `optInEmailInputSchema`, formatage `orderTotal` MAD, `unsub-token`, dead-code pw-reset.

Voir `test-matrix.csv` (≥ 50 lignes), `scenarios-metier.md`, `test-plan.yaml`.
