# 08 — Runbook pour un agent

Procédure exécutable pas à pas. Chaque étape donne la commande, le résultat attendu et quoi faire s'il diffère. Ne pas sauter d'étape, ne pas improviser de variante.

## 0. Repères

| Élément | Valeur |
|---|---|
| Dépôt | `/Users/ahmedelazharjebbari/PycharmProjects/Femiglow` |
| Branche | `feat/kit-etape2-accuse` (contient `fix/kit-bugs-graves`) |
| Serveur | `ssh alfenna`, application dans `/var/www/femiglow`, service `femiglow`, port interne 8011 |
| Version en ligne depuis le 18/11/2026 11:50 UTC | `_gl4GNVax-rar7iu7pV2k` |
| Version précédente | `f6jtv7ge9qw3xXa2lLxsF`, dans `apps/web/.next-prev` sur le serveur |
| Node | 22, par `nvm use 22` (Node 24 fait échouer `next/font`) |
| Base de test | Conteneur Docker `femiglow-test-pg`, `postgres://femiglow:test@127.0.0.1:55432/femiglow_test` |
| Config locale | `~/femiglow-env-local.bak`, à copier vers `apps/web/.env.production.local` pour les tests, à retirer avant de compiler pour la production |

## 1. Règles

1. **Jamais de numéro inventé sur le site réel.** La fiche part au CRM et une personne serait appelée. Pour contrôler la production, utiliser le script de §5, qui bloque tous les envois.
2. **Jamais de compilation de production avec `apps/web/.env.production.local` présent.** `bin/compiler-mac.sh` refuse, ne pas contourner.
3. **Le serveur ne compile pas.** Mémoire insuffisante : compiler sur le Mac.
4. **Lecture de la base de production : refusée à l'agent en mode automatique.** Ne pas réessayer par un autre chemin. Demander à l'utilisateur de lancer `bash bin/deployer-accuse.sh mesurer`.
5. **Changer la part dans l'admin ou le `.env` du serveur : décision de l'utilisateur.** Proposer, ne pas faire sans demande.
6. **S'arrêter et rendre compte** dès qu'un résultat diffère de l'attendu et que la colonne « Sinon » dit d'arrêter.

## 2. Vérifier l'état (lecture seule)

```bash
cd /Users/ahmedelazharjebbari/PycharmProjects/Femiglow
git status --short && git branch --show-current && git log --oneline -3
bash bin/deployer-accuse.sh verifier
```

| Attendu | Sinon |
|---|---|
| Branche `feat/kit-etape2-accuse` | `git checkout feat/kit-etape2-accuse` |
| `build en ligne : _gl4GNVax-rar7iu7pV2k` ou plus récent | Une autre session a déployé : arrêter, demander |
| `migrations ajoutées : aucune`, dépendances : rien | Arrêter : ce runbook ne couvre pas les migrations |
| `VERIFICATION TERMINEE`, `code retour : 0` | Lire le message, arrêter |

## 3. Tester en local

```bash
docker start femiglow-test-pg
cd apps/web
cp ~/femiglow-env-local.bak .env.production.local
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22

npx tsc --noEmit -p .
npx vitest run src/lib/checkout/step2-ack.test.ts src/lib/checkout/kit-checkout-config.test.ts \
  src/components/checkout/wizard/LeadAckNotice.test.tsx \
  src/components/checkout/wizard/steps/AddressStepV2.ack.test.tsx

rm -rf .next
NEXT_SKIP_TYPECHECK=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=6144 ./node_modules/.bin/next build
```

Deux serveurs, chacun en tâche de fond :

```bash
NODE_ENV=production ./node_modules/.bin/next start -H 127.0.0.1 -p 3100
I18N_ENABLED=true NODE_ENV=production ./node_modules/.bin/next start -H 127.0.0.1 -p 3102
```

Puis :

