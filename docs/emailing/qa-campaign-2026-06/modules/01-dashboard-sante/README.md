# Module 01 — Dashboard santé emailing (`/admin/emails`)

> Périmètre : page d'atterrissage de la section emails. C'est le premier écran
> qu'un opérateur consulte le matin. Il doit donner en **un coup d'œil** un
> verdict honnête sur l'état du système (badge santé) et les volumes 7 jours
> (KPI cards), puis router vers les sous-sections.
>
> Couvre l'inventaire **F-001 → F-004** (cf. `../../01-inventaire-fonctionnalites.csv`).

## 1. Fichiers sources concernés

| Rôle | Chemin (sous `apps/web/`) |
|---|---|
| Page RSC dashboard | `src/app/admin/emails/page.tsx` |
| Layout (monte la palette globale) | `src/app/admin/emails/layout.tsx` |
| Health check (logique) | `src/lib/admin/emails/health.ts` |
| KPI 7j (lecture DB) | `src/lib/admin/emails/queries.ts` (`getOutboxKpi`, `listRecentOutbox`) |
| Route santé (monitoring externe) | `src/app/api/admin/emails/health/route.ts` |
| Palette globale Cmd-K | `src/components/admin/emails/GlobalCommandPalette.tsx` |
| Schéma outbox (source de vérité champs) | `src/lib/db/schema-emails.ts` |

## 2. État cible — comportement optimal attendu

### 2.1 Les 6 KPI cards (fenêtre = 7 derniers jours glissants)

La page lit `getOutboxKpi()` qui agrège `email_outbox` sur `created_at >= now()-7j`.
Chaque carte a une **définition exacte**, une **formule** et une **période**.

