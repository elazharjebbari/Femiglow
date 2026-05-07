# 01 — Architecture

> Vue technique globale du système, des conteneurs aux flux d'exécution.
> Ce dossier sert de référence pour toute discussion d'implémentation
> backend ou frontend.

---

## Contenu

| Fichier | Rôle |
|---|---|
| [`architecture-globale.puml`](./architecture-globale.puml) | C4 niveau Container — vue système |
| [`architecture-deploiement.puml`](./architecture-deploiement.puml) | Deploiement physique Vercel + Neon |
| [`flux-authentification.puml`](./flux-authentification.puml) | Sequence — login admin |
| [`flux-creation-lead.puml`](./flux-creation-lead.puml) | Sequence — soumission formulaire public |
| [`flux-webhook-tick.puml`](./flux-webhook-tick.puml) | Sequence — cron tick + livraison |
| [`modele-conteneurs.puml`](./modele-conteneurs.puml) | Composants internes apps/web |
| [`decisions-techniques.md`](./decisions-techniques.md) | Décisions transversales hors ADR |
| [`adr/`](./adr/) | Architecture Decision Records numérotés |

## Comment générer les diagrammes

```bash
# Avec plantuml CLI (Java requis)
brew install plantuml
plantuml -tsvg docs/admin/specifications/01-architecture/*.puml

# Avec extension VS Code "PlantUML" (jebbedu.plantuml)
# → Alt+D pour preview live
```

Les `.puml` sont versionnés en source. Les SVG/PNG générés ne sont
**pas** commités (générables à la demande).

---

## Vue C4 hiérarchique

```
Niveau 1 — Système
  FemiGlow Admin = un système privé permettant à la fondatrice de
  consulter les leads et configurer le webhook.

Niveau 2 — Conteneurs (architecture-globale.puml)
  - Visiteur public           [navigateur]
  - Admin                     [navigateur]
  - apps/web                  [Next.js sur Vercel]
  - Postgres                  [Neon]
  - Vercel Cron               [orchestrateur]
  - Sentry                    [observabilité]
  - Serveur partenaire        [externe, contrôlé par tiers]

Niveau 3 — Composants (modele-conteneurs.puml)
  Détaille apps/web :
  - Pages marketing/commerce
  - Pages admin (Server Components)
  - API publique
  - API admin
  - Middleware
  - Lib auth, lib webhooks, lib db
  - Schémas Zod

Niveau 4 — Code
  Hors périmètre de ce dossier (à découvrir dans le code source).
```

---

## Lecture rapide des flux

| Flux | Diagramme | Acteurs |
|---|---|---|
| Login admin | `flux-authentification.puml` | Admin → Next.js → DB → Cookie |
| Soumission lead | `flux-creation-lead.puml` | Visiteur → API publique → DB |
| Livraison webhook | `flux-webhook-tick.puml` | Cron → API admin → DB → Partenaire |
| Replay manuel | dans `decisions-techniques.md` § 4 | Admin → API admin → DB |
