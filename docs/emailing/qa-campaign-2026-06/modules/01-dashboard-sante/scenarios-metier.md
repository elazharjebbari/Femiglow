# Scénarios métier — Dashboard santé emailing

> Persona : **Salma**, opératrice e-commerce FemiGlow. Première action de sa
> journée : ouvrir `/admin/emails`. Le dashboard est son tableau de bord de
> confiance. Chaque scénario décrit ce qu'elle DOIT voir (état cible), dans
> quel ordre, et quelles actions elle enchaîne. Les oracles sont les
> assertions que la batterie de tests vérifie.

---

## Scénario 1 — Lundi matin après un weekend d'incident SMTP

**Contexte métier.** Le SMTP Stalwart est tombé vendredi soir (auth refusée).
Tout le week-end, les transactionnels se sont empilés en `pending`, et certains
ont basculé en `dlq` après épuisement des tentatives.

**Préconditions data.**
- `email_outbox` : ~640 rows `pending` (samedi+dimanche), 38 rows `dlq` sur 24h.
- `env.SMTP_USER` / `SMTP_PASSWORD` présents (le problème est l'auth runtime, pas la config) — *variante* : si on simule la config absente, voir étape 2b.
- Dernier `delivered_at` = vendredi 18h00 (> 60h).

**Déroulé & oracles.**
1. Salma ouvre `/admin/emails`.
   - *Oracle* : le **badge santé** affiche 🔴 **Incident** (DLQ 24h > 10 → incident ; pending > 50 → degraded ; worst-wins = incident). `DSH-MSW-035`, `DSH-MSW-037`.
2. Elle déroule le badge (clic sur le `summary`).
   - *Oracle* : la liste montre `DLQ 24h : 38`, `Pending : 640`, `Dernier livré : <vendredi 18h>`. La synthèse pied de badge concatène les anomalies. `DSH-MSW-044`.
   - 2b (*variante config absente*) : si `SMTP_USER` manque, le détail liste `SMTP : ✗ SMTP_USER` et le niveau reste incident. `DSH-MSW-031`.
3. Elle lit les KPI cards.
   - *Oracle* : *En attente* affiche `640` en ton ambre ; *DLQ* affiche `38` en ton rose ; *Livrés* à `0` doit être **signalé** (anomalie « envoyés>0 & livrés=0 »), pas neutre. `DSH-MSW-014`, `DSH-MSW-013`, `DSH-MSW-019`.
4. Elle veut traiter les échecs : clic sur le quick-link **Transactionnel →**.
   - *Oracle* : navigation vers `/admin/emails/transactional` (le tri/relance se fait dans le cockpit, cf. module 02). `DSH-E2E-070`.
5. **Anti-piège** : à AUCUN moment le badge n'a affiché 🟢 « Système OK ». C'est l'oracle anti-régression central. `DSH-UNIT-044`, `DSH-MSW-038`.

---

## Scénario 2 — Le piège du « tout vert » sur webhook mort (audit F-001/F-002)

**Contexte métier.** Le SMTP fonctionne (envois OK), mais le **webhook Stalwart**
pointe vers un domaine mort : aucun `delivered` n'est enregistré depuis 5 jours.
En l'état actuel, le dashboard ment : badge vert, KPI Livrés à 0 silencieux.

**Préconditions data.**
- `email_outbox` : 4 200 rows `sent` sur 7j, **0** `delivered`.
- 0 row stuck, 0 DLQ, pending = 3. SMTP configuré, DB ok.
- `max(delivered_at)` = il y a 5 jours.

**Déroulé & oracles (état CIBLE).**
1. Salma ouvre le dashboard.
   - *Oracle cible* : badge **NON vert** — au minimum 🟡 dégradé (dernier delivered > 24h) voire 🔴 (> 72h). `DSH-MSW-039`, `DSH-MSW-040`, `DSH-UNIT-044`.
2. KPI *Envoyés (7j)* = `4 200`, *Livrés* = `0`.
   - *Oracle cible* : la carte *Livrés* est en **alerte** (ton rose) avec un libellé « delivery silencieux ? webhook ? », car `envoyés ≥ seuil ET livrés = 0`. `DSH-MSW-018`, `DSH-MSW-019`.
3. Elle déroule le badge.
   - *Oracle cible* : ligne « Webhook Stalwart : ✗ 0 event reçu / 24h » + « Dernier livré : il y a 5 jours ». `DSH-MSW-043`.
4. **Non-régression** : ce scénario est écrit ROUGE avant le fix. Tant que `health.ts` ignore la fraîcheur `delivered` et le silence webhook, `DSH-UNIT-044`/`045` échouent — c'est voulu (on escalade le bug, on n'affaiblit pas l'oracle).

---

## Scénario 3 — Cron outbox mort (timer systemd absent)

**Contexte métier.** 5 crons email sur 6 n'ont pas de timer systemd (audit infra
F-110). Le cron `email-outbox` ne tourne plus : les `pending` ne sont jamais
drainés, mais rien n'est en `sending` ni en `dlq` — l'outbox « gèle » en silence.

**Préconditions data.**
- `email_outbox` : 120 rows `pending`, 0 `sending`, 0 `dlq`. SMTP ok, DB ok.
- Aucun heartbeat de cron `email-outbox` depuis 40 min.

**Déroulé & oracles.**
1. Salma ouvre le dashboard.
   - *Oracle (actuel, buggé)* : pending=120 > 50 → 🟡 dégradé seulement. Le vrai problème (cron mort) n'est pas nommé.
   - *Oracle cible* : badge 🔴 **Incident** avec détail « Cron outbox muet depuis 40 min ». `DSH-MSW-041`, `DSH-UNIT-045`.
2. KPI *En attente* = `120` ton ambre.
   - *Oracle* : ton ambre actif. `DSH-MSW-014`.
3. Salma comprend qu'il faut relancer le timer (renvoi vers runbook infra, module 11).
   - *Oracle* : la phrase de synthèse est **actionnable** (mentionne le cron, pas juste « pending élevé »).

---

## Scénario 4 — Journée nominale, pilotage clavier (a11y + i18n)

**Contexte métier.** Tout va bien. Salma travaille au clavier (souris HS).
On vérifie que l'expérience optimale est intégralement pilotable et en français.

**Préconditions data.**
- `email_outbox` : volumes sains 7j (envoyés 1 200, livrés 1 140, échecs 6, DLQ 0, pending 4).
- SMTP ok, DB ok, dernier delivered il y a 8 min, crons vivants, Listmonk up.

**Déroulé & oracles.**
1. Ouverture dashboard.
   - *Oracle* : badge 🟢 **Système OK** (légitime cette fois). `DSH-MSW-030`.
   - *Oracle i18n* : les 6 libellés de cartes sont en français. `DSH-MSW-022`.
   - *Oracle* : *Livrés* affiche `95.0 % des envoyés` (1140/1200), pas de `—`. `DSH-MSW-015`.
2. Elle ouvre la palette avec **⌘K**.
   - *Oracle* : `role=dialog` visible, focus dans l'input. `DSH-MSW-060`.
3. Elle tape `camp`, descend avec ↓, valide avec Entrée.
   - *Oracle* : `Campagnes` surfacé puis `router.push('/admin/emails/campaigns')`. `DSH-MSW-061`, `DSH-MSW-062`.
4. Elle revient, déroule le badge santé au clavier (focus summary + Entrée).
   - *Oracle a11y* : le détail s'ouvre sans souris. `DSH-MSW-045`, `DSH-E2E-071`.
