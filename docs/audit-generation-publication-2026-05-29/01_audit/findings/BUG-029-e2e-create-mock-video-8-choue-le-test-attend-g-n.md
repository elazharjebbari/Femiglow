# BUG-029 — E2E create-mock-video:8 échoue: le test attend « Générer un visuel IA » mais le bouton vidéo est « Générer une vidéo IA » (bug test, pas app)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-video |
| **Composant** | `e2e/content-studio-v2/create-mock-video.spec.ts:28 + src/components/admin/content-studio-v2/create/MediaStudio.tsx:240` |
| **Mode mock** | `works` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le spec MOCK 'reel → MP4 jouable' valide que le flux opérateur reel produit une vidéo lisible. Rapport attendu: passed.

## État réel vérifié
Le test timeout à 30s en cliquant getByRole('button',{name:/Générer un visuel IA/i}). En mode kind=video le libellé réel du bouton est « Générer une vidéo IA » (MediaStudio.tsx:240: kind==='video' ? 'Générer une vidéo IA' : 'Générer un visuel IA'). Le page-snapshot Playwright montre le bouton ref=e239 « Générer une vidéo IA » bien présent et cliquable. L'app fonctionne; le sélecteur du test est faux.

## Écart
Le test ne reflète pas le libellé réel. Un rapport rouge sur ce spec fait croire à une vidéo cassée alors que c'est le test qui est obsolète. Inversement le 2e spec (image, ligne 51) passe car il bascule en kind=image (libellé 'Générer un visuel IA').

## Cause racine
Libellé du bouton conditionnel au kind introduit après l'écriture du spec; le sélecteur du spec n'a pas été mis à jour.

## Preuves
- MediaStudio.tsx:240 → {kind === 'video' ? 'Générer une vidéo IA' : 'Générer un visuel IA'}
- create-mock-video.spec.ts:28 → await page.getByRole('button', { name: /Générer un visuel IA/i }).click();
- /tmp/audit-playwright.log:114-128 → 'Test timeout of 30000ms exceeded' waiting for getByRole('button', { name: /Générer un visuel IA/i })
- error-context.md page snapshot → button "Générer une vidéo IA" [ref=e239] [cursor=pointer] présent dans le DOM au moment du timeout

## Reproduction
1) pnpm exec playwright test e2e/content-studio-v2/create-mock-video.spec.ts:8 → FAIL timeout. 2) Inspecter MediaStudio.tsx:240 et le page-snapshot → bouton 'Générer une vidéo IA' présent. 3) Sélectionner reel dans /create → le bouton affiché est bien 'Générer une vidéo IA'.

## Piste de correction
Remplacer le sélecteur par /Générer une (vidéo|visuel) IA/i ou cibler data-cs-generate-button (présent sur le bouton, MediaStudio.tsx:238). Ne pas toucher l'UI: elle est correcte.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie directement: MediaStudio.tsx:240 rend bien `{kind === 'video' ? 'Générer une vidéo IA' : 'Générer un visuel IA'}`. Le spec ligne 28 attend /Générer un visuel IA/i. La regex 'visuel' ne matche PAS 'vidéo' (mots distincts). Le log playwright montre le timeout exact sur ce selecteur. L'app est correcte, le test est obsolete. Le 2e spec (ligne 50-51) bascule en kind=image AVANT de cliquer, donc le libelle 'visuel' matche -> passe. Coherent.
- **Contre-preuve / nuance :** MediaStudio.tsx:240 = `{kind === 'video' ? 'Générer une vidéo IA' : 'Générer un visuel IA'}`; bouton porte data-cs-generate-button (ligne 238) cible alternative valable. /tmp/audit-playwright.log: 'waiting for getByRole(button,{name:/Générer un visuel IA/i})' Test timeout 30000ms sur create-mock-video.spec.ts:28.

> Réf. registre : `bug-register.csv` ligne `BUG-029` · matrice : `gap-matrix.csv`.
