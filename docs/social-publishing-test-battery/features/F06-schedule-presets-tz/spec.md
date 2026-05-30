# F06 — Schedule presets + timezone label

## Importance : 🟡 P2 (UX polish)

## Objectif
3 boutons preset pour remplir rapidement la date scheduledAt : +1h / Demain 9h / Lundi 14h. Plus un label timezone affiché pour clarité.

## Comportement attendu

### Presets
- **+1h** : `now + 1h`, arrondi à 5min upward
- **Demain 9h** : demain à 09:00 timezone navigateur
- **Lundi 14h** : prochain lundi à 14:00 (jamais aujourd'hui si lundi)

### Timezone label
- Format : `Fuseau : Europe/Paris` (ou la tz détectée via `Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Affichée sous l'input datetime-local

### Validation
- Tous les presets produisent une date > now + minLeadTime
- L'input est mis à jour côté React via setState

## Tests
Voir `test-scenarios.yaml`.
