# Code modèle (gold standard) — à copier-adapter

Ces fichiers sont **fonctionnels dans le harnais réel du repo** (serveur MSW
partagé `@/test/msw/server`, handlers `@/test/msw/emails-handlers`, factories
`@/test/factories/emails.factory`, helpers E2E `e2e/_helpers/*`). Ils fixent le
standard exigé par `../05-strategie-tests.md` — toute PR de test doit pouvoir
soutenir la comparaison.

| Fichier | Patron illustré |
|---|---|
| `exemple-composant-msw.test.tsx` | test composant vue opérateur + **grille réseau 6 cas** + anti-double-clic + fake timers |
| `exemple-contrat.test.ts` | **conformité de contrat** : la réponse du handler MSW DOIT parser avec le schéma Zod de prod |
| `exemple-e2e.spec.ts` | scénario métier Playwright multi-écrans avec helpers DB/Mailpit, `test.step`, oracles opérateur |

Règles rappelées :
- lifecycle MSW **par fichier** (`listen`/`resetHandlers`/`close`), politique
  `onUnhandledRequest` choisie explicitement ;
- précédence MSW 2.x : dans un même `server.use(...)` le premier matchant
  gagne ; entre deux `server.use()` séparés, le dernier gagne ;
- sélecteurs : rôle+nom accessible d'abord ; testid réservé aux compteurs/zones ;
- noms de tests préfixés par l'ID de batterie (`F0x-C-nnn — …`).
