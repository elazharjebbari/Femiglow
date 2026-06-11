# Module 03 — Campagnes (`/admin/emails/campaigns`)

> Périmètre : wizard de création de campagne (6 étapes), finalisation
> (snapshot → push Listmonk → création campagne → démarrage), synchronisation
> des statuts et métriques depuis Listmonk (poll), liste / détail / édition
> de brouillon. Inventaire : **F-030 → F-034**.

---

## 1. Fonctionnement optimal (état cible)

### 1.1 Wizard de création — `CampaignWizard.tsx`

Le wizard est un composant **contrôlé, client-only**, à 6 étapes linéaires :

| # | Étape | Validation de sortie (état cible) |
|---|-------|-----------------------------------|
| 1 | Nom interne | `name.trim().length ≥ 3` et `≤ 120`. Non visible des destinataires. |
| 2 | Audience | **exactement une** source choisie : soit ≥ 1 liste Listmonk (legacy), soit 1 audience FemiGlow (native M5.3). Jamais les deux. La taille estimée est affichée (snapshot dynamique pour audience native via `preview-size`). |
| 3 | Contenu | corps HTML `≥ 10` caractères ; template Listmonk optionnel. |
| 4 | Sujet + preheader | `subject.trim().length ≥ 3` et `≤ 140` ; preheader `≤ 200`. Aperçu boîte de réception. |
| 5 | Planification | `now` **ou** `scheduled` ; si planifié, date obligatoire et **strictement future**. |
| 6 | Vérification | récap complet + aperçu corps (iframe sandboxée) + case d'acquittement obligatoire avant envoi. |

**État cible des transitions** :

- `goNext()` valide l'étape courante **avant** d'avancer ; en cas d'échec, le
  message d'erreur est affiché et l'étape **ne change pas**.
- `goPrev()` revient en arrière **sans revalider** et **sans perdre** les
  données saisies (l'état React est conservé entre les étapes).
- À chaque passage d'étape réussi, `persistDraft()` écrit le brouillon
  (`updateCampaignDraft`) → reprise possible après rechargement.
- Le bouton final est **désactivé** tant que la case d'acquittement (`ack`)
  n'est pas cochée et pendant un envoi en cours (`pending`) → pas de double
  soumission.
- Le bandeau `listmonkError` est affiché si Listmonk est injoignable au chargement.

### 1.2 Finalisation — `wizard-actions.ts :: finalizeCampaign`

Pipeline cible (à rendre **atomique et idempotent**) :

1. **Charger** le brouillon ; refuser si `status !== 'draft'` (garde anti-rejeu)
   ou si `subject` vide.
2. Si **audience native** : `snapshotAudience()` puis `pushSnapshotToListmonk()`.
   Échec si `pushed === 0`. Persister `snapshotId` + `snapshotListmonkListId`.
3. Sinon : utiliser `audienceLinkIds` (listes Listmonk legacy).
4. **Créer** la campagne Listmonk (`listmonk.campaigns.create`).
5. **Démarrer / planifier** : `updateStatus(running)` si `sendNow`,
   `updateStatus(scheduled)` sinon.
6. **Mirror DB** : `listmonkCampaignId`, `status`, `startedAt`.
7. Audit + log + revalidate.

État cible : les étapes 4 → 6 doivent être **atomiques vis-à-vis de la DB**, et
l'opération doit être **réentrante** (un retry après crash ne crée PAS de
seconde campagne Listmonk).

### 1.3 Synchronisation statuts / métriques — `listmonk-status-sync.ts`

Listmonk n'émet pas de webhook `campaign.completed`. Un cron poll donc, pour
chaque campagne ayant un `listmonkCampaignId` et un statut non-terminal :

- Mapping Listmonk → FemiGlow : `running→sending`, `finished→sent` (+`finishedAt`),
  `cancelled→cancelled`, `scheduled→scheduled`.
- Métriques tirées de Listmonk : `sentCount`, `openCount`, `clickCount`,
  `bounceCount` (et, état cible, `deliveredCount`).
