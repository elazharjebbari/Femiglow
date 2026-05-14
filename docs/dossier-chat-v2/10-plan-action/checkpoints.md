# Checkpoints — Points de synchronisation

> Réunions, rituels, ordres du jour types. Sans rituels, l'équipe dérive. Avec trop de rituels, l'équipe s'épuise. Le bon dosage est un art.

## Cadence hebdomadaire

```
LUNDI
 09:30  Daily standup (15 min)
 10:00  Sprint planning si lundi sprint start (2h)
 14:00  1:1 dev_lead ↔ PO (30 min)
 14:30  1:1 dev_intermediate ↔ PO (30 min)

MARDI
 09:30  Daily standup
 10:00  Sync designer ↔ dev_intermediate (live pairing si besoin)

MERCREDI
 09:30  Daily standup
 10:00  Mid-sprint check 🟢🟡🔴 (PO + dev_lead, 30 min)

JEUDI
 09:30  Daily standup
 14:00  Sync content_yasmine ↔ care_karim (workflow leads, 30 min)

VENDREDI
 09:30  Daily standup
 14:00  Demo sprint (si fin sprint, 1h)
 15:30  Retro sprint (1h)
 16:30  V6/V7 prep si applicable (PO seul, 30 min)
```

## Daily standup — 9h30, 15 min max

**Format async d'abord** : chacun poste avant 9h25 dans `#chat-build` :

```
Hier ✅ : [ticket(s) fermé(s)]
Aujourd'hui 🎯 : [ticket sur lequel je crack la journée]
Bloqué ❓ : [oui/non, par qui/quoi si oui]
```

**Live à 9h30** : on parle uniquement des bloquants. Si pas de bloquant, daily dure 5 min.

**Anti-pattern à proscrire** :
- ❌ Narration d'une journée détaillée
- ❌ Débat technique pendant le daily (parking-lot après)
- ❌ Daily à 10h ou 11h (rate l'effet d'alignement matinal)
- ❌ Daily depuis le lit (caméra obligatoire mais visage uniquement)

## Sprint planning — Lundi sprint start, 2h

**Préparation PO** (avant le planning) :
- [ ] Backlog priorisé
- [ ] Tickets de tête détaillés (acceptance criteria écrits)
- [ ] Dépendances entre tickets identifiées
- [ ] Estimation points faite avec dev_lead async

**Ordre du jour** :
1. **Vue d'ensemble objectifs sprint** (10 min, PO) — quel impact business ce sprint vise.
2. **Walk-through tickets** (60 min, dev_lead + PO) — chaque ticket lu, questions clarifiées, ré-estimé si besoin.
3. **Confirmation capacity** (15 min) — qui prend quoi, vélocité respectée.
4. **Sync designer / content / care** (20 min) — non-dev contributors confirment leurs livrables.
5. **Risques sprint** (15 min) — top 3 risques + mitigation.

