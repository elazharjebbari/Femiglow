# S08 — Network blackout

## Pré-conditions
- Postiz unreachable (timeout simulé) ou bandwidth=0

## Étapes
1. publish-now → adapter timeout après 30s
2. Retry → timeout × 3 → status='failed', code='provider_timeout'
3. Toast "Délai de réponse dépassé."
4. alerts.ts envoie webhook Slack (mock spy)
5. Postiz revient online → retry → succès

## Critères
- Pas de hung request UI
- Job marked failed within 60s max
- Slack alert sent once

## Spec
`e2e/social-publishing/network-blackout.spec.ts`
