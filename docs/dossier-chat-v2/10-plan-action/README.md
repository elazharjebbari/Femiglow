# Plan d'action — Chronologie opérationnelle jour par jour

> Le plan de conception (08) répond à **pourquoi/quoi**. Le plan de développement (09) répond à **comment/qui** avec sprints et tickets. Ce plan d'action répond à **quand exactement** : chronologie quotidienne, livrables tangibles, points de synchronisation. C'est la carte du capitaine.

## Pourquoi un plan d'action séparé ?

Dans une agence de très haut calibre, on sépare trois plans car ils servent trois publics et trois moments :

| Plan | Public | Moment | Granularité |
|---|---|---|---|
| Conception (08) | Stakeholders, sponsors, PO | Avant lancement | Vagues / lots / mois |
| Développement (09) | Équipe dev, PO | Pendant sprint | Sprints / tickets / story points |
| **Action (10)** | **Équipe entière, daily** | **Au quotidien** | **Jours / livrables / checkpoints** |

Un dev qui ouvre Linear voit ses tickets. Un PO qui veut savoir « où on en est mardi 26 mai à 14h » consulte le plan d'action.

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`day-by-day.csv`](day-by-day.csv) — calendrier jour par jour V5 (S1+S2) avec qui fait quoi
- [`deliverables.txt`](deliverables.txt) — liste exhaustive checklisté des livrables tangibles attendus
- [`checkpoints.md`](checkpoints.md) — points de synchronisation (daily, planning, demo, retro) avec ordres du jour types
- [`escalation.md`](escalation.md) — escalation paths quand on dérape (retard, blocker, incident)

## Cadence opérationnelle

### Daily standup — 9h30, 15 min max

**Format** : tour de table dev_lead → dev_intermediate → designer → content_yasmine → care_karim → po_selma.

**3 questions par personne** :
1. Qu'ai-je terminé hier ?
2. Que vais-je terminer aujourd'hui ?
3. Suis-je bloqué·e ? Par qui ?

**Anti-pattern** : narration détaillée d'une journée. Si une discussion technique émerge, parking-lot après daily.

### Demos sprint end — vendredi, 1h

Chaque ticket Done est démontré en live (preview Vercel). Pas de slides, pas de captures statiques. Le PO valide ou redirige sur place.

### Retro sprint end — vendredi après demo, 1h

Format Start/Stop/Continue. Une seule action concrète par bucket, owner identifié, deadline = mid-sprint suivant.

### 1:1 hebdo dev ↔ PO — 30 min

Espace pour les non-dits du sprint : frustrations, idées hors-scope, doutes architecture. PO écoute plus qu'il parle.

## Règle des 3 horizons d'attention

Dans une journée type :

| Horizon | Quoi | Quand y penser |
|---|---|---|
| **Horizon jour** | Mon ticket actif, tests, PR ouverte | Heure par heure |
| **Horizon sprint** | Mon sprint courant, démo vendredi | Une fois par jour, après daily |
| **Horizon vague** | V5 / V6 / V7, gates, milestones | Une fois par semaine, en 1:1 PO |

Un dev qui pense V7 pendant qu'il code V5.1 est un dev qui livre lentement. Un PO qui ne pense que V5.1 pendant que V6 démarre est un PO qui sera surpris.

## Synchronisation cross-team

- **Slack `#chat-build`** : standup async miroir + questions techniques.
- **Slack `#chat-launch`** : annonces déploiement (uniquement bot + dev_lead).
- **Slack `#chat-care`** : signalements care, frustration alerts.
- **Notion `Chat V2 Hub`** : docs longue forme + meeting notes.
- **Linear `CHAT`** : seule source de vérité pour le statut des tickets.

## Critères "vert / orange / rouge" par sprint

À mi-sprint (mercredi de la semaine 1) et fin sprint (vendredi de la semaine 2) :

- 🟢 **Vert** : ≥ 90% points sprint Done. On peut absorber un peu de stretch.
- 🟡 **Orange** : 70–89% points Done. On reprio, on coupe le moins critique.
- 🔴 **Rouge** : < 70% points Done. On déclenche escalation (voir `escalation.md`).

## Documents d'entrée requis avant Day 1 (S1)

- [ ] Specs validées par PO (toutes sections 02–07).
- [ ] Comptes provider LLM créés (OpenAI, Anthropic, Mistral, Gemini) avec quotas.
- [ ] Sentry projet `chat-v2` créé + DSN partagé.
- [ ] Postgres staging + prod prêts avec backups configurés.
- [ ] Vercel projet `femiglow-chat` créé + preview deployments activés.
- [ ] Linear projet `CHAT` créé + tickets CHAT-001 à CHAT-020 importés.
- [ ] Slack channels `#chat-build`, `#chat-launch`, `#chat-care` créés.
- [ ] Notion hub initial publié avec liens dossier-chat-v2.
- [ ] Kickoff meeting tenu (2h, vendredi avant Day 1) — go/no-go enregistré.

## Définition d'une "journée idéale dev"

```
09:00-09:30 — Prep : café, ouvre Linear, identifie le 1 ticket sur lequel je vais cracker la journée
09:30-09:45 — Daily standup
09:45-12:00 — Deep work block 1 (silence, slack notifs off, IDE plein écran)
12:00-13:00 — Pause déjeuner ferme (pas devant écran)
13:00-15:30 — Deep work block 2
15:30-16:00 — Code review des PR coéquipiers (max 2 par jour)
16:00-17:30 — Polissage : tests, doc inline, PR description
17:30-18:00 — Wrap : update Linear, commit final, slack récap async pour le coéquipier
```

Pas plus de **2 réunions par jour** pour un dev, hors daily. Si plus, escalation au PO.

## Anti-patterns plan d'action

- ❌ Plan d'action figé : il évolue chaque vendredi en retro.
- ❌ Plan d'action absent : on improvise et on dérive de 30%.
- ❌ Plan d'action sans owner par jour : tout le monde croit que quelqu'un d'autre fait la migration.
- ❌ Plan d'action sans points de synchro : on s'aperçoit vendredi qu'on s'est croisé.
- ❌ Plan d'action en silos : le designer ne sait pas qu'il doit livrer mardi pour débloquer mercredi dev.