| Carte | Définition | Formule SQL (état cible) | Période | Ton attendu |
|---|---|---|---|---|
| **Envoyés (7j)** | nombre de messages remis au SMTP (sortie réussie du pipeline) | `count(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked'))` | 7j | neutre |
| **Livrés** | confirmation **webhook** Stalwart de remise au MX destinataire | `count(*) FILTER (WHERE status IN ('delivered','opened','clicked'))` | 7j | neutre ; **alerte si = 0 ET envoyés > 0** (anomalie webhook) |
| **Échecs** | échecs SMTP + bounces (soft/perm) | `count(*) FILTER (WHERE status IN ('failed','bounced_soft','bounced_permanent'))` | 7j | ambre si > 0 |
| **DLQ** | abandonnés après `max_attempts` (dead-letter) | `count(*) FILTER (WHERE status = 'dlq')` | 7j | rose si > 0 |
| **En attente** | en file d'attente à l'instant T | `count(*) FILTER (WHERE status = 'pending')` | instantané | ambre si > 50 |
| **Total tentatives** | dénominateur (volume brut entré dans l'outbox) | `count(*)` | 7j | neutre |

**Sous-libellés (état cible) :**
- *Livrés* affiche `pct(livrés, envoyés) % des envoyés`. Quand `envoyés = 0`, afficher `—` (pas `0.0 %` trompeur, pas division par zéro).
- *Échecs* affiche `pct(échecs, total)`.
- Le formatage des nombres est `fr-FR` (séparateur de milliers = espace insécable : `1 234`).

**Écart cible vs actuel (audit F-001) :** le KPI *Livrés* est **structurellement à 0** car le
webhook Stalwart pointe vers un domaine inexistant — aucun `delivered` n'est jamais enregistré.
La page affiche pourtant `0` en ton **neutre**, sans signaler l'anomalie « envoyés >> 0 mais
livrés = 0 ». **État cible : carte Livrés en alerte rose + sous-libellé « webhook delivery
silencieux ? » dès que `envoyés ≥ seuil ET livrés = 0`.**

### 2.2 Badge santé (`HealthBadge`, niveaux `ok` / `degraded` / `incident`)

Rendu par `<details>` déroulant dans le header. Couleur + pastille :
`ok` 🟢 emerald · `degraded` 🟡 amber · `incident` 🔴 rose. Le niveau global = **pire
check** (worst-wins). Ce que **CHAQUE niveau doit détecter** (état cible) :

| Signal probé | Source données | Seuil → niveau | Détecté aujourd'hui ? |
|---|---|---|---|
| **SMTP configuré** (env `SMTP_USER`/`SMTP_PASSWORD`) | `env` | manquant → `incident` | ✅ oui |
| **DB joignable** | `getDb()` + try/catch | indispo → `incident` | ✅ oui |
| **Outbox stuck** (`sending` > 5 min) | `email_outbox` | `> 0` → `degraded` | ✅ oui |
| **DLQ 24h** | `email_outbox status='dlq'` | `> 10` → `incident` ; `1..10` → `degraded` | ✅ oui |
| **Pending accumulé** | `email_outbox status='pending'` | `> 50` → `degraded` | ✅ oui |
| **Dernier livré** (fraîcheur webhook) | `max(delivered_at)` | `null` OU `> 24h` → `degraded` ; `> 72h` → `incident` | ⚠️ **affiché mais n'influence PAS le niveau** |
| **Cron outbox vivant** (fraîcheur tick) | `max(updated_at)` rows traitées / table de heartbeat cron | pas de tick `< 5 min` → `incident` | ❌ **angle mort (F-002)** |
| **Cron automation/listmonk vivants** | heartbeat cron | timer absent / pas de run récent → `degraded` | ❌ **angle mort** |
| **Listmonk joignable** | ping `GET /api/health` Listmonk | down/timeout → `degraded` | ❌ **angle mort** |
| **Webhook Stalwart sain** | compteur events reçus 24h / dernier event | 0 event 24h alors qu'envois > 0 → `incident` | ❌ **angle mort** |

**Le détail déroulé (état cible) liste chaque check avec ✓/✗** et, en pied, une phrase de
synthèse actionnable (`details.join(' · ')`). Aucun badge ne doit afficher 🟢 « Système OK »
tant qu'un cron critique est mort ou que le dernier `delivered` remonte à plus de 24h.

**Écart cible vs actuel (audit F-002) :** `checkEmailingHealth()` est **aveugle** aux crons
morts, à Listmonk down et à un webhook Stalwart muet. `lastDeliveredAt` est calculé et affiché
mais **jamais réinjecté dans `issues`** → badge vert sur système cassé. C'est le défaut le plus
corrosif : il **rassure à tort**.

### 2.3 Tableau « Derniers envois »

`listRecentOutbox({ limit: 8 })`, tri `created_at desc`. Colonnes : Date (fr-FR
short+short), Template (mono), Destinataire, Statut (`StatusBadge`), lien « Voir » →
`/admin/emails/transactional/{id}`. État vide → ligne « Aucun envoi sur la période. ».
`StatusBadge` mappe 11 statuts vers libellé fr + couleur sémantique.

### 2.4 Navigation & layout

- 6 quick-links (`<nav>`) vers transactional / campaigns / automation / audiences /
  templates / listmonk.
- Astuce ⌘K / Ctrl K affichée sous la nav.
- `layout.tsx` monte `<GlobalCommandPalette />` (présent sur toute la section).

### 2.5 Command palette globale (Cmd+K)

`GlobalCommandPalette` — auto-contenu (pas de dép `cmdk`). Registre de 12 commandes
(8 Navigation + 4 Actions). Comportement cible :
- ⌘K / Ctrl+K **toggle** ouvert/fermé ; Esc ferme ; clic backdrop ferme.
- Filtre **fuzzy** (substring + sous-séquence) sur `label + hint`.
- Navigation clavier ↑/↓ borne (clamp à 0..n-1), Enter exécute (`router.push(href)`).
- a11y : `role="dialog"` + `aria-modal`, focus auto dans l'input à l'ouverture,
  `role="listbox"` + `aria-activedescendant` synchronisé, items `role="option"` +
  `aria-selected`.
- Résultat vide → `role="status"` « Aucun résultat ».

## 3. Oracles transversaux du module

1. **Honnêteté du badge** : un système cassé ne produit JAMAIS un badge 🟢.
2. **Pas de division par zéro** : taux de livraison `—` quand dénominateur = 0.
3. **Sémantique couleur** : hausse d'échecs ≠ vert ; anomalie « livrés=0 / envoyés>0 » signalée.
4. **i18n fr** : tous libellés/nombres en français, aucune chaîne anglaise visible.
5. **a11y** : badge focusable et déroulable au clavier, palette pilotable sans souris.

## 4. Écarts connus vs état cible (résumé audit, à cibler par les tests)

| Réf | Écart | Test de non-régression attendu |
|---|---|---|
| F-001 | *Livrés* à 0 structurel (webhook cassé) non signalé | `DSH-MSW-018`, `DSH-MSW-019` |
| F-002 | Health aveugle aux crons morts / Listmonk down / fraîcheur delivered | `DSH-MSW-031..037`, `DSH-UNIT-041..046` |
| F-002 | Badge 🟢 sur dernier delivered > 24h | `DSH-UNIT-044` |
| F-001 | Pas d'alerte « envoyés>>0 & livrés=0 » | `DSH-MSW-019` |

Voir `test-matrix.csv` (≥ 40 lignes), `scenarios-metier.md`, `flux-sante.puml`,
`specs/dashboard-kpis.msw.test.tsx`, `specs/health-states.msw.test.tsx`.