**Output** :
- Sprint backlog Linear gelé (pas d'ajout sans escalation PO).
- Doc Notion `Sprint NN — Planning` avec décisions clés.

## Mid-sprint check — Mercredi semaine 1 et 2

**Format** : PO + dev_lead, 30 min.

**Questions à se poser** :
- Sommes-nous 🟢 vert (≥50% sprint points done à mi-W1) ?
- Sommes-nous 🟡 orange (30-49%) → reprio ?
- Sommes-nous 🔴 rouge (<30%) → escalation ? scope cutter ?

**Décisions possibles** :
- Cut un ticket non-critique du sprint
- Demander aide cross-team (designer débloque dev)
- Reporter une feature à sprint suivant
- Communiquer status à stakeholders externes

**Output** : Slack récap dans `#chat-build` :
```
🟢/🟡/🔴 Sprint NN mid-check
Done : X / Y points
Risques : [...]
Décisions : [...]
```

## Demo sprint end — Vendredi sprint end, 1h

**Format** : équipe entière + stakeholders invités (CEO, marketing, ops).

**Règles d'or** :
- ✅ Live preview Vercel uniquement, pas de slides.
- ✅ Chaque ticket Done est démontré par le dev qui l'a fait (pas le dev_lead toujours).
- ✅ Démos en darija si feature darija, en arabe si feature arabe.
- ✅ Si bug pendant la démo, on en parle, on ne cache pas.
- ✅ Demo de 7-8 features max — si plus, on rationalise.

**Ordre type** :
1. PO **introduction** (5 min) — objectifs sprint rappelés.
2. **Démos features** (40 min) — round-robin par dev/ticket.
3. **Métriques sprint** (5 min, PO) — points done, NS evolution si applicable.
4. **Q&A stakeholders** (10 min).

**Output** : Loom recording publié dans `#chat-launch` pour ceux absents.

## Retro sprint end — Vendredi après demo, 1h

**Format** : équipe core uniquement (devs + PO + designer + content + care). Pas de stakeholders externes — espace safe pour parler franchement.

**Format Start/Stop/Continue + 1 action concrète** :

```
START (à commencer)
  - [...]
  - [...]

STOP (à arrêter)
  - [...]
  - [...]

CONTINUE (à maintenir)
  - [...]
  - [...]

ACTIONS CONCRÈTES (sprint suivant)
  - Action 1 — owner : ___, deadline : mid-sprint
  - Action 2 — owner : ___, deadline : sprint end
```

**Règle stricte** : 1 action concrète par bucket max. Pas 12 actions dont 11 oubliées. Mieux 3 actions tenues que 15 ignorées.

**Output** : Notion `Sprint NN — Retro` avec actions + owners + deadlines.

## 1:1 dev ↔ PO — Hebdo 30 min

**Format** : Lundi 14h dev_lead, 14h30 dev_intermediate.

**Règle d'or** : c'est l'espace du dev, pas du PO. PO écoute 70% du temps.

**Questions ouvertes type** :
- Comment te sens-tu cette semaine ?
- Qu'est-ce qui te frustre dans le sprint courant ?
- Tu as une idée hors-scope qui te trotte ? Vas-y, raconte.
- Quelque chose à demander que tu n'oses pas en daily ?

**Output** : Pas de doc obligatoire. PO note les insights privés dans son carnet.

## Gates V5 → V6 — Vendredi sprint end V5

**Critères go/no-go** (du `phasing-roadmap.md`) :

- [ ] V5 deployed in prod + 7 days uptime > 99.5%
- [ ] No P0/P1 incidents pending
- [ ] Chat_to_purchase baseline mesurée (J+7)
- [ ] Care team confirmed leads workflow nominal
- [ ] Dashboards consultés DAU >= 1
- [ ] Team retro V5 actions implémentées 80%+

**Décision** :
- ✅ Go V6 : on enchaîne sprint V6 lundi suivant.
- ⏸️ Hold V6 : on stabilise V5 +1 semaine.
- 🔄 Reprio V6 : on ajuste scope V6 selon retours V5.

## Gates V6 → V7

Idem V5 → V6, avec critères supplémentaires :
- [ ] Conversion NS x2 baseline mesurée
- [ ] A/B testing engine fiable (no contamination)
- [ ] Adoption admin DAU >= 1

## Escalation paths

Voir [`escalation.md`](escalation.md).

## Sync transverses ponctuels

**Sync designer ↔ dev** (mardi) : pairing live si features visuelles complexes en cours.

**Sync content ↔ care** (jeudi) : workflow leads, mise à jour FAQ avec retours care.

**Sync legal** (mensuelle) : audit RGPD + retention + audit léger sécurité.

**Sync stakeholders externes** (mensuelle) : CEO + marketing + ops. PO leads. Status + roadmap.

## Anti-patterns rituels

- ❌ Daily à 11h ou plus tard : perd l'effet matinal d'alignement.
- ❌ Retro qui devient bla-bla : forcer 1 action concrète par bucket.
- ❌ Sprint planning sans préparation PO : on improvise → vélocité plombée.
- ❌ Demo sans live : slides + screenshots = stakeholders ne voient pas la vérité.
- ❌ Gate V5→V6 trop souple : on enchaîne sur du sable.
- ❌ Pas de 1:1 hebdo : les non-dits explosent en retro et c'est tard.
