# 12 — Runbook GTM

> *Opérations courantes : ajouter un tag, debug un event manquant, rollback, incident*

---

## 1. Pré-requis

### Pour les opérations CLI (devs)

- Accès `Container Admin` sur GTM-FEMIGLOW
- Service Account configuré (cf. doc 10)
- Repo cloné en local
- `pnpm install` à jour
- Variables d'env : `GTM_ACCOUNT_ID`, `GTM_CONTAINER_ID`, `GTM_SERVICE_ACCOUNT_KEY`

### Pour les opérations UI (non-devs)

- Compte admin avec rôle `tracking-admin`
- Page `/admin/tracking/gtm` (cf. doc 14)
- Pas de CLI requis pour visualiser, télécharger, copier, comparer

## 2. Ajouter un nouvel événement

Cible : **15 minutes**.

> **Voie UI** : après les étapes 1-4 (édition + seed), un admin
> peut télécharger le nouveau `container.json` depuis
> `/admin/tracking/gtm` et l'importer manuellement dans GTM Admin
> (Import Container → Merge), sans utiliser les commandes CLI
> ci-dessous.

1. Éditer `apps/web/src/lib/tracking/event-catalog.ts` :

   ```ts
   {
     name: 'fg_my_new_event',
     category: 'custom',
     scope: 'web',
     description: 'Description claire',
     isConversion: false,
     applicableCategories: ['section_content'],
     defaultProviders: ['google_ga4'],
     paramsSchema: { type: 'object', properties: { foo: { type: 'string' } } },
   },
   ```

2. Ajouter le mapping providers si nécessaire dans
   `apps/web/src/lib/tracking/providers/event-mapping.ts`.

3. Ajouter le schéma Zod dans
   `apps/web/src/lib/tracking/schemas.ts`.

4. Lancer le seed :
   ```sh
   pnpm tsx apps/web/scripts/seed-tracking.ts
   ```

5. Regénérer le container :
   ```sh
   pnpm tsx docs/gtm/scripts/gtm-generate.ts \
     --spec docs/gtm/annexes/gtm-spec.yaml \
     --out  infra/gtm/container.production.json
   ```

6. Diff visuel :
   ```sh
   pnpm tsx docs/gtm/scripts/gtm-push.ts \
     --container infra/gtm/container.production.json \
     --workspace feature/add-fg_my_new_event \
     --dry-run
   ```

7. Pousser :
   ```sh
   pnpm tsx docs/gtm/scripts/gtm-push.ts \
     --container infra/gtm/container.production.json \
     --workspace feature/add-fg_my_new_event \
     --env preview
   ```

8. Tester en preview (Tag Assistant + GA4 DebugView).
9. Promouvoir en stage puis live (UI GTM ou re-push avec `--env=stage` puis `--env=production`).
10. Mettre à jour `docs/gtm/CHANGELOG.md`.

## 3. Ajouter un nouveau provider (ex : LinkedIn Insight)

Cible : **1 jour**.

1. Étendre l'enum `TrackingProviderKind` (Drizzle migration).
2. Ajouter l'adapter `apps/web/src/lib/tracking/providers/linkedin.ts`.
3. Ajouter au `event-mapping.ts` les events à mapper.
4. Étendre `gtm-generate.ts` :
   ```ts
   for (const ev of EVENT_CATALOG) {
     const linkedinTag = buildLinkedInEventTag(ev, triggers);
     if (linkedinTag) tags.push(linkedinTag);
   }
   ```
5. Ajouter le `LUT - LinkedIn Insight ID by Env` dans le générateur.
6. Ajouter `LINKEDIN_INSIGHT_ID_PROD` dans `gtm-spec.yaml`.
7. Regénérer + pousser en preview.
8. Tester et activer en prod.
9. Mettre à jour CHANGELOG.

## 4. Debug — un event n'arrive pas dans GA4

Cible : **30 minutes**.

```
┌────────────────────────────────────────────┐
│ 1. Tester en local                          │
│    - ouvrir DevTools → Network → DataLayer │
│    - vérifier que window.dataLayer.push()  │
│      contient l'event                      │
└──────────────┬─────────────────────────────┘
               │
               ▼ event présent dans DLV ?
   ┌───────────┴────────────┐
   │ NON                     │ OUI
   ▼                         ▼
[bug code]               [bug GTM]
- vérifier que           - Tag Assistant Preview
  trackEmit() est          → tag GA4 fire ?
  appelé                   - si NON : trigger absent ?
- vérifier le             - si OUI mais pas dans GA4 :
  schéma Zod                consent denied ?
                             - audit firewall / adblocker ?
                             - GA4 DebugView : event reçu ?
```

### 4.1 Checklist debug

| Étape                                              | Outil                                  |
| -------------------------------------------------- | -------------------------------------- |
| Event poussé dans DLV ?                            | `console.log(window.dataLayer)`        |
| Trigger Custom Event existe ?                      | GTM Workspace → Triggers               |
| Tag GA4 référence le bon trigger ?                 | GTM Workspace → Tag → Firing Triggers  |
| Tag fire dans Tag Assistant ?                      | Tag Assistant Preview                  |
| Event arrive dans GA4 DebugView ?                  | GA4 → Admin → DebugView                 |
| Consent OK ?                                        | DLV → consent.analytics_storage         |
| Pas d'adblock côté navigateur ?                    | tester en navigation privée            |
| GA4 Measurement ID correct par env ?                | Variable LUT - GA4 Measurement ID by Env |

