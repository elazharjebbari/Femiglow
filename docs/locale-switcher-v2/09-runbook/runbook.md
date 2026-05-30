# Runbook d'exécution — Locale Switcher V2

> Pilote l'exécution de `08-plan-action/plan-action.md`. **Séquentiel, idempotent, vérifiable.** Chaque section dit *quoi faire*, *comment vérifier*, *quoi faire si rouge*. La règle d'or : **on n'avance pas tant que la porte de l'étape n'est pas verte.**

## A. Pré-requis (une fois)
```bash
# Node 22 pour build/scan ; Node 20 pour le serveur de preview (cf. historique projet)
source ~/.nvm/nvm.sh
cd /Users/elazhar/PycharmProjects/template-femiglow
```
- DB locale up (`DATABASE_URL` dans `apps/web/.env`).
- Confirmer les scripts : `scripts/i18n-scan-fr.mjs`, `scripts/i18n-scan-latin-ar.mjs`.

## B. Baseline (L0) — figer l'état vert AVANT toute modif
```bash
cd apps/web
pnpm typecheck            # 0 erreur sur le périmètre
pnpm lint
pnpm build                # vert
# serveur up puis :
node scripts/i18n-scan-fr.mjs          # = 0
node scripts/i18n-scan-latin-ar.mjs    # = 0 (hors FemiGlow)
pnpm playwright test --grep @locale    # switcher actuel vert (si tag existant)
```
➡️ Archiver les sorties (date, hash de commit). **Si rouge → on corrige la base AVANT de commencer.**

## C. Exécution lot par lot
Pour **chaque** lot `Lk` du plan :
1. **Implémenter** les fichiers du lot (voir `plan-action.md` → section `Lk`).
2. **Écrire/mettre à jour** les tests du lot (IDs dans `vitest-plan.csv` / `playwright-plan.csv`).
3. **Porte locale** : lancer la cible du lot.
   ```bash
   pnpm vitest run <glob-du-lot>          # ex: use-locale-transition
   ```
4. **Porte de non-régression** (garde-fous) :
   ```bash
   pnpm typecheck && pnpm lint
   # si UI/contenu touché et serveur up :
   node scripts/i18n-scan-fr.mjs && node scripts/i18n-scan-latin-ar.mjs   # toujours 0
   ```
5. **Si tout vert** → cocher le lot (backlog), commit atomique `feat(i18n-v2): Lk …`.
6. **Si rouge** → entrer dans la **boucle de correction** (`test-loop.md`). Ne pas passer au lot suivant.

### Ordre recommandé (parallélisme)
- Après **L0** : exécuter **L1→L2→L3** (frontend) **et** **L4** (backend) en parallèle.
- **L5** après L4 ; **L6** après L4 ; **L7** après L3+L5+L6.

## D. Porte de qualité finale (L7) — avant le flag
```bash
cd apps/web
pnpm vitest run                                   # toute la suite i18n verte
pnpm playwright test --grep @locale-switcher      # E2E FR/AR/EN + RTL + mobile
# axe inclus dans les specs E2E (0 violation critique)
pnpm build                                        # vert
# serveur up :
node scripts/i18n-scan-fr.mjs && node scripts/i18n-scan-latin-ar.mjs   # = 0
```
➡️ Ouvrir `07-tests/coverage-matrix.csv` : **aucune ligne sans test**. Chaque INV-1..INV-12 a ≥ 1 ID vert. **Sinon → ajouter le test manquant (boucle).**

## E. Vérification manuelle ciblée (preview réel)
Sur le serveur de preview, vérifier *de visu* :
- `/fr/kit` → clic `العربية` : **fondu**, **pas de reload**, **RTL en place**, scroll conservé, `?utm` conservé.
- Idem sur `/`, `/journal`, `/maison`, `/contact`, `/rituel`.
- Mobile : pills dans le drawer ; footer pills.
- Nudge : visiteur AR sur `/fr` → perle 1×, dismiss → ne revient plus.
- Reduced-motion (OS) → bascule instantanée sans animation.
- Wizard checkout → **pas** de switcher (INV-5).
- `/admin/i18n` → édition + preview FR/AR/EN (dont RTL), save + audit.

