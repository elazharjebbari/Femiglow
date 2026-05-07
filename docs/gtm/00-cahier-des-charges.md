# 00 — Cahier des charges

> *Objectifs, périmètre, exigences, KPIs, parties prenantes*

---

## 1. Objectif

Configurer **Google Tag Manager** comme couche unique de
distribution des événements émis par le site FemiGlow, avec
trois finalités :

1. **Mesurer** finement le comportement (GA4 + datalayer interne).
2. **Convertir** les événements clés en conversions chez les
   plateformes publicitaires (Meta, TikTok, Snap, Pinterest,
   Google Ads).
3. **Préserver** la voix maison : aucun script tiers chargé sans
   consentement, latence neutre, charte technique respectée.

Le **dataLayer existe déjà** (cf. `apps/web/src/lib/tracking/datalayer.ts`)
et **38 événements sont catalogués** avec schémas Zod (cf.
`apps/web/src/lib/tracking/event-catalog.ts`). GTM n'est **pas**
la source de vérité ; c'est un **distributeur configurable**.

## 2. Périmètre

### Dans le scope V1

- Conteneur web GTM (un seul, `GTM-FEMIGLOW`).
- Tags GA4 (Configuration + Events).
- Tags Meta Pixel (côté navigateur, V1) + préparation CAPI server.
- Tags TikTok Pixel (côté navigateur).
- Tags Snap Pixel.
- Tags Pinterest Tag.
- Tags Google Ads (Conversion + Remarketing).
- Consent Mode v2 (Google) avec `default denied` + update via
  bandeau consent existant.
- Limited Data Use (Meta LDU) en cas de consentement refusé.
- 4 environnements (dev, preview, prod, stage).
- Workflow `container.json` versionné dans le repo.
- Script de génération automatique depuis `event-catalog.ts`.
- Tests Playwright vérifiant la collecte sur 10 parcours clés.

### Hors scope V1

- sGTM (server-side GTM) — préparé en doc, déployé Phase 2.
- Tags X (Twitter), LinkedIn, Reddit, Quora.
- Tag Heap / Hotjar / Mixpanel — V2 si besoin.
- Templates customs Tag Manager Community Gallery.

## 3. Exigences fonctionnelles

| ID    | Exigence                                                                                                               | Priorité |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| F-01  | Tout event poussé dans `window.dataLayer` doit être routé selon `event-mapping.ts` vers les providers actifs           | P0       |
| F-02  | Aucun pixel tiers ne doit charger ni envoyer si `consent.analytics_storage = denied` (sauf Consent Mode v2 pings)       | P0       |
| F-03  | Aucun pixel tiers ne doit envoyer de PII en clair (email, téléphone). Hashage SHA-256 obligatoire en amont (déjà fait) | P0       |
| F-04  | Le dataLayer doit être inspectable en local (mode debug GTM) avec une vue `event_id`, `params`, `consent`, `user`     | P0       |
| F-05  | Les events de conversion doivent porter `event_id` (deduplication Meta CAPI)                                            | P0       |
| F-06  | Toutes les modifications GTM doivent être versionnées via `container.json` Git                                         | P0       |
| F-07  | Le générateur doit produire un `container.json` complet à partir d'`event-catalog.ts`                                   | P0       |
| F-08  | La CI doit valider que le `container.json` n'a pas de drift par rapport au catalog                                     | P1       |
| F-09  | Un admin doit pouvoir activer/désactiver un provider sans déployer (depuis `/admin/tracking`, déjà présent)            | P0       |
| F-10  | Chaque tag doit être nommé selon la convention `Catégorie — Nom — Variant`                                              | P0       |
| F-11  | Un mode `dry-run` doit permettre de tester un event sans qu'il parte aux providers                                     | P1       |
| F-12  | Les events `purchase` et `generate_lead` doivent être dédupliqués serveur (Meta CAPI) + client                          | P0       |
| F-13  | Les conversions Google Ads doivent être paramétrables par `conversion_id` + `conversion_label`                          | P0       |
| F-14  | Possibilité d'ajouter / changer un provider en moins de 1 jour (UI GTM ou regénération)                                 | P1       |
| F-15  | UI admin (`/admin/tracking/gtm`) : prévisualiser, télécharger, copier le `container.json` par environnement              | P0       |
| F-16  | UI admin : preview pretty-printed avec line numbers, collapse/expand, plein écran, sha256 du contenu                     | P1       |
| F-17  | UI admin : voir le diff vs container distant (snapshot via GTM API) sans toucher au CLI                                  | P1       |
| F-18  | UI admin : Phase 2 — bouton « pousser via API » avec stream SSE de progression                                            | P2       |

## 4. Exigences non fonctionnelles

| Exigence                          | Cible                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Latence ajoutée par GTM           | < 80 ms p95 sur First Input Delay (mesuré via Web Vitals + Lighthouse)                       |
| Bundle ajouté par GTM             | < 60 kB gzip pour le snippet + ses tags actifs (Meta + GA4 + TikTok + Snap + Pinterest)       |
| Latence Tag Assistant Preview      | Aucun blocage de la page (Preview iframe seulement)                                          |
| Disponibilité                     | 99.9 % (dépend de Google Tag Manager + Vercel)                                               |
| Sécurité                          | CSP nonce respecté ; aucun `unsafe-inline` dans les Custom HTML tags                          |
| RGPD / Consentement               | Consent Mode v2 implémenté ; tags secondaires bloqués tant que pas de `granted`              |
| Maintenabilité                    | Convention de nommage stricte ; aucun tag sans propriétaire ; folders par catégorie           |
| Évolutivité                       | Ajouter un event = 1 entrée dans `event-catalog.ts` + regénération container                  |
| Auditabilité                      | Chaque change GTM = 1 PR + 1 entrée changelog                                                 |

