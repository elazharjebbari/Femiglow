# Leads Multi-Step + Webhook Outbound — Spec & Plan

**Demandeur** : produit FemiGlow (E.J., 2026-05-15)
**Objectif** : robustifier la collecte des leads multi-étapes + le déclenchement webhook vers un endpoint externe (Trello/CRM) selon un contrat de payload défini.

## Cas couverts

1. **Formulaire wizard multi-étapes** (`/commander`, `/kit`, `/panier` checkout)
   - Step 1 : nom + téléphone → **sauvegarde immédiate en DB** (lead en cours)
   - Step 2 : ville + adresse + note → **enrichissement** + **webhook immédiat** sur validation
   - **Timeout abandon** : si pas de step 2 dans X minutes (5 par défaut, admin-configurable) → submit auto webhook
2. **Chat → lead** : capture lead depuis le chat IA → **webhook immédiat** avec transcript de la conversation embarqué (champ `conversation` du payload)

## Contrat du webhook

```json
{
  "id": "order-2026-0042",
  "ref": "#0042",
  "full_name": "Youssef Amrani",
  "phone": "0661234567",
  "source": "facebook_ad",
  "conversation": [
    { "role": "user", "name": "Sara", "text": "...", "ts": "2026-05-14T10:01:00Z" },
    { "role": "bot",  "name": "Assistant", "text": "...", "ts": "2026-05-14T10:01:12Z" }
  ],
  "address": "12 Rue Al Houda",
  "city": "Marrakech",
  "country": "Maroc",
  "email": "y@example.com",
  "total_price": 399.0,
  "currency": "MAD",
  "quantity": 1,
  "product_name": "Montre",
  "product_variant": "42mm",
  "product_sku": "WTC-42",
  "note": "Livraison urgente",
  "source_channel": "instagram",
  "ip": "197.230.1.5"
}
```

## Documents

| Fichier | Contenu |
|---|---|
| [`01-audit.md`](./01-audit.md) | État actuel du code (chemins + lignes) — chat_lead, wizard, dispatcher, builders |
| [`02-design.md`](./02-design.md) | Architecture cible, flow par cas, schéma DB additions, format payload enrichi |
| [`03-implementation.md`](./03-implementation.md) | Plan d'action ordonné en milestones (M1 → M6) avec sous-tâches |
| [`04-tests.md`](./04-tests.md) | Batterie de tests à mettre en place (unit, integration, E2E, manuel) |
| [`05-runbook.md`](./05-runbook.md) | Procédure opérationnelle de déploiement + rollback |
| [`06-ui-ux-integration.md`](./06-ui-ux-integration.md) | Wireframes admin, composants, charte graphique, micro-interactions, accessibilité |
| [`07-audit-critique-plan-runbook.md`](./07-audit-critique-plan-runbook.md) | Synthèse vérifiée contre le code, corrections critiques, meilleur plan d'action et runbook d'implémentation |

> Priorité de lecture : commencer par `07-audit-critique-plan-runbook.md`, puis revenir aux fichiers `01` à `06` pour les détails historiques et les wireframes longs.

## TL;DR — Diagnostic & Plan en 30 secondes

**Bonne nouvelle** : 80% du système est déjà en place (CHA-230 wizard, CHA-260 dispatcher unifié, table `chat_lead` polyvalente).

**Les 4 vrais gaps à combler** :

1. **Champ `conversation` absent du payload webhook** — schéma Zod et builder `from-chat-lead.ts` à étendre. Mapping `snapshot_messages` → format `{role, name, text, ts}`.
2. **Cron timeout abandon step 1 → step 2** — nouveau scanner `lead-step1-abandon-scanner.ts` (similaire au `cart-abandon-scanner.ts` existant), durée configurable via `tracking_settings`.
3. **Setting admin pour le timeout** — ligne dans `tracking_settings` (clé `lead.step1_abandon_timeout_minutes`, default 5) + UI dans `/admin/tracking/settings`.
4. **Décision : `chat-lead` webhook doit-il fire immédiat ou attendre step 2 ?** Spec user = immédiat avec transcript. Builder à séparer en 2 events : `chat_lead.created` (immédiat, transcript) vs `lead.step2_completed` (wizard step 2 OK).

**Tout le reste** (idempotency, retry 3×, signature HMAC, normalisation phone E.164→0XX, log `outbound_webhook_log`, anti-doublon `abandon_webhook_at`) est **déjà en place et conforme** au contrat.

## Visualisation & configuration admin (M6)

L'admin doit pouvoir **configurer** (settings timeout, toggles) et **visualiser** (état des leads, complétion par étape, statut webhook par lead, historique de livraisons) sans surcharger l'UI existante. La stratégie retenue :

- **Modifier > créer** : on enrichit `/admin/leads`, `/admin/leads/[id]`, `/admin/tracking/settings` (pages existantes). Le plan vérifié recommande une seule nouvelle route dédiée : `/admin/tracking/webhooks/outbound` (viewer logs outbound, accessible aussi via le drawer).
- **Charte stricte** : palette `stone/emerald/rose/amber` uniquement. Réutilisation des patterns `ConsentBannerSettingsForm`, `StatusBadge` emails, `Kpi` cards, `ConversationQuickView` (drawer).
- **Drawer lazy-load** pour les détails (payload JSON, historique tentatives) → pas de modale lourde, pas de page dédiée par lead.
- **KPI cliquables** : les 4 cartes en haut de `/admin/leads` filtrent la table en un clic.

Détails complets dans [`06-ui-ux-integration.md`](./06-ui-ux-integration.md) — inclut wireframes ASCII pour chaque écran, signatures props des nouveaux composants, séquences data→backend→frontend, calcul du `dataPct` par étape, et 10 critères d'acceptance UI.
