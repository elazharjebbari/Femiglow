# Décisions architecturales (ADR)

Décisions structurantes prises pour ce sprint, avec contexte et alternatives.

## ADR-001 — Ajout d'une colonne `kind` plutôt que table séparée

**Statut** : ✅ Accepté

**Contexte** : L'audit identifie une table `chat_session` partagée par 2 systèmes (chat IA + wizard checkout) sans discriminateur. Deux options structurelles existent.

**Options évaluées** :

| Option | Pros | Cons |
|---|---|---|
| **A — Colonne `kind` sur `chat_session`** | • Migration légère (ADD COLUMN)<br>• Pas de relink FK chat_lead<br>• Pas de duplication données<br>• Rollback trivial (DROP COLUMN) | • Table reste sémantiquement ambigüe<br>• Toutes les queries chat doivent filtrer `kind='chat'` |
| **B — Table dédiée `wizard_session`** | • Modèle conceptuellement propre<br>• Pas de filtre dans queries chat | • Migration lourde (CREATE + relink FK)<br>• Code touchant chat_lead à modifier<br>• Risque régression |

**Décision** : Option A. Le ratio risque/bénéfice est bien meilleur pour ce sprint. Si à terme le volume `chat_session` > 500k, on pourra évaluer B comme migration majeure (sprint dédié).

**Conséquences** :
- Toutes les queries `adminQueries.*Conversations*` doivent filtrer `kind='chat'` par défaut.
- `wizardSessionRepo.ensureForWizard()` doit insérer `kind='wizard_pivot'`.
- `sessionRepo.create()` (chat natif) doit insérer `kind='chat'` (default DB de toute façon).
- Tests vitest pour vérifier les défauts d'insertion.

---

## ADR-002 — Feature flag obligatoire pour le rollout

**Statut** : ✅ Accepté

**Contexte** : Le sprint touche aux pages admin critiques (`/admin/chat/conversations`, `/admin/chat/leads`). Un bug filtre = visibilité ZERO sur les vraies conversations → blocage Care.

**Décision** : Toutes les nouvelles queries filtrées passent derrière un feature flag `CHAT_ADMIN_FILTERS_V2` (env var). Par défaut `false`, on active progressivement en staging puis prod.

**Implémentation** :

```ts
// src/lib/chat/feature-flag.ts (déjà existe — ajouter)
export function isChatAdminFiltersV2Enabled(): boolean {
  return process.env.CHAT_ADMIN_FILTERS_V2 === 'true';
}
```

**Usage dans queries** :

```ts
async listChatLeads(opts) {
  // ...
  if (isChatAdminFiltersV2Enabled()) {
    conds.push(inArray(chatLead.source, opts.sources ?? ['chat_widget', 'inline']));
  }
  // ...
}
```

**Rollback** : `CHAT_ADMIN_FILTERS_V2=false` puis redéploiement → comportement legacy restauré sans toucher au code.

---

## ADR-003 — Lazy session creation : reporté à un sprint ultérieur

**Statut** : ⏸️ Reporté (post-fix C1/C2/C3)

**Contexte** : C4 (bootstrap chat prématuré) crée des `cs_xxx` vides avec `page=NULL`. La solution propre serait de différer la création de `chat_session` jusqu'au premier message envoyé.

**Pourquoi reporter** :
- C4 produit ~5-10 rows par session traffic (pas catastrophique vs ghosts wizard).
- Le fix C3 (`withMessagesOnly`) résout déjà l'affichage : les sessions sans message ne sont plus listées.
- Lazy creation impacte le widget (re-design de l'init flow, risque UX).

**Décision** : laisser C4 ouvert. Documenter qu'il reste un résidu sur la table mais invisible côté admin grâce à C3. À traiter en sprint séparé si le volume devient problématique.

---

## ADR-004 — Pas de DELETE sur l'historique

**Statut** : ✅ Accepté

**Contexte** : On a 100 conversations en preview dont une majorité ghost. Tentation : `DELETE FROM chat_session WHERE kind = 'wizard_pivot' AND ...`.

**Pourquoi NE PAS supprimer** :
1. **FK cascade** : `chat_lead.session_id` référence ghosts. DELETE casserait des leads valides.
2. **RGPD** : le DELETE court-circuite le flow `forget()` qui anonymise plutôt que supprimer (traçabilité audit).
3. **Backfill réversible** : un UPDATE `status='archived'` permet un retour en arrière, un DELETE non.

**Décision** : on ARCHIVE (`status='archived'`, `archived_at=NOW()`) les ghosts orphelins (sans lead) > 30j. On laisse intacts les ghosts ayant un lead lié (utile pour traçabilité).

---

## ADR-005 — Badge "via wizard" sur les leads (UI)

**Statut** : ✅ Accepté

**Contexte** : Même avec le filtre source, certains leads `source='inline'` peuvent venir d'un contexte hybride (chat affichant un form embed). Pour l'opérateur Care, savoir d'où vient un lead est crucial.

**Décision** : afficher un badge couleur dans `/admin/chat/leads` et `/admin/leads` :
- 🟢 Badge `chat_widget` (par défaut, vert discret)
- 🟡 Badge `wizard_*` (ambre si visible dans une vue chat — signal pollution)
- 🔵 Badge `inline` (bleu — capture inline dans chat)
- ⚪ Badge `admin` (gris — capture manuelle)

Cf. [`03-frontend-ui-ux/design-tokens.md`](../03-frontend-ui-ux/design-tokens.md).

---

## ADR-006 — Pas de migration destructive sur les tests existants

**Statut** : ✅ Accepté

**Contexte** : 7159 tests vitest passent actuellement. La modification de `chatLead` / `chatSession` schéma peut casser des fixtures.

**Décision** :
- La colonne `kind` a un default `'chat'` en DB → toute fixture existante sans `kind` reçoit `'chat'` automatiquement.
- Les tests existants ne nécessitent AUCUNE modification.
- Les nouveaux tests vérifient les paths spécifiques (wizard insert avec `kind='wizard_pivot'`, filter par défaut, etc.).

**Vérification** : avant chaque merge, `pnpm vitest run` doit afficher autant ou plus de tests verts qu'avant.

---

## ADR-007 — Endpoint cleanup admin-only, non automatique

**Statut** : ✅ Accepté

**Contexte** : Pour archiver les ghosts orphelins, on a 2 options : (a) endpoint manuel admin déclenche, (b) cron quotidien.

**Décision** : Option (a). Raisons :
- Volume bas (~50 ghosts/mois estimés) → pas besoin d'automatisation.
- Cron silencieux = risque d'archivage involontaire si bug logique.
- Endpoint manuel permet à l'admin de voir un preview avant d'agir.

**Évolution future** : ajouter une cron weekly une fois le sprint validé en prod 30+ jours.

---

## Conventions transverses

- **Naming** : `chat_session.kind` (snake_case en DB, camelCase `kind` en code).
- **Default values** : toujours côté DB (CHECK constraint + DEFAULT) ET côté ORM (Drizzle).
- **Tests d'invariants** : pour chaque nouvelle colonne, un test vérifie qu'aucun insert ne peut avoir une valeur invalide.
- **Logging** : utilise `logger.info('chat.session.create', { sessionId, kind })` pour traçabilité.
