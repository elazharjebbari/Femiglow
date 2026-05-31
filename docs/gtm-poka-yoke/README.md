# GTM Poka-Yoke — Dossier technique complet

> Système anti-erreur (Poka-Yoke) pour garantir la cohérence permanente entre le Mapping vendors FemiGlow et le Container GTM en production. Détection multi-couches (pré-import + runtime + observabilité continue) avec alertes explicites et actionnables.

## Carte du dossier

| Section | Contenu | Audience |
|---|---|---|
| [00-overview](./00-overview/) | Vision, problème, valeur métier, glossaire | Tous |
| [10-architecture](./10-architecture/) | Architecture 3 couches (A, B, C), ADRs, diagrammes | Tech leads, archi |
| [20-data](./20-data/) | Modèle de données, migration, schémas Zod | Backend, DBA |
| [30-backend](./30-backend/) | API spec, contrats, sécurité, perf | Backend |
| [40-frontend](./40-frontend/) | Pages, composants, état, routing | Frontend |
| [50-ui-ux-design](./50-ui-ux-design/) | Design system, wireframes wizards, micro-copy | Design, UX, Product |
| [60-analytics](./60-analytics/) | Métriques observabilité, KPIs Poka-Yoke | Data, Product |
| [70-tests](./70-tests/) | Stratégie tests + matrice + plans Vitest/MSW/Playwright | QA, devs |
| [80-runbook](./80-runbook/) | Exécution opérationnelle (déploiement, incidents, rollback) | Ops, devs |
| [90-plan](./90-plan/) | Plan d'action séquencé par phases | PM, tech leads |

## TL;DR — La solution en 30 secondes

**Problème** : Importer dans GTM les 2 fichiers (Config + Mapping) dans le mauvais ordre, oublier d'en publier un, ou désynchroniser les versions silencieusement = events trackés faux ou perdus.

**Solution** : 3 couches de défense en profondeur, chacune captant un angle mort des autres.

```
┌──────────────────────────────────────────────────────────────┐
│  COUCHE A — PRÉVENTION (avant import)                        │
│  Page admin /admin/tracking/gtm/validate-pair                │
│  → Drop des 2 JSON, diff statique, ✅/❌                     │
├──────────────────────────────────────────────────────────────┤
│  COUCHE B — DÉTECTION RUNTIME (premier pageview après import) │
│  Sentinel ping POST /api/track/sentinel                       │
│  → Compare versions actives admin vs déclarées par GTM        │
├──────────────────────────────────────────────────────────────┤
│  COUCHE C — FILET DE SÉCURITÉ (gratuit, runtime)             │
│  bundleId hash partagé injecté dans les 2 exports             │
│  → Si un seul est importé, ping arrive avec bundleId mismatch │
└──────────────────────────────────────────────────────────────┘
                              ↓
          Page /admin/tracking/gtm/sync-status
          + Banner global admin si drift critique
          + Email aux admins si silence > 24h
```

## Principes directeurs

1. **Détection > culpabilisation** : l'erreur est inévitable, l'invisibilité est le vrai bug.
2. **Alertes actionnables** : chaque alerte doit dire **quoi corriger** et **comment**, pas juste « ça ne va pas ».
3. **Coût d'opération zéro** : Poka-Yoke = invisible quand tout va bien.
4. **Source unique de vérité** : la page sync-status est canonique. Le reste n'est que push.
5. **Défense en profondeur** : 3 couches indépendantes. Un import incorrect doit franchir 3 barrières pour échouer en silence.

## Démarrage rapide

- **Tu veux comprendre la valeur** → [00-overview/01-vision.md](./00-overview/01-vision.md)
- **Tu vas implémenter** → [90-plan/01-plan-action.md](./90-plan/01-plan-action.md)
- **Tu déploies** → [80-runbook/01-deploy.md](./80-runbook/01-deploy.md)
- **Tu maintiens** → [80-runbook/03-incidents.md](./80-runbook/03-incidents.md)

## Décisions structurantes (ADR)

- **ADR-001** : 3 couches plutôt qu'une seule — [10-architecture/adr/001-three-layers.md](./10-architecture/adr/001-three-layers.md)
- **ADR-002** : Sentinel push (GTM → backend) plutôt que pull (backend → GTM API) — [10-architecture/adr/002-push-vs-pull.md](./10-architecture/adr/002-push-vs-pull.md)
- **ADR-003** : `bundleId` = SHA-256(events × mapping version × config version) — [10-architecture/adr/003-bundle-id-hashing.md](./10-architecture/adr/003-bundle-id-hashing.md)
- **ADR-004** : Stockage 90 jours des pings + agrégation par jour pour rétention longue — [10-architecture/adr/004-retention.md](./10-architecture/adr/004-retention.md)

## Statut

| Version | Date | Statut | Responsable |
|---|---|---|---|
| 1.0 | 2026-05-13 | Conçu, prêt à implémenter | Tracking team |
