# F15 — Programmation

## Objectif
Programmer la publication à une date/heure future.

## Comportement attendu
- Option "Programmer" dans dropdown
- Dialog avec `<input type="datetime-local">` (déjà présent)
- Validation : doit être > now + 5 minutes
- Appel `POST /posts/:id/schedule { scheduledAt }`
- Toast succès "Publication programmée pour XX/XX à HH:MM"

## Comportement actuel
Fonctionnel. Validation min côté HTML mais pas server.

## Gaps
- F15-LOCAL-1 : pas de fuseau horaire visible (`datetime-local` est naive)
- F15-LOCAL-2 : pas de "reschedule" depuis la même UI

## Propositions
### A — Statu quo + label fuseau
Ajouter label "Fuseau : Europe/Paris (UTC+2)" sous l'input.

### B — Custom datepicker avec timezone explicite
Lourd.

### C — Buttons preset ("+1h", "Demain 9h", "Lundi 14h")
Ergonomique.

## Recommandation
**A + C** (cumulés).

## Implementation
- Ajouter label fuseau
- 3 boutons preset au-dessus de l'input

## Tests
Voir `test-scenarios.yaml`.
