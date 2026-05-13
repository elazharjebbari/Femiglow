# 01 — Vision & Architecture

> Pourquoi ce système, comment les pièces s'articulent. À lire avant tout code. Diagrammes système, flux end-to-end, choix tech motivés.

## §1 — Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          UTILISATEUR ADMIN                                 │
│         (Souheila + opératrices, depuis Firefox/Chrome)                   │
└────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS + session FemiGlow
┌────────────────────────────────────────────────────────────────────────────┐
│       NEXT.JS 16 — admin.femiglow-maroc.com (Stalwart-FemiGlow VPS)        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  /admin/emails  /admin/emails/transactional  /admin/emails/campaigns │  │
│  │  /admin/emails/audiences  /admin/emails/templates                    │  │
│  │  /admin/emails/automation  /admin/emails/settings                    │  │
│  │                                                                      │  │
│  │  /admin/listmonk/* ← iframe avec proxy reverse → :9000 (loopback)    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  middleware/listmonk-sso.ts ─► valide session admin, injecte X-Forwarded-* │
│                                                                            │
│  /api/admin/emails/*                 ← endpoints internes FemiGlow         │
│  /api/listmonk/*                     ← passthrough proxy (auth gated)      │
│  /api/mail/webhook/stalwart          ← réception events delivery/bounce   │
│  /api/mail/webhook/listmonk          ← réception events campaign/sub      │
│  /api/mail/transactional/send        ← entrée applicative (interne)       │
│                                                                            │
│  lib/mail/                                                                 │
│    client.ts    ← nodemailer transport SMTP 127.0.0.1:587                  │
│    send.ts      ← sendTransactional() + outbox INSERT                      │
│    outbox.ts    ← retry cron + DLQ + idempotency                           │
│    templates/   ← react-email                                              │
│    listmonk/    ← client API typé pour broadcast/automation                │
└────────────────────────────────────────────────────────────────────────────┘
            │                          │                          │
            │ Listmonk API (loopback)  │ SMTP 587 (loopback)     │ Webhooks
            ▼                          ▼                          ▲
┌─────────────────────────────────┐  ┌─────────────────────────────────────┐
│  LISTMONK (Go, 127.0.0.1:9000)  │  │  STALWART MTA (*:587, *:25, *:993) │
│  Postgres dédiée `listmonk`     │  │  RocksDB /var/lib/stalwart/        │
│  • templates                    │  │  • DKIM RSA + Ed25519              │
│  • lists & subscribers          │  │  • queue + retry exponentiel       │
│  • campaigns                    │  │  • bounce detection                │
│  • bounces (POP3 ou webhook)    │  │  • IPREV / SPF check               │
│  • analytics open/click         │  │  • webhooks → FemiGlow             │
└─────────────────────────────────┘  └─────────────────────────────────────┘
                                                       │
                                                       ▼ SMTP 25 outbound
                                       ┌─────────────────────────────────┐
                                       │  Destinataires (Gmail, Outlook, │
                                       │  Yahoo, ProtonMail, etc.)       │
                                       └─────────────────────────────────┘
```

## §2 — Choix tech motivés

### 2.1 — Listmonk comme moteur emailing

Évalué contre :
- **In-house pur** : 4-6 semaines pour reproduire compositeur, bounce parser, segments, double opt-in, click rewrite. ROI négatif.
- **Mailtrain v2** : stack Node + MongoDB, dev ralenti, UX vieillissante.
- **Mautic** : marketing automation complète mais PHP, lourd, surdimensionné.
- **Postal** : excellent MTA mais doublonne Stalwart.
- **SaaS** (Resend, Brevo) : casse l'investissement Stalwart, dépendance, coût.

**Listmonk gagne** : binaire Go unique (~25 Mo), Postgres comme seul service externe, API REST complète, webhooks sortants, multi-utilisateur, RFC 8058 List-Unsubscribe natif, double opt-in, multilingue, sous licence AGPL. Communauté très active (3k+ ⭐, releases mensuelles).

### 2.2 — Stalwart comme MTA

Déjà installé et durci (cf. `docs/audit-stalwart-email.md`). Pas de raison de changer :
- DKIM RSA-2048 + Ed25519 (deux sélecteurs).
- DMARC `p=reject` strict côté DNS public.
- SPF correct.
- Queue + retry exponentiel.
- Webhooks sortants natifs (events `message.delivered`, `message.bounced`, etc.).
- Console admin intégrée (8080, gated par UFW).

### 2.3 — Iframe + SSO middleware (Niveau 2 d'intégration)

| Niveau | Intégration | Effort | Verdict |
|---|---|---|---|
| 1 — UI 100 % FemiGlow (proxy API) | Réécrire toutes les vues en Next.js | ~3 sem | sur-dimensionné |
| **2 — iframe + reverse proxy + SSO** | Wrapping de Listmonk dans une page admin | ~1 sem | **choisi** |
| 3 — Sous-domaine séparé `email.femiglow-maroc.com` | Aucune intégration | ~0,5 j | 2 logins, friction utilisateur |

Le **Niveau 2** combine simplicité d'implémentation et cohérence UX. Détails dans `03-backend-integration.md` §2.

### 2.4 — nodemailer pour le transactionnel

- Standard de fait Node.js (8 ans, ~30 M downloads/mois).
- Support natif STARTTLS port 587, AUTH PLAIN/LOGIN sur TLS.
- Zéro dépendance lourde.
- Pas besoin d'un SDK SaaS.
- Permet de passer **directement** à Stalwart via 127.0.0.1, contournant Listmonk → latence ~50 ms vs ~200 ms.

Pour les broadcasts, on **passe via Listmonk** (qui appelle Stalwart en SMTP) pour bénéficier du tracking pixel, click rewrite, et bounce parsing intégrés. Voir matrice §3.4.

### 2.5 — react-email pour les templates

- Composants React → HTML email (rendu côté serveur).
- Preview en RSC.
- Réutilisation des **tokens design** FemiGlow (brand sauge/champagne/petale).
- Variables typées (`{{ name }}` typé en TypeScript via Zod).
- Versionning Git natif.
- Fallback MJML pour les templates créés directement dans Listmonk WYSIWYG (import/export bidirectionnel).

## §3 — Flux end-to-end

### 3.1 — Envoi transactionnel (ex. formulaire de contact)

```
User submits /contact form
   │
   ▼
POST /api/contact (Next.js API route)
   │
   ├─► Zod validate payload
   ├─► dispatchContactWebhook() (existing CHA-260)
   └─► sendTransactional({                            ┌── nouveau (M1) ──┐
         template: 'contact-acknowledgement',         │                  │
         to: data.email,                              │  lib/mail/       │
         payload: { name, message_excerpt },          │                  │
         idempotency_key: `contact-ack:${ip}:${day}`  │                  │
       })                                             │                  │
       │                                              │                  │
       ▼                                              │                  │
       INSERT email_outbox (status='pending')         │                  │
       │                                              │                  │
       ▼ (immediate, non-blocking)                    │                  │
       nodemailer.sendMail({                          │                  │
         from: 'noreply@femiglow-maroc.com',          │                  │
         replyTo: 'info@femiglow-maroc.com',          │                  │
         to, subject, html, text,                     │                  │
         headers: {                                   │                  │
           'X-FG-Outbox-Id': outbox.id,               │                  │
           'List-Unsubscribe': '<https://…>',         │                  │
           'List-Unsubscribe-Post': 'One-Click'       │                  │
         }                                            │                  │
       }) → 127.0.0.1:587 (Stalwart)                  │                  │
       │                                              │                  │
       ├─► 250 OK → UPDATE outbox status='sent'       │                  │
       │           + messageId stocké                 │                  │
       │                                              └──────────────────┘
       └─► erreur (timeout/auth/transient) →
                  UPDATE outbox status='failed',
                  attempts++, next_retry=now+backoff
                  ▲
                  │
                  └── cron /api/cron/tick (60s) ramasse les pending/failed
                      avec next_retry <= now() et MAX_ATTEMPTS pas atteint

   Plus tard (asynchrone) :
   Stalwart livre vers MX destinataire
       │
       ├─► 250 OK MX dest → POST /api/mail/webhook/stalwart
       │   { event: 'message.delivered', queueId, rcpt, ts }
       │       │
       │       ▼ UPDATE outbox status='delivered'
       │              + INSERT email_event(type='delivered')
       │
       └─► 5xx perm → POST /api/mail/webhook/stalwart
           { event: 'message.delivery-failed', error_code, reason }
                  │
                  ▼ UPDATE outbox status='bounced_permanent'
                         + INSERT email_event(type='hard_bounce')
                         + INSERT email_suppression(email, reason)
                         + UPDATE listmonk subscriber status='bounced' (via API)
```

### 3.2 — Envoi broadcast (campagne newsletter)

```
Admin clique "Créer campagne" dans /admin/emails/campaigns
   │
   ▼
Wizard FemiGlow 6 étapes (cf. 06-wizard-specification.md)
   │
   ▼ Step 6 "Review & Send"
POST /api/admin/emails/campaigns
   │
   ├─► Validate (Zod)
   ├─► INSERT email_campaign_link
   ├─► Sync template vers Listmonk (idempotent)
   └─► POST /api/campaigns Listmonk (loopback)
       │
       └─► Listmonk : INSERT campaign + scheduling
              │
              ▼ (au moment planifié, ou immédiat)
              Listmonk worker prend les subscribers de la list
              et boucle : nodemailer-équivalent → Stalwart 587
                     ▲
              Pour chaque envoi :
                     │
              Stalwart DKIM-sign + queue + livraison
                     │
                     ├─► 250 OK MX → Listmonk webhook /campaigns/{id}/delivered
                     ├─► open pixel hit → Listmonk INSERT subscriber_event
                     └─► click sur URL trackée → Listmonk INSERT + 301 redirect

           Listmonk push event vers FemiGlow :
              POST /api/mail/webhook/listmonk
              { event: 'campaign.metrics', campaign_id, sent, opens, clicks, bounces }
                     │
                     ▼ UPDATE email_campaign_link metrics
                            + INSERT email_event row(s)
```

### 3.3 — Réception (réponse client)

```
Client répond à un mail (To: info@femiglow-maroc.com)
   │
   ▼ Internet → MX
Stalwart écoute :25
   │
   ├─► SPF + DKIM + DMARC du sender (anti-abus)
   ├─► RCPT TO: info@femiglow-maroc.com (existe ?)
   ├─► Stockage RocksDB mailbox info@
   │
   ▼
   Webmail Stalwart (https://mail.femiglow-maroc.com) ← humain lit
   (Aucune action côté FemiGlow app — c'est intentionnel cf. design Option B)
```

> Note : on **n'instrumente pas** la réception. Les humains lisent dans le webmail. Si plus tard on veut traiter automatiquement certaines adresses (ex. `support@`), on utilisera les webhooks Stalwart `message.received` ciblés sur ce compte. Cf. `03-backend-integration.md` §6.

### 3.4 — Matrice de routing par flux

| Flux | Émetteur | Route SQL outbox ? | Va via Listmonk ? | Latence cible |
|---|---|---|---|---|
| Formulaire contact (accusé) | `POST /api/contact` | Oui (FemiGlow) | Non (direct nodemailer) | < 200 ms |
| Reset password | `POST /api/auth/reset` | Oui | Non | < 200 ms |
| Accusé commande | webhook `order.created` | Oui | Non | < 500 ms |
| Notification lead urgent | `POST /api/chat/lead/contact` | Oui | Non | < 1 s |
| Newsletter envoi groupé | wizard `/admin/emails/campaigns` | Non (logged) | Oui (Listmonk = source) | n/a (planifié) |
| Double opt-in confirmation | `/api/admin/emails/subscribers/confirm` | Non | Oui | < 5 s |
| Automation post-achat J+7 | cron déclencheur | Hybride : INSERT outbox + appel Listmonk tx | Oui (template tx) | < 5 s par batch |

## §4 — Architecture des composants

```
apps/web/src/
├── app/
│   ├── (admin)/
│   │   └── admin/
│   │       └── emails/                          ← nouvelle section
│   │           ├── layout.tsx                   ← tabs + sidebar entry
│   │           ├── page.tsx                     ← dashboard global
│   │           ├── transactional/
│   │           │   ├── page.tsx                 ← liste outbox
│   │           │   └── [id]/page.tsx            ← détail + replay
│   │           ├── campaigns/
│   │           │   ├── page.tsx                 ← liste campagnes
│   │           │   ├── new/page.tsx             ← wizard ⭐
│   │           │   └── [id]/page.tsx            ← détail + métriques
│   │           ├── audiences/
│   │           │   ├── page.tsx                 ← lists / subscribers
│   │           │   └── [id]/page.tsx            ← détail liste
│   │           ├── templates/
│   │           │   ├── page.tsx                 ← studio
│   │           │   └── [id]/page.tsx            ← éditeur + preview
│   │           ├── automation/
│   │           │   ├── page.tsx                 ← workflows
│   │           │   └── [id]/page.tsx            ← détail trigger + steps
│   │           ├── settings/
│   │           │   └── page.tsx                 ← from/replyto/SMTP test
│   │           └── listmonk/                    ← iframe wrapper
│   │               └── [[...path]]/page.tsx
│   ├── api/
│   │   ├── admin/emails/                        ← endpoints internes
│   │   │   ├── campaigns/
│   │   │   ├── subscribers/
│   │   │   ├── templates/
│   │   │   ├── outbox/
│   │   │   └── stats/
│   │   ├── listmonk/                            ← proxy passthrough
│   │   │   └── [...path]/route.ts
│   │   └── mail/
│   │       ├── webhook/
│   │       │   ├── stalwart/route.ts
│   │       │   └── listmonk/route.ts
│   │       └── transactional/
│   │           └── send/route.ts
│   └── middleware.ts                            ← injecte listmonk-sso
├── lib/
│   ├── mail/                                    ← nouveau module mailer
│   │   ├── client.ts
│   │   ├── send.ts
│   │   ├── outbox.ts
│   │   ├── suppression.ts
│   │   ├── templates/
│   │   │   ├── contact-acknowledgement.tsx
│   │   │   ├── lead-notification.tsx
│   │   │   ├── newsletter-confirm.tsx
│   │   │   ├── order-confirmation.tsx
│   │   │   └── password-reset.tsx
│   │   ├── render.ts                            ← react-email → html/text
│   │   ├── catalog.ts                           ← inventaire des templates
│   │   ├── listmonk/                            ← typed API client
│   │   │   ├── client.ts
│   │   │   ├── campaigns.ts
│   │   │   ├── subscribers.ts
│   │   │   ├── lists.ts
│   │   │   ├── templates.ts
│   │   │   └── transactional.ts
│   │   ├── automation/
│   │   │   ├── runner.ts
│   │   │   ├── triggers/                        ← un fichier par trigger
│   │   │   └── conditions.ts
│   │   └── webhooks/                            ← parsers d'events entrants
│   │       ├── stalwart-parser.ts
│   │       └── listmonk-parser.ts
│   ├── admin/
│   │   └── emails/                              ← hooks RSC + actions
│   │       ├── queries.ts
│   │       └── actions.ts
│   └── audit/                                   ← réutilisé pour audit-log
├── components/
│   └── admin/emails/                            ← composants UI
│       ├── EmailNav.tsx
│       ├── KpiTile.tsx
│       ├── OutboxTable.tsx
│       ├── CampaignCard.tsx
│       ├── AudienceSelector.tsx
│       ├── TemplatePreview.tsx
│       ├── SubjectComposer.tsx
│       ├── MetricBadge.tsx
│       ├── BouncesPanel.tsx
│       ├── SuppressionList.tsx
│       └── wizard/                              ← ⭐ wizard détaillé
│           ├── CampaignWizard.tsx
│           ├── StepType.tsx
│           ├── StepAudience.tsx
│           ├── StepTemplate.tsx
│           ├── StepCompose.tsx
│           ├── StepSchedule.tsx
│           ├── StepReview.tsx
│           ├── WizardNav.tsx
│           ├── WizardProgress.tsx
│           └── useCampaignWizard.ts
└── db/
    └── schema/
        └── emails.ts                            ← tables Drizzle
```

## §5 — Limites & non-objectifs

**Non-objectifs explicites** :
- ❌ Pas de moteur d'A/B testing custom (on utilise Listmonk natif).
- ❌ Pas de scoring lead (cf. CRM out-of-scope, à voir avec Mautic plus tard si besoin).
- ❌ Pas de SMS/WhatsApp (channel email uniquement, malgré le nom Listmonk multichannel possible).
- ❌ Pas de réception programmatique des mails entrants (ils vont dans le webmail Stalwart, l'équipe répond manuellement). Évolution possible plus tard via webhook `message.received` filtré.
- ❌ Pas d'éditeur drag-and-drop côté FemiGlow (on utilise Listmonk WYSIWYG en iframe pour ça).
- ❌ Pas de templates marketplace.

**Limites assumées** :
- Le **wizard FemiGlow** couvre les 95 % de cas. Pour les 5 % avancés (HTML custom, segments dynamiques complexes), l'utilisateur bascule sur l'UI Listmonk en iframe.
- Volume cible jusqu'à **20k envois / campagne**. Au-delà, surveiller la charge Listmonk + Stalwart queue.
- Réputation IP : on parie sur `46.202.128.168`. Plan B documenté dans `10-observability-debugging.md` § Smarthost relay.

## §6 — Évolutivité

Le système est conçu pour absorber sans refonte :
- Ajout de nouveaux templates (déclarer dans `lib/mail/catalog.ts`).
- Nouveaux types de campagnes (Listmonk supporte déjà).
- Nouvelles automations (ajout d'un fichier dans `lib/mail/automation/triggers/`).
- Migration vers un second domaine (changer `MAIL_FROM` + ajouter compte Stalwart).
- Bascule vers smarthost externe pour résilience (config Stalwart `relay`, transparent côté app).
- Remplacement de Listmonk par un autre (re-implémenter `lib/mail/listmonk/client.ts` — surface API limitée).

## §7 — Références

- Audit Stalwart : `docs/audit-stalwart-email.md`
- Patterns webhooks existants : `apps/web/src/lib/webhooks/`
- Logger applicatif : `apps/web/src/lib/logging/logger.ts`
- Audit log : `apps/web/src/lib/audit/log-event.ts`
- Conventions admin : `docs/analytics/04-ui-design.md`
- Listmonk doc : https://listmonk.app/docs/
- react-email : https://react.email/