```bash
E2E_DATABASE_URL=postgres://femiglow:test@127.0.0.1:55432/femiglow_test \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 E2E_AR_BASE_URL=http://127.0.0.1:3102 \
npx playwright test e2e/kit-etape2-accuse.spec.ts e2e/kit-ma-ville.spec.ts e2e/kit-bugs-graves.spec.ts \
  --project=chromium --no-deps --reporter=line
```

| Attendu | Sinon |
|---|---|
| `tsc` sans sortie | Corriger avant d'aller plus loin |
| 44 tests unitaires réussis | Corriger |
| 15 parcours réussis | Corriger. Ne pas déployer avec un parcours en échec |
| Suite complète : un seul échec connu, `event-catalog.checkout.test.ts` | Tout autre échec est à examiner |

Arrêter les deux serveurs avant l'étape suivante (`lsof -tiTCP:3100 -sTCP:LISTEN | xargs kill`, idem 3102).

## 4. Mettre en ligne

```bash
cd /Users/ahmedelazharjebbari/PycharmProjects/Femiglow
git push -u origin feat/kit-etape2-accuse
mv apps/web/.env.production.local ~/femiglow-env-local.bak
bash bin/compiler-mac.sh                 # environ 4 minutes
bash bin/deployer-accuse.sh verifier
bash bin/deployer-accuse.sh preparer     # le site en ligne ne change pas
bash bin/deployer-accuse.sh installer    # essai sur 8019, puis bascule
```

| Attendu | Sinon |
|---|---|
| `compilé : <identifiant>` | Lire l'erreur. `REFUS : apps/web/.env…` : déplacer le fichier |
| `PREPARATION TERMINEE` | Arrêter |
| Toutes les lignes d'essai `→ 200` et `: oui` | Le script n'a rien basculé : lire les 15 dernières lignes, corriger, recompiler |
| `OK : <identifiant> en ligne` puis `code retour : 0` | `ECHEC après bascule` : le script est revenu seul à l'ancienne version. Arrêter, rendre compte |

L'installation redémarre le service : quelques secondes d'indisponibilité. Hors urgence, préférer avant 9 h ou après 23 h, heure du Maroc.

Après l'installation, remettre la config locale : `cp ~/femiglow-env-local.bak apps/web/.env.production.local`.

## 5. Contrôler le site réel sans rien écrire

Le contrôle remplit l'étape 1 dans un navigateur dont **toutes** les requêtes d'écriture vers le site et toutes les requêtes vers d'autres domaines sont bloquées. Aucune fiche, aucun événement publicitaire.

```js
// à lancer avec : node controle-prod.cjs   (depuis apps/web, Node 22)
const { chromium } = require('@playwright/test');
const ORIGIN = 'https://femiglow-maroc.com';
(async () => {
  const browser = await chromium.launch();
  for (const path of ['/kit?cta=scroll', '/ar/kit?cta=scroll', '/kit?cta=scroll&ack=off']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', (route) => {
      const r = route.request();
      if (!r.url().startsWith(ORIGIN) || r.method() !== 'GET') return route.abort();
      return route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + path, { waitUntil: 'commit', timeout: 60000 });
    await page.getByRole('button', { name: /tout refuser|رفض/i }).first().click({ timeout: 4000 }).catch(() => {});
    const lead = page.getByTestId('wizard-step-lead');
    await lead.scrollIntoViewIfNeeded();
    await lead.locator('input[autocomplete="given-name"], input[name=firstName]').first().fill('Salma');
    await lead.locator('input[type=tel], input[name=phone]').first().fill('0600000000');
    const box = lead.locator('input[type=checkbox]').first();
    if (!(await box.isChecked())) await box.check({ force: true });
    await page.getByTestId('wizard-lead-submit').evaluate((el) => el.click());
    const step = page.getByTestId('wizard-step-address');
    await step.waitFor({ timeout: 20000 });
    const ack = page.getByTestId('wizard-lead-ack');
    console.log(path, await step.getAttribute('data-ack'), (await ack.count()) ? (await ack.innerText()).replace(/\s+/g, ' ') : '(pas d’accusé)');
    await ctx.close();
  }
  await browser.close();
})();
```