## 5. Parties prenantes

| Rôle                | Responsable                              | Activité                                                                                                |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tech Lead           | Elazhar                                  | Génération du container, GTM API, owner du dépôt                                                        |
| Acquisition         | (à désigner)                             | Pixels Meta / TikTok / Snap / Pinterest / Ads, suivi conversions, A/B                                   |
| Data / Analytics    | (à désigner)                             | GA4 properties, custom dimensions, audiences, BigQuery export                                            |
| Édito / Marque      | Elazhar                                  | Validation que les events ne trahissent pas la voix (pas d'event « urgence », « vite »)                  |
| DPO / Légal         | (à désigner)                             | Validation Consent Mode, durées de conservation, transferts hors UE                                      |

## 6. Comptes & accès requis

| Service                  | Compte / ID                                   | Niveau d'accès             |
| ------------------------ | --------------------------------------------- | -------------------------- |
| Google Tag Manager       | `tagmanager.google.com/#/admin/account/...`   | `Admin` sur le conteneur   |
| Google Analytics 4       | property ID + measurement ID `G-XXXXXXX`      | `Editor` minimum            |
| Google Ads               | `customer_id`                                  | `Standard` minimum          |
| Meta Business Manager    | `pixel_id` + `dataset_id` (CAPI)              | `Pixel admin`               |
| TikTok Business          | `pixel_code`                                  | `Operator`                   |
| Snap Business            | `pixel_id`                                    | `Member`                     |
| Pinterest Business       | `tag_id`                                      | `Admin`                      |
| Vercel                   | Project Env vars                              | `Developer`                  |
| Service Account GCP      | pour GTM API v2                                | rôle `Editor` sur le conteneur |

## 7. KPIs de réussite (mesurables après lancement)

| KPI                                                            | Cible       | Mesure                                              |
| -------------------------------------------------------------- | ----------- | --------------------------------------------------- |
| Taux de couverture (events spécifiés / events réellement émis) | ≥ 98 %       | Diff `event-catalog` ↔ logs `tracking_events`       |
| Taux de validité Zod (events sans erreur de schéma)            | ≥ 99.5 %     | Logs serveur                                        |
| Taux de matching Event Match Quality (Meta)                    | ≥ 7.0 / 10   | Meta Events Manager                                  |
| Latence p95 ajoutée par GTM sur INP                            | < 50 ms      | Web Vitals RUM                                       |
| Conversions remontées (purchase) Meta vs Shopify               | écart < 3 %  | Meta Events Manager + base interne                   |
| Score Lighthouse `performance` (page `/kit`)                    | ≥ 90         | Lighthouse CI                                        |
| Tag Assistant : 0 erreur, 0 warning                            | systématique | Tag Assistant manuel + scripté Playwright            |

## 8. Risques majeurs

| Risque                                                            | Sévérité | Mitigation                                                                              |
| ----------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| Drift entre `event-catalog.ts` et configuration GTM               | Moyenne  | Generator + CI diff (cf. `10-automatisation.md`)                                        |
| Bug provider qui casse une page (script tiers cassé)              | Moyenne  | Tags chargés en async, `try/catch`, CSP strict                                           |
| Doubles conversions (client + serveur sans dédup)                 | Élevée   | `event_id` partagé entre dataLayer et CAPI server (déjà implémenté côté `tracking/server`) |
| Fuite de PII non hashée                                           | Élevée   | Validation amont obligatoire ; tests `hashing.test.ts` déjà présents                     |
| CSP cassée par tag tiers                                          | Moyenne  | Liste des hosts requis dans `csp-hosts.ts`, CSP testée par environnement                 |
| Coût GA4 ou conséquence quota                                     | Faible   | GA4 a un seuil de 10 M events/mois en standard ; à surveiller post-lancement             |
| Surcharge Meta CAPI quota                                         | Faible   | Batch + rate-limit déjà présents dans `dispatcher.ts`                                    |
| Verrouillage UI GTM (un dev modifie en direct sans PR)            | Moyenne  | Procédure obligatoire : modifier `event-catalog.ts` → regénérer → import → revue PR     |

## 9. Critères d'acceptation V1

1. Container `GTM-FEMIGLOW` créé avec environnements (dev, preview, prod, stage).
2. 38 events catalogués → 38 triggers actifs côté GTM (1 trigger
   par event, ou triggers de groupes).
3. 6 providers configurés (GA4, Meta, TikTok, Snap, Pinterest, Google Ads).
4. Consent Mode v2 actif avec defaults denied et update sur
   bandeau.
5. Generator `pnpm tsx scripts/gtm-generate.ts` produit un
   `container.json` valide (passe l'import GTM).
6. Importeur `pnpm tsx scripts/gtm-push.ts` pousse le container via API.
7. Tests Playwright `e2e/tracking-gtm.spec.ts` valides sur 10 parcours.
8. Lighthouse `/kit` ≥ 90.
9. Aucun event PII non-hashé en logs serveur (audit RGPD signé).
10. Runbook (`12-runbook.md`) testé par un membre nouveau de
    l'équipe en moins de 30 min.

## 10. Lecture suivante

- [01 — Audit de l'existant](01-audit-existant.md) pour la
  cartographie des events actuels.
- [02 — Architecture GTM](02-architecture-gtm.md) pour la
  structure de référence.
- [10 — Automatisation](10-automatisation.md) pour la réponse à
  ta question : *« peut-on automatiser ? »*.
