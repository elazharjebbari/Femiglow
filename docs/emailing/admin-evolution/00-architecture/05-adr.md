# Architecture Decision Records (ADRs)

> Format : un ADR par décision structurante. Statut : `proposed`,
> `accepted`, `superseded by ADR-X`. Une fois `accepted`, ne plus
> éditer le contenu ; créer un nouvel ADR si retournement.

---

## ADR-001 — Audiences natives FemiGlow avec snapshot à l'envoi

**Statut** : accepted (M5.3)
**Date** : 2026-05-13

**Contexte**
Le wizard campagne actuel impose de sélectionner des listes Listmonk
qui n'ont aucun lien avec les comportements clients FemiGlow.

**Décision**
Construire les audiences exclusivement dans FemiGlow (table
`email_audience` + règles JSON). Au moment de l'envoi : snapshot
versionné, push vers Listmonk comme liste éphémère, send, cleanup J+30.

**Alternatives considérées**
- Pousser unidirectionnellement vers des listes Listmonk permanentes
  (rejeté : drift, doublonnement)
- Bypass complet Listmonk (rejeté : perte des stats campagne natives)
- Hybride par taille (rejeté : complexité)

**Conséquences**
- FemiGlow devient source de vérité unique
- Listmonk = moteur de delivery uniquement
- Audit & RGPD propres
- Coût dev : moyen (snapshot machinery + sync éphémère)

---

## ADR-002 — Automation studio V1 = step-list typée, pas canvas

**Statut** : accepted (M5.5)
**Date** : 2026-05-13

**Contexte**
Besoin de UI de création d'automations. Options : step-list verticale
typée (chacun forme), canvas drag-drop n8n-like, DSL YAML.

**Décision**
V1 = step-list typée. Migration possible vers canvas V2 si besoin
validé.

**Alternatives considérées**
- Canvas dès V1 : trop d'effort (~3 sem juste pour l'éditeur)
- YAML : exclut admin non-dev

**Conséquences**
- Itération rapide (1-2 sem par nouveau type de step)
- Step-list lisible pour les flows linéaires + branches simples
- Possible refactor visuel V2 sans migration data (juste un autre
  renderer par-dessus le même JSON)

---

## ADR-003 — Table `user_event` unifiée

**Statut** : accepted (M5.2)
**Date** : 2026-05-13

**Contexte**
Events utilisateur éparpillés sur `email_event`, `lead_events`,
`insights_*` matview, tracking GTM. Audience builder + automations
exigent un seul endroit pour interroger.

**Décision**
Créer `user_event` (id, email, event_name, ts, properties jsonb,
session_id, source) avec bridges depuis toutes les sources existantes.

**Alternatives**
- Garder éparpillé + faire des vues UNION : trop coûteux en jointures
- Refactorer complètement (déprécier email_event) : risque cassé,
  hors scope

**Conséquences**
- 1 table à indexer correctement (email, ts), (event_name, ts)
- Doublonnage temporaire d'events (existe ET dans user_event)
  jusqu'au cleanup éventuel
- Migrations bridges progressives, source par source

---

## ADR-004 — Rules JSON DSL (audiences + branch conditions)

**Statut** : accepted (M5.3, réutilisé M5.5)
**Date** : 2026-05-13

**Contexte**
Comment représenter "user a passé ≥ 3 commandes ET total dépensé ≥
1000 MAD" ? Stockage + sérialisation + UI form-based + compilation
SQL.

**Décision**
JSON discriminé avec types Zod. Compiler `rules → drizzle query`
testable. Réutilisé dans audiences (filter user) ET dans branch
conditions (filter sur user en cours dans un run).

```json
{
  "kind": "all",
  "conditions": [
    {
      "kind": "order_count",
      "operator": "gte",
      "value": 3,
      "since": "2025-01-01"
    },
    {
      "kind": "order_total",
      "operator": "gte",
      "value": 1000000,
      "currency": "MAD"
    }
  ]
}
```

**Alternatives**
- SQL fragments stockés directement : injection, pas vérifiable
- Python/JS expression (eval) : risque sécu
- Visual blockly-like : trop d'effort UI

**Conséquences**
- Schémas évolutifs (ajout de nouveaux `kind`)
- Compiler à tester exhaustivement
- Versionning : ajouter un champ `version` dans le JSON pour migrations
  futures

---

## ADR-005 — Cmd-K palette unifiée (transactional V1, autres V2)

**Statut** : accepted (M5.1)
**Date** : 2026-05-13

**Contexte**
Recherche + actions sur la transactionnelle nécessitent un outil
puissant. Choix d'UX.

**Décision**
Component `CommandPalette` réutilisable, mais déployé d'abord sur la
transactionnelle uniquement (M5.1). Étendu en M5.6 aux audiences et
automations.

**Alternatives**
- Toolbar de filtres dropdown classique
- Bigger search input avec dropdowns

**Conséquences**
- UX cohérent avec produits modernes (Linear, Notion)
- Effort initial moyen (parser de filtres typé)
- Le composant est partagé → V2 déploiement quasi-gratuit

---

## ADR-006 — Snapshot statique par défaut, dynamique en option

**Statut** : accepted (M5.3)
**Date** : 2026-05-13

**Contexte**
Quand on lance une campagne sur une audience, doit-on figer la liste
maintenant ou la re-évaluer au moment de l'envoi ?

**Décision**
Par défaut : audience **dynamique** (re-snapshot au moment de l'envoi).
Option statique disponible (figer maintenant).

**Conséquences**
- Cas usage promo périodique : envoyée à l'audience VIP courante (✓)
- Cas usage A/B : figer pour reproductibilité (✓)
- Audit trail : tous les snapshots préservés

---

## ADR-007 — Listes Listmonk éphémères naming

**Statut** : accepted (M5.3)
**Date** : 2026-05-13

**Contexte**
Comment nommer les listes Listmonk créées pour un envoi ? Risque de
collision, de drift avec FemiGlow.

**Décision**
Convention : `fg-{audience_slug}-{snapshot_id}` (ex
`fg-clientes-vip-snap-abc123`). Marquées via `tags=[ephemeral]`.

**Cleanup**
Cron quotidien : purge les listes Listmonk taggées `ephemeral` dont
le snapshot FemiGlow associé a > 30 jours.

---

## ADR-008 — Cooldown automation au niveau du run, pas au niveau du trigger

**Statut** : accepted (M5.5)
**Date** : 2026-05-13

**Contexte**
Si un user déclenche 10× `cart.abandoned` en 10 minutes, faut-il :
- bloquer 9 triggers (cooldown sur trigger)
- bloquer 9 runs (cooldown sur run)

**Décision**
Cooldown sur **run** : on traque "ce user a-t-il un run actif/récent
de cette automation". Si oui, ignore le nouveau trigger.

**Conséquences**
- Logique côté `triggerAutomation()` : check existant
- Plus simple à raisonner pour l'admin (cooldown = "min temps entre
  deux runs pour le même user")
- Atomicity garantie par contrainte unique (`automation_id`,
  `recipient_email`, `status IN ('pending', 'running')`)

---

_Liste vivante. Tout nouveau choix archi structurant = nouvel ADR._
