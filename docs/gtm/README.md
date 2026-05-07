# Configuration Google Tag Manager — FemiGlow

> *Spécification complète de la configuration GTM web : audit des
> événements existants, architecture des conteneurs, conventions
> de nommage, variables, triggers, tags, gestion du consentement,
> mapping de conversions, automatisation par API.*

---

## Sommaire

| #   | Document                                                               | Contenu                                                                              |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 00  | [Cahier des charges](00-cahier-des-charges.md)                          | Objectifs, périmètre, exigences, KPIs, parties prenantes                              |
| 01  | [Audit de l'existant](01-audit-existant.md)                             | Inventaire des 38 events, structure du dataLayer, mapping providers                  |
| 02  | [Architecture GTM](02-architecture-gtm.md)                              | Conteneurs, workspaces, folders, environnements, naming                              |
| 03  | [Variables](03-variables.md)                                            | Built-in, dataLayer, constantes, lookup tables, JS, RegEx                            |
| 04  | [Triggers](04-triggers.md)                                              | Page View, Custom Event, exception triggers, blocking triggers                      |
| 05  | [Tags](05-tags.md)                                                      | GA4 config, GA4 events, Meta, TikTok, Snap, Pinterest, Google Ads, Custom HTML       |
| 06  | [Consent Mode v2](06-consent-mode.md)                                   | Default consent, granted/denied, Meta LDU, TikTok LDU, Pinterest                     |
| 07  | [Conversions & mapping](07-conversions-mapping.md)                      | Quels events sont des conversions, comment les pousser à chaque ad platform          |
| 08  | [Server-side GTM (sGTM)](08-server-side-gtm.md)                          | Stape / Cloud Run, quand l'utiliser, design hybride GTM web + sGTM                   |
| 09  | [Environnements & versioning](09-environnements-versioning.md)           | dev / preview / prod, versions GTM, change log                                       |
| 10  | [Automatisation](10-automatisation.md)                                  | Generator `container.json`, GTM API v2, CI/CD, workflow recommandé                  |
| 11  | [Tests & debug](11-tests-debug.md)                                      | Tag Assistant, Preview, GA4 DebugView, Meta Test Events, Playwright                  |
| 12  | [Runbook](12-runbook.md)                                                | Ops courantes : ajouter un tag, debug un event manquant, rollback, incident          |
| 13  | [Events chat](13-events-chat.md)                                        | 10 events `fg_chat_*` issus de `docs/chat-assistant/`, attribution, audiences        |
| 14  | [Export depuis l'admin](14-admin-export.md)                              | Page `/admin/tracking/gtm` : preview, télécharger, copier, diff, push (Phase 2)      |

### Annexes

- [`annexes/dataLayer-spec.md`](annexes/dataLayer-spec.md) — schéma exhaustif du dataLayer
- [`annexes/mapping-conversions.csv`](annexes/mapping-conversions.csv) — matrice events × providers × conversion
- [`annexes/container-template.json`](annexes/container-template.json) — squelette `container.json` minimal
- [`scripts/gtm-generate.ts`](scripts/gtm-generate.ts) — générateur de container.json depuis l'event catalog
- [`scripts/gtm-push.ts`](scripts/gtm-push.ts) — pousse le container via GTM API v2

## Conventions transverses

- **Conteneur GTM web** : `GTM-FEMIGLOW` (ID à créer côté
  Google Tag Manager). Un seul conteneur web ; un conteneur sGTM
  séparé en Phase 2.
- **Un seul dataLayer** côté navigateur : `window.dataLayer` est
  la copie miroir de `window.femiglowDataLayer` (cf.
  `apps/web/src/lib/tracking/datalayer.ts`).
- **Source de vérité events** : `apps/web/src/lib/tracking/event-catalog.ts`.
  Toute modification GTM passe d'abord par ce fichier.
- **Préfixe FemiGlow** : `fg_` pour les events custom maison.
  Standard GA4 sinon.
- **Naming GTM** : `Catégorie — Nom — Variant` pour tags et
  triggers (cf. `02-architecture-gtm.md §3`).

## Préfixe de tickets : `GTM-XXX`

Environ **70 tâches** réparties en **5 phases** (cf.
[10-automatisation.md §6](10-automatisation.md)).

## État du document

- Version : 1.0
- Date : 2026-05-06
- Statut : à valider avant création du conteneur GTM en preview
- Dépendances amont : `docs/tracking/` (catalogue events),
  `apps/web/src/lib/tracking/` (code TS)
