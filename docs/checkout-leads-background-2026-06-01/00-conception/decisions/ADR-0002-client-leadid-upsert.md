# ADR-0002 — `leadId` généré client + endpoints en upsert-by-leadId

- **Statut :** Accepté
- **Date :** 2026-06-01
- **Réf exigences :** FR-01, FR-04, FR-07

## Contexte

Aujourd'hui le `leadId` est généré **serveur** (`lead-repo.ts:76`, `createId('cl')`).
Les étapes 2/3 (`address`, `payment`) ont besoin de ce `leadId` retourné par la
création → elles **dépendent d'attendre** le round-trip de l'étape 1. C'est
incompatible avec un envoi de fond non-ordonné/non-awaité.

## Décision

1. Générer le `leadId` **côté client** (`createId('cl')` via `client/lead-id.ts`,
   même alphabet/préfixe que `@/lib/ids`).
2. Transmettre ce `leadId` dans **chaque** envelope (y compris `lead_create`).
3. Côté serveur, faire de chaque endpoint un **upsert-by-leadId** :
   - `lead_create` → `INSERT … ON CONFLICT(id) DO UPDATE` (création ou complétion).
   - `address_update` / `payment_select` → upsert qui **crée la row si absente**
     (cas d'arrivée désordonnée) puis applique le sous-ensemble de champs.
4. Conserver l'**`Idempotency-Key`** existante `(scope, leadId)` pour le replay.

Ordre & cohérence : la `lead-sync-queue` envoie en **FIFO par leadId** (ADR-0003),
donc en pratique `create` part en premier ; l'upsert serveur est le **filet de
sécurité** si l'ordre n'est pas respecté (retry, beacon batch).

Conversion : `order_create` **embarque le snapshot complet** (téléphone, nom,
adresse, paiement, panier) → la commande est créée même si une écriture de fond
n'a pas encore atterri (FR-07). La row `chat_lead` est réconciliée par upsert.

## Conséquences

- **+** Les étapes deviennent indépendantes → envoi de fond possible (ADR-0001/0003).
- **+** Robustesse au désordre/rejeu (idempotent par construction).
- **−** Le serveur doit accepter un id fourni → valider le **format strict** (`^cl_[0-9a-z]{20,}$`) pour éviter l'injection d'ids arbitraires ; refuser les collisions inter-visiteurs (vérifier `visitorId` cohérent sur upsert).
- **−** Léger refactor des repos (`create` → `upsert`) + schémas (leadId requis en entrée de `lead_create`).

## Alternatives rejetées

- **Garder l'id serveur + attendre l'étape 1** : impose au moins 1 await bloquant → contredit G1.
- **Id serveur + corrélation par `sessionId`** : ambigu si plusieurs leads par session ; fragile.
