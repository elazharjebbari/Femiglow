# F01 — Gaps

| Gap | Gravité | Description |
|-----|---------|-------------|
| G05 | 🟠 P1 | Hack `deriveActiveStep` ; drift UI vs `draft.status` |
| G10 | 🟡 P2 | cursor:not-allowed sans tooltip |
| F01-LOCAL-1 | 🟡 P2 | Pas de badge Mock Mode |
| F01-LOCAL-2 | 🟡 P2 | Navigation past ne scrolle pas vers le composant |
| F01-LOCAL-3 | 🟢 P3 | Pas de transition animée entre states |

## Implications

- L'UX semble fluide mais l'état DB ne reflète pas la progression — audit/reporting fausse
- En cas de rechargement, l'étape peut "reculer" si caption a été perdue (rare mais possible)
- Steps futures forment un mur visuel sans expliquer le pourquoi
