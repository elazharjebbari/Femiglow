# 00 — Executive Summary

> Une page pour décideur. Lire `README.md` pour la cartographie complète.

## Ce qu'on construit

Un système d'emailing **complet et self-host** intégré à l'admin FemiGlow :
- Envois **transactionnels** (contact, reset, accusés) — latence < 200 ms.
- **Newsletter / broadcast** — composition WYSIWYG, segments, A/B, planification.
- **Automations** (workflows déclenchés : abandon panier, post-achat J+7, anniversaire).
- Tableaux de bord (envois, ouvertures, clics, bounces, désabonnements).
- Gestion centralisée des **listes d'abonnés** avec double opt-in CNDP/RGPD.

## Pourquoi cette architecture (vs alternatives)

| Option | Choisie ? | Raison |
|---|---|---|
| **Listmonk derrière Stalwart, iframe dans admin FemiGlow** | ✅ | Couvre 100 % du périmètre, ~1 semaine d'intégration, self-host, gratuit, mature. |
| 100 % in-house (réécrire Listmonk) | ❌ | ~4-6 semaines pour reproduire ce qui existe. ROI négatif. |
| SaaS (Resend, Brevo, Mailjet) | ❌ | Casse l'investissement Stalwart. Coût récurrent. Dépendance tiers. |
| Mautic / Postal | ❌ | Trop lourds, UX 2015, doublonne Stalwart ou nécessite stack séparée. |

## Composants

```
        ┌─────────────────────────────────────────────┐
        │  Admin FemiGlow (Next.js 16)                │
        │  https://admin.femiglow-maroc.com/admin/    │
        │                                             │
        │  /admin/emails             ← liste, KPI     │
        │  /admin/emails/transactional ← outbox       │
        │  /admin/emails/campaigns   ← wizard custom  │
        │  /admin/emails/audiences   ← subscribers    │
        │  /admin/emails/templates   ← studio         │
        │  /admin/emails/automation  ← workflows      │
        │  /admin/emails/settings    ← config         │
        │  /admin/listmonk/*         ← iframe proxy   │
        └──────────────┬──────────────────────────────┘
                       │ API REST (interne, loopback)
                       │ + webhooks (event → FemiGlow)
                       ▼
        ┌─────────────────────────────────────────────┐
        │  Listmonk (binaire Go, 127.0.0.1:9000)      │
        │  • Templates, lists, segments               │
        │  • Compositeur WYSIWYG                      │
        │  • Bounce parser                            │
        │  • Tracking pixel + click rewrite           │
        │  • Double opt-in, List-Unsubscribe          │
        │  Postgres dédiée : DB `listmonk`            │
        └──────────────┬──────────────────────────────┘
                       │ SMTP submission 587 (STARTTLS)
                       │ AUTH noreply@femiglow-maroc.com
                       ▼
        ┌─────────────────────────────────────────────┐
        │  Stalwart MTA (déjà en place)               │
        │  • DKIM RSA + Ed25519                       │
        │  • Queue + retry                            │
        │  • Webhooks → FemiGlow (delivery/bounce)    │
        └─────────────────────────────────────────────┘
```

## Périmètre fonctionnel

| Capacité | Phase | Sources |
|---|---|---|
| Envoi transactionnel (5 flux : contact, lead chat, newsletter confirm, reset password, accusé commande) | M1 | nodemailer + outbox |
| Vue admin "Transactional" (liste, retry manuel, replay) | M1 | RSC + outbox |
| Listmonk installé + accessible via iframe SSO | M0 | binaire systemd |
| Templates studio (react-email + variables) | M2 | studio in-house + sync Listmonk |
| Wizard de campagne 6 étapes | M3 | composant custom |
| Audiences & segments (sync Listmonk lists) | M3 | bridge tables |
| Automation workflows déclenchés | M4 | cron + queue + Listmonk API tx |
| Dashboard analytics (open/click/bounce/unsubscribe par campagne, par template) | M5 | Listmonk metrics + Drizzle agregats |
| Hardening prod (rate limit, secrets rotation, monitoring) | M6 | runbook |

## Coût et effort

| Poste | Estimation |
|---|---|
| **Effort dev** | ~6 semaines (1 dev expérimenté plein temps) répartis sur M0→M6 |
| **Coût infra** | 0 € (Listmonk self-host sur le même VPS ; Stalwart déjà en place) |
| **Coût opérationnel récurrent** | ~30 min/semaine de monitoring (logs, bounces, suppression list) |
| **Coût domaine/DNS** | 0 € (DNS déjà configuré pour `femiglow-maroc.com`) |
| **Dépendances tierces** | Aucune (tout self-hosted) |
| **Lock-in vendor** | Nul. Listmonk = open source MIT ; Stalwart = AGPL/SSPL ; nodemailer = MIT |

## Risques principaux

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Crons FemiGlow tous `failed` → retry outbox HS | **élevée** (constaté) | élevé | **M0 préalable** : diagnose + réparer avant tout code emailing |
| Réputation IP `46.202.128.168` insuffisante pour volumes > 5k/jour | moyenne | élevé | Surveiller Postmaster Tools Google + SNDS Microsoft. Plan B : router via Stalwart → SendGrid relay si besoin. |
| Dérive UX (utilisateur perdu entre admin FemiGlow et UI Listmonk) | moyenne | moyen | Niveau 2 iframe + SSO + thème CSS override pour adoucir le saut visuel |
| Fuite de secrets Listmonk dans le navigateur | basse | critique | Proxy serveur uniquement, jamais d'appel direct depuis le client |
| Spam complaint au-delà du seuil → blacklist domaine | basse-moyenne | critique | Double opt-in obligatoire + List-Unsubscribe RFC 8058 + suppression list stricte |
| Dette UI Listmonk (style 2020) visible en iframe | moyenne | mineur | CSS override léger + tunneliser via composants natifs FemiGlow là où c'est critique |

## Mesure de succès

- **M1** : `POST /api/contact` envoie un mail visible côté destinataire en < 5 s. 0 % perte sur 100 envois consécutifs.
- **M3** : Une opératrice non-tech crée et planifie une campagne newsletter (1k subscribers) en < 15 minutes via le wizard, sans assistance.
- **M6** : Taux de livraison > 98 % (mesuré sur 30 jours), open rate > 25 % (sectoriel ecom Maroc), unsubscribe rate < 0,5 %, hard bounce rate < 2 %.

## Prochaine action

Lire **[`12-runbook.md`](12-runbook.md)** pour le séquencement opérationnel. Démarrer par M0 (`09-infrastructure-setup.md`) après réparation des crons FemiGlow.