| Chemin | Attendu |
|---|---|
| `/kit` | `true`, « C’est noté, Salma. Nous vous appelons au 06 00 00 00 00 pour confirmer votre commande. » |
| `/ar/kit` | `true`, « وصلتنا معلوماتكِ، Salma. … » |
| `/kit?…&ack=off` | `false`, pas d'accusé |

Si la part de l'admin est entre 1 et 99, `/kit` peut donner l'un ou l'autre : ajouter `&ack=on` pour forcer.

Compléter par :

```bash
for u in /kit /ar/kit /api/health; do curl -s -o /dev/null -m 25 -w "$u %{http_code} %{time_total}s\n" "https://femiglow-maroc.com$u"; done
```

Attendu : trois fois 200. Les premières réponses après une installation peuvent prendre 5 secondes (cache vide).

## 6. Surveiller

| Quand | Quoi | Commande ou lieu | Alerte |
|---|---|---|---|
| +15 min | Pages et service | Boucle `curl` ci-dessus | Autre chose que 200 : §7, niveau 3 |
| +1 h | Mémoire du service | `ssh alfenna 'systemctl status femiglow --no-pager \| head -12'` (lecture) | Redémarrages en série : rendre compte. Un plantage mémoire isolé existait déjà le 11/11 |
| +1 jour, +3 jours, +7 jours | Part des fiches devenues commandes | L'utilisateur lance `bash bin/deployer-accuse.sh mesurer` | Baisse de plus de 3 points sur 3 jours pleins à trafic comparable : proposer le niveau 1 de §7 |
| +3 jours | Appels | Trello : décroché, confirmation, numéros faux | Plaintes « je n'ai rien commandé » en hausse : revoir le texte |

## 7. Revenir en arrière

Du plus léger au plus lourd. Prendre le premier niveau qui suffit.

| Niveau | Quand | Action | Qui |
|---|---|---|---|
| 1 | L'accusé fait baisser les commandes | Admin, composant `kit-checkout`, champ `step2AckSharePct` à 0, publier | Utilisateur |
| 2 | L'admin est indisponible | Sur le serveur : ajouter `CHECKOUT_STEP2_ACK=off` à `/var/www/femiglow/apps/web/.env`, puis `systemctl restart femiglow` | Utilisateur |
| 3 | Le site est cassé | `bash bin/deployer-accuse.sh annuler` : remet `.next-prev`, redémarre, contrôle `/kit` | Agent, sur demande explicite |

Après le niveau 3, la version retirée est dans `.next-failed`. `.next-prev` n'existe plus : un second `annuler` sera refusé.

## 8. Lancer un test sur la moitié des visiteuses

1. Admin : synchroniser le registre des composants, puis composant `kit-checkout`, `step2AckSharePct` à 50, publier.
2. Ne rien changer d'autre pendant 7 jours (publicités, prix, textes).
3. Lecture : second tableau de `bash bin/deployer-accuse.sh mesurer` (étapes 2 vues et terminées, par bras). Il ne compte que les visiteuses ayant accepté les cookies de mesure.
4. Décision : 100 si le bras « avec accusé » fait au moins aussi bien, 0 sinon.

Ne jamais modifier la clé `kit-step2-ack` : les visiteuses changeraient de bras.

## 9. Modifier un texte

1. Éditer `apps/web/src/lib/checkout/i18n/locales/{fr,ar,en}.ts`, bloc `addressV2`, clés `ack*` et `subtitleAck`.
2. Reporter dans [05-textes.md](05-textes.md) et, pour le français, dans `e2e/kit-etape2-accuse.spec.ts`.
3. Refaire §3 puis §4.

## 10. Compte rendu attendu en fin d'intervention

- Commit et identifiant de compilation en ligne.
- Résultat des tests (nombres) et du contrôle de §5.
- Ce qui n'a pas pu être fait, et pourquoi.
- Mise à jour du tableau de [07-plan-action.md](07-plan-action.md).