- **Machine d'états cible** (transitions LÉGALES uniquement) :

```
draft → scheduled → sending → sent
draft → sending → sent
(draft|scheduled|sending) → cancelled
sent  → (terminal)         cancelled → (terminal)
```

Toute transition régressive (`sent → sending`, `cancelled → sending`,
`sent → scheduled`) doit être **rejetée** (webhook/poll rejoué).

### 1.4 Liste / détail / édition — `campaigns/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`

- Liste : nom, statut (badge), compteurs, planification.
- Détail : métriques (sent/delivered/open/click/bounce), liens snapshot/Listmonk.
- Édition : réservée aux `status='draft'` ; recharge le wizard pré-rempli.

---

## 2. Fichiers sources concernés

| Domaine | Fichier |
|---------|---------|
| Wizard UI | `apps/web/src/components/admin/emails/wizard/CampaignWizard.tsx` |
| Server actions | `apps/web/src/lib/admin/emails/wizard-actions.ts` |
| Queries listes/templates Listmonk | `apps/web/src/lib/admin/emails/campaigns-queries.ts` |
| Sync statuts/métriques | `apps/web/src/lib/mail/campaigns/listmonk-status-sync.ts` |
| Push snapshot → Listmonk | `apps/web/src/lib/mail/campaigns/listmonk-sync.ts` |
| Schéma | `apps/web/src/lib/db/schema-emails.ts` (`emailCampaignLink`, enum `email_campaign_status`) |
| Pages | `apps/web/src/app/admin/emails/campaigns/{page,[id]/page,[id]/edit/page}.tsx` |

---

## 3. Écarts d'audit ciblés par ce module

| Réf | Défaut constaté (audit 2026-06-03) | Test garde-fou |
|-----|-------------------------------------|----------------|
| **A-CMP-1** | `finalizeCampaign` **non transactionnel** : `create Listmonk → updateStatus(running) → UPDATE DB`. Un crash après `create`/`updateStatus` mais avant l'`UPDATE` DB laisse une **campagne fantôme** qui envoie sans `listmonkCampaignId` côté FemiGlow. | `finalize-atomicity.integration.test.ts` — crash injecté entre `updateStatus` et l'`UPDATE`, on vérifie l'état DB résultant et l'absence de double-envoi au retry. |
| **A-CMP-2** | **Double envoi au retry** : le brouillon reste en `draft` → un second clic ré-exécute tout le pipeline ⇒ 2 campagnes Listmonk. | Garde anti-rejeu : `status !== 'draft'` rejette ; test « l'opérateur retente » prouve une seule campagne créée. |
| **A-CMP-3** | Compteurs open/click **gelés à H+24** (fenêtre de poll bornée `finishedAt > now() - 24h`). | Test fenêtre de poll : une campagne `sent` `finishedAt = H-25` n'est PLUS pollée → métriques figées (oracle = comportement documenté, candidat à correction). |
| **A-CMP-4** | `deliveredCount` **jamais alimenté** (colonne morte). | Test métriques : le sync ne touche pas `deliveredCount` (red), puis test de non-régression une fois câblé. |
| **A-CMP-5** | **Transitions non gardées** : un webhook/poll rejoué peut faire `sent → sending`. | Test machine d'états : table-driven des transitions légales/illégales. |

> Convention : les tests d'écart sont nommés `regression: A-CMP-N` et écrits
> **red → green** (cf. 02-architecture-tests §5.4).

---

## 4. Couverture & livrables

- `test-matrix.csv` — ≥ 50 lignes (wizard étape par étape, finalisation,
  sync, métriques, liste/détail/édition).
- `scenarios-metier.md` — 4 scénarios bout-en-bout.
- `test-plan.yaml` — suites machine-lisibles.
- `machine-etats-campagne.puml` — machine d'états.
- `specs/campaign-wizard.msw.test.tsx` — composant + MSW (grille d'échecs).
- `specs/finalize-atomicity.integration.test.ts` — intégration vraie DB.
