# Index global des ADR du plan

> Les ADR sont **rangés par workstream** (`02_workstreams/<ws>/adr/`). Leur numéro local (`adr-00XX`) est **scopé au workstream** — d'où des numéros identiques entre workstreams. Ce tableau attribue un **handle global unique `PLAN-ADR-###`** pour la traçabilité, distinct des ADR de la baseline d'audit (`docs/.../decisions/adr-0001..0007`).

**Total : 16 ADR de plan.**

| Handle global | Workstream | Fichier | Titre | Statut |
|---|---|---|---|---|
| `PLAN-ADR-001` | architecture | `02_workstreams/architecture/adr/adr-0008-facade-invokeengine.md` | ADR-0008 — Façade `invokeEngine` & pont bidirectionnel idempotent | Proposé |
| `PLAN-ADR-002` | architecture | `02_workstreams/architecture/adr/adr-0009-file-jobs-unique.md` | ADR-0009 — File de jobs async unique (worker resumable) | Proposé |
| `PLAN-ADR-003` | architecture | `02_workstreams/architecture/adr/adr-0010-contrat-generationresult-erreurs.md` | ADR-0010 — Contrat `GenerationResult` complet & taxonomie d'erreurs du graphe | Proposé |
| `PLAN-ADR-004` | architecture | `02_workstreams/architecture/adr/adr-0011-bascule-incrementale-flag.md` | ADR-0011 — Stratégie de bascule incrémentale & retrait du chemin B legacy | Proposé |
| `PLAN-ADR-005` | backend | `02_workstreams/backend/adr/adr-0008-gating-honnete-providers-media.md` | ADR-0008 — Gating honnête des providers média & propagation des échecs dans `state.errors` | Proposé |
| `PLAN-ADR-006` | backend | `02_workstreams/backend/adr/adr-0009-idempotence-publication-independante-scheduledat.md` | ADR-0009 — Idempotence de publication indépendante de `scheduledAt` | Proposé |
| `PLAN-ADR-007` | backend | `02_workstreams/backend/adr/adr-0010-media-dir-absolu-isolation-stockage.md` | ADR-0010 — Résolution absolue de `MEDIA_DIR` + isolation du stockage des tests | Proposé |
| `PLAN-ADR-008` | data | `02_workstreams/data/adr/adr-0008-cle-idempotence-stable-index-partiel.md` | ADR-0008 — Clé d'idempotence de publication stable + index unique partiel anti-double-job | Proposé |
| `PLAN-ADR-009` | data | `02_workstreams/data/adr/adr-0009-coherence-etat-content-post-publish-job.md` | ADR-0009 — Invariant de cohérence d'état content_post ↔ social_publish_job (propagation tr | Proposé |
| `PLAN-ADR-010` | data | `02_workstreams/data/adr/adr-0010-verite-schema-test-isolation-stockage.md` | ADR-0010 — Vérité du schéma de test (noms de table dérivés) + isolation du stockage et des | Proposé |
| `PLAN-ADR-011` | data | `02_workstreams/data/adr/adr-0011-registre-modeles-resolution-credentials.md` | ADR-0011 — Registre de modèles routables + résolution de credentials unifiée + traçabilité | Proposé |
| `PLAN-ADR-012` | frontend | `02_workstreams/frontend/adr/adr-0012-contrat-affichage-honnete-mode-provider-erreurs.md` | ADR-0012 — Contrat d'affichage honnête : mode, provenance, état et erreurs (UI create-flow | Proposé |
| `PLAN-ADR-013` | ui-ux | `02_workstreams/ui-ux/adr/adr-0012-picker-honnete-contrat-source-generabilite.md` | ADR-0012 — Picker honnête : le badge « Live » est lié à la générabilité réelle, pas à la d | Proposé |
| `PLAN-ADR-014` | ui-ux | `02_workstreams/ui-ux/adr/adr-0013-mode-mock-live-source-unique.md` | ADR-0013 — Une source de vérité unique pour le mode mock/live (toggle = badge = route = ef | Proposé |
| `PLAN-ADR-015` | design | `02_workstreams/design/adr/adr-0014-contrat-design-verifiable-hooks-wcag.md` | ADR-0014 — Contrat de design vérifiable : hooks de sélection stables + WCAG AA verrouillé  | **proposé** (conception ; aucu |
| `PLAN-ADR-016` | design | `02_workstreams/design/adr/adr-0015-fidelite-apercu-etat-erreur-visuel.md` | ADR-0015 — Contrat de fidélité d'aperçu et d'état d'erreur visuel | **proposé** (conception ; aucu |

## Lien avec les ADR de la baseline d'audit

- `docs/.../decisions/adr-0007` (frontière A/B) → tranché **Option 1 (converger vers A)** ; mis en œuvre par les ADR plan d'architecture (`PLAN-ADR-001..004`).
- `docs/.../decisions/adr-0003` (harnais parité mock/live) et `adr-0004` (résolution clés unifiée) → raffinés par les ADR plan correspondants.

> Recommandation d'exécution : au démarrage de la phase d'implémentation, **renuméroter** ces ADR en une séquence globale unique (`PLAN-ADR-###`) si l'équipe préfère des fichiers à numéro unique ; en l'état figé du plan, le handle global ci-dessus fait foi.