## 5. Debug — match quality Meta dégradé

Cible : **1 heure**.

1. Meta Events Manager → Pixel → Diagnostics.
2. Lire le score `Event Match Quality`.
3. Si < 7, vérifier dans le tag Meta de chaque event :
   - `eventID` envoyé ? (`{{DLV - event_id}}`)
   - `em` (email_sha256) présent ?
   - `ph` (phone_sha256) présent ?
   - `external_id` présent ?
   - `fbp` cookie lu ?
   - `client_ip_address`, `client_user_agent` envoyés en CAPI ?
4. Si manque CAPI : vérifier `tracking/server/server-emit.ts`.
5. Activer Meta Test Events Code temporairement pour diagnostic.

## 6. Debug — tag Custom HTML jette une erreur

```
Tag Assistant : ⚠ "Tag fired with errors"
```

1. Ouvrir le tag → onglet "Errors".
2. Lire le message JS.
3. Causes fréquentes :
   - Variable DLV undefined (ex. `{{DLV - ecommerce.value}}` vide
     car event sans ecommerce)
   - Pixel JS pas encore chargé (vérifier `setupTag`)
   - CSP bloque le script (vérifier headers)
4. Corriger dans le générateur (`buildMetaEventTag` etc.) puis
   regénérer + pousser.

## 7. Rollback

### 7.1 Rollback rapide (UI)

```
GTM → Versions → sélectionner v(N-1) → Publish
```

Restaure en moins de 30 secondes.

### 7.2 Rollback Git

```sh
git revert <commit-buggy>
pnpm tsx docs/gtm/scripts/gtm-generate.ts ...
pnpm tsx docs/gtm/scripts/gtm-push.ts --env=production --notes "rollback to v(N-1)"
```

## 8. Incident — événements en double dans GA4

1. Vérifier que `gtm.js` n'est pas chargé deux fois (script
   dupliqué dans le HTML).
2. Vérifier que le tag `GA4 Evt — page_view` n'est pas câblé sur
   `PV — All Pages` ET sur `CE — page_view`.
3. Vérifier que `send_page_view: false` dans `GA4 Cfg`.
4. Solution : retirer le déclencheur en double, repousser.

## 9. Incident — purchase compté deux fois en Meta

Causes possibles :

- `event_id` non envoyé dans le tag Pixel client → la dédup
  CAPI n'opère pas.
- `event_id` différent entre client et server.

Vérifier :

```ts
// côté client (GTM Custom HTML)
fbq('track', 'Purchase', payload, { eventID: {{DLV - event_id}} });

// côté server (server-emit.ts)
event_id: opts.event_id          // doit être le même UUID
```

## 10. Incident — pixel charge sans consent

1. Tester en navigation privée + refus du consent.
2. Vérifier dans Network panel : aucune requête vers
   `connect.facebook.net`, `analytics.tiktok.com`, etc.
3. Si requête détectée : tag `Meta Init` n'a pas l'exception
   `EX — Consent Denied (Ad)` correctement appliquée.
4. Corriger dans `gtm-generate.ts` puis repush.

## 11. Audit mensuel

Script `pnpm tsx apps/web/scripts/tracking-audit.ts --month=2026-05` :

- Compte commandes interne vs purchases GA4 vs purchases Meta
- Match Quality Meta / TikTok / Pinterest
- Taux de validité Zod
- Couverture (events spécifiés / events réels)

Rapport en CSV + Slack.

## 12. Procédure d'astreinte

| Symptôme                                            | Sévérité | Action immédiate                          |
| --------------------------------------------------- | -------- | ----------------------------------------- |
| Tracking complètement KO en prod                    | P0       | Rollback à v(N-1) en UI GTM (30 secondes) |
| Pixel Meta down (Match Quality 0)                   | P1       | Activer mode CAPI-only (désactiver Pixel client) |
| GA4 reçoit `consent_state = unknown`                | P2       | Vérifier pré-snippet `gtag('consent', 'default')` |
| Tag JS jette une erreur sur 1 event                 | P3       | Issue Github, fix dans la sprint           |

## 13. Liste des accès / contacts

| Personne               | Accès                                    | Contact            |
| ---------------------- | ---------------------------------------- | ------------------ |
| Tech Lead              | GTM Admin, GA4 Owner, Meta Pixel Admin    | (interne)          |
| Acquisition             | GTM Edit, GA4 Editor, Meta Pixel Operator | (interne)          |
| Service Account CI      | GTM Edit + Publish via API               | clé SA dans Vault   |

## 14. Lecture suivante

- [09 — Environnements & versioning](09-environnements-versioning.md)
- [10 — Automatisation](10-automatisation.md)
- [11 — Tests & debug](11-tests-debug.md)