## F. Bascule du flag (L8)
1. Activer `localeSwitcherV2` (ou A/B B1 vs B2).
2. Vérifier la **télémétrie** : events `locale_switch` (et `nudge_*`) remontent avec les bons payloads.
3. Surveiller 24–48 h : taux de bascule, taux d'ajout panier par langue, erreurs.
4. **Rollback prêt** (`rollback.md`).

## H. Track moteur de suggestion (L9→L12) — voir `../10-suggestion-engine/`
> Le moteur est **off par défaut** (INV-13). On le construit, on l'audite, puis on l'**active profil par profil**.

### H.1 Construction (même boucle que §C)
- **L9** (pures) : `pnpm vitest run guess-preferred-locale suggestion-policy` → **table de vérité** verte + **test négatif** par invariant (INV-13/14/17).
- **L10** (runtime/prompt) : `pnpm vitest run use-locale-suggestion-engine LocaleSuggestionPrompt` + `pnpm playwright test --grep @locale-engine`.
- **L11** (config/admin/audit) : `pnpm vitest run suggestion-engine-config` + `--grep @locale-engine-admin`.
- **L12** (E2E/garde) : `pnpm playwright test --grep @locale-engine` + scanners + build.

### H.2 Vérification manuelle ciblée (preview)
- Moteur **off** (défaut) → **aucune** proposition, où qu'on aille.
- Activer `TRIG-ENTRY-MISMATCH` en admin, visiter `/fr` avec navigateur AR :
  - **rien au load** ; la proposition n'apparaît **qu'au breakpoint** (pause de scroll) — INV-17.
  - **jamais** pendant le checkout/wizard (INV-14) ni en lecture longue d'un article (INV-15).
  - **accept** → bascule **sans reload** ; **dismiss « ne plus proposer »** → ne revient jamais (INV-16).
  - exit-intent (desktop) → toast « rester / passer » ; **jamais d'auto-redirect** (INV-20).
- Ouvrir `/admin/i18n/engine/audit` : vérifier que chaque décision (montrée/supprimée) est tracée avec **raison + profil** (INV-19), et que **toutes** les suppressions en zone calme sont bien là.

### H.3 Audit = porte d'activation (INV-19)
Avant d'activer un profil en prod, lire l'audit (sur preview/staging avec trafic simulé) :
- `% montré au breakpoint` ≈ 100 % (INV-17).
- `suppressions en checkout/form/deep-read` = la **seule** voie en zones calmes (INV-14/15) — 0 fuite.
- `dismiss < 2 s` (proxy d'agacement) **bas**.
- `taux d'acceptation` des montrées **correct**.

### H.4 Activation progressive (L12)
1. `localeSuggestionEngine` flag on, mais **tous profils trigger off** (INV-13 préservé) → 0 affichage.
2. Activer **un** profil (ex. `TRIG-ENTRY-MISMATCH`) en A/B.
3. Lire l'audit + KPIs (acceptation, dismiss<2s, conversion par langue) 24–48 h.
4. Si sain → activer le profil suivant ; sinon désactiver le profil (config) — **rollback granulaire**.

## G. Définition de fin
- Tous les lots **verts** (switcher L0→L8 **et** moteur L9→L12), `coverage-matrix.csv` complets (parent + moteur).
- Garde-fous verts (scanners, build, wizard).
- Switcher : flag on stable, télémétrie OK, rollback testé.
- Moteur : **off par défaut** livré ; activation profil par profil pilotée par l'audit ; rollback granulaire (désactiver un profil) **et** global (`engineEnabled=false` / flag off) testés.
- `delivery-checklist.txt` entièrement cochée (sections switcher + moteur).
