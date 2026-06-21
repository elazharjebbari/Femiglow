# Runbook — pilotage de l'exécution du plan d'action « emails-ux »

> Ce runbook PILOTE `07-plan-action-global.yaml` : il dit comment démarrer une
> étape, lancer les batteries, dérouler la boucle de correction, franchir les
> gates et consigner. Opérateur : dev/agent sur le serveur (repo
> `/var/www/femiglow`, app `apps/web`). Tous les chemins sont absolus.
> **Règles d'or** : jamais d'E2E contre la prod ; suite existante verte à
> chaque étape ; un gate rouge = boucle §4, jamais de contournement.

## 0. Pré-requis (une fois)

```bash
cd /var/www/femiglow && git status --short        # arbre propre exigé
cd apps/web && pnpm install --frozen-lockfile
# DB d'intégration
createdb femiglow_test 2>/dev/null || true
# Instance E2E (worktree port 8013, SMTP→Mailpit 1025, Listmonk→port mort) :
# cf. docs/emailing/qa-campaign-2026-06 (phase 0) ; restaurer la baseline :
#   dropdb femiglow_emailqa && createdb -O femiglow femiglow_emailqa \
#     && pg_restore -d femiglow_emailqa -j4 /root/femiglow-emailqa-baseline-*.dump
```

## 1. Démarrer une étape (Px.y)

```bash
# 1. Marquer l'étape en_cours dans 07-plan-action-global.yaml (statut local)
# 2. Lire la spec du chantier :
#    technique/fonctionnalites/Fxx/{01-description.md,02-spec-technique.yaml}
# 3. Vérifier que les lignes de batterie du lot sont identifiées :
grep -c '^Fxx-' technique/fonctionnalites/Fxx-*/03-batterie-tests.csv
```

## 2. Lancer les batteries (commandes canoniques)

```bash
cd /var/www/femiglow/apps/web

# Batterie d'un chantier (les noms de tests sont préfixés par l'ID) :
pnpm vitest run -t "F04-"                          # tout F04
pnpm vitest run -t "F04-C-03"                      # un lot précis

# Suite emails GLOBALE (gate G2) :
pnpm vitest run src/components/admin/emails src/app/api/admin/emails \
               src/lib/mail src/lib/admin/emails

# Intégration (DB femiglow_test) :
pnpm vitest run -c vitest.config.ts src/test/integration

# Statique (gate G5) — next build OBLIGATOIRE (violations RSC invisibles sinon) :
pnpm tsc --noEmit && pnpm lint && pnpm next build

# E2E (instance worktree démarrée sur :8013) :
pnpm playwright test e2e/emails-*.spec.ts e2e/admin-emails*.spec.ts \
  --reporter=line,junit

# a11y (gate G6) :
pnpm vitest run -t "A11Y"                          # axe jsdom (socle)
pnpm playwright test e2e/a11y --grep emails        # axe pages

# ── Gates barème relevé G10–G15 (cf. 09-charte-ux-qualite.md) ──
# G10 DESIGN — non-régression visuelle (snapshots 3 viewports) + verrou tokens :
pnpm playwright test e2e/emails-visual.spec.ts                 # couche D (Fxx-D-*)
pnpm vitest run -t "verrous"                                   # cliquets couleur/primitives/combobox
# G11 ASSISTANCE — inventaire à jour + verrou EntityCombobox :
test -s technique/10-inventaire-assistance.csv && echo "inventaire présent"
grep -rEoh "Fxx-D-|Fxx-S-" apps/web/src apps/web/e2e          # couches D/S présentes
# G12 SÉCURITÉ — batterie S + revue du diff de phase :
pnpm vitest run -t "Fxx-S-"                                    # batterie sécurité
#   puis, manuellement : /security-review  (sur le diff de la phase)
# G13 PERFORMANCE — budgets (bundle/DB/p95) :
pnpm next build | grep -E "First Load JS|Route"               # budget bundle
pnpm vitest run -c vitest.config.ts src/test/integration -t "perf|budget|EXPLAIN"
# G14 OBSERVABILITÉ — chaque action d'écriture émet son log (logger espionné) :
pnpm vitest run -t "observabilité|log structuré|\\.action"
# G15 MODULARITÉ — imports croisés + conformité contrats TOTALE :
pnpm vitest run src/test/msw/emails-contracts.conformity.test.ts
```

## 3. Mesurer l'avancement (mécanique, sans déclaratif)

```bash
# Lignes de batterie déclarées vs implémentées (croisement CSV ↔ code) :
for f in technique/fonctionnalites/F0*/03-batterie-tests.csv; do
  ID=$(basename $(dirname "$f") | cut -d- -f1)
  DECL=$(tail -n +2 "$f" | wc -l)
  IMPL=$(grep -rEoh "[\"']$ID-[UCIENADS]+-[0-9]+" ../../../../apps/web/src ../../../../apps/web/e2e 2>/dev/null | sort -u | wc -l)
  echo "$ID : $IMPL / $DECL implémentés"
done
```
(adapter les chemins relatifs selon le cwd — la convention « le nom du test
commence par son ID » rend ce comptage fiable.)

## 4. Boucle de correction (à CHAQUE gate rouge)

```
┌─> 4.1 RUN     pnpm vitest run … --reporter=junit --outputFile=/tmp/junit.xml
│   4.2 TRIAGE  pour chaque échec, classer :
│        BUG_CODE  → écrire/ajuster d'abord le test qui le prouve, puis fixer
│        BUG_TEST  → corriger l'oracle (revue obligatoire : un oracle ne
│                    s'affaiblit jamais sans justification écrite en PR)
│        FLAKY     → quarantaine fixme + entrée journal + correction < 48 h
│        CONTRAT   → mock ≠ prod : corriger le schéma partagé PUIS le test
│                    de conformité PUIS les consommateurs
│   4.3 FIX     un commit par cause racine, ID matrice/batterie dans le message
│   4.4 RE-RUN  ciblé (-t "ID") puis COMPLET (le fix n'a rien cassé ailleurs)
└── 4.5 si même cause racine échoue 2× : STOP, escalade tech lead, étape → bloque
```
Sortie de boucle : 0 rouge + 0 quarantaine non ticketée.

## 5. Franchir un gate de phase (fin de Px)

```bash
# 1. Batterie globale + intégration + statique + E2E + a11y (cf. §2, TOUT)
# 2. Coverage (gates G3/G4) :
pnpm vitest run --coverage src/components/admin/emails
# 3. Scénarios métier de la phase (G8) — liste dans Fxx/04-scenarios-metier.md :
pnpm playwright test --grep "SM-F0[34]"            # ex. phase P2
# 4. Démo de revue d'écran (03-plan-conception §5) : dérouler À LA MAIN un
#    scénario métier sur staging, consigner le verdict.

# 5. REVUES DU BARÈME RELEVÉ (G10–G15) — verdict ÉCRIT obligatoire, archivé au
#    journal §7 (cf. 09-charte-ux-qualite.md). Une revue rouge = gate de phase rouge.
#    5a. DESIGN (G10) : dérouler la checklist 09 §A.7 (espacement/typo/couleur =
#        tokens uniquement ; états vide/chargement/erreur dessinés ;
#        micro-interactions + focus ; responsive 3 breakpoints) ; valider/mettre à
#        jour la baseline des snapshots visuels. Verdict : SIGNÉ.
#    5b. ASSISTANCE (G11) : 10-inventaire-assistance.csv à jour ; 0 champ
#        assistable laissé nu sans justification écrite ; verrou EntityCombobox a décru.
#    5c. SÉCURITÉ (G12) : checklist sécu (authz par endpoint, Zod, caps/bornes,
#        sanitization, anti CSV-injection, frame-ancestors, redaction PII,
#        rate-limit envois, 0 secret) ; lancer /security-review sur le diff de phase.
#    5d. OBSERVABILITÉ (G14) : grep des nouvelles actions d'écriture ; chacune
#        émet logger.info('<domaine>.<action>', {…}) SANS champ `event`, avec
#        correlation-id ; chemins d'erreur tracés. Tests d'émission verts.
#    5e. PERFORMANCE (G13) : budgets par écran (bundle gz, requêtes DB/page, p95
#        route) non dépassés ; EXPLAIN/borne vérifiés en intégration.
#    5f. MODULARITÉ (G15) : 0 import croisé inter-sections ; conformité contrats
#        TOTALE ; maps de domaine exhaustives.

# 6. Journal (§7) + commit + tag :
cd /var/www/femiglow
git add -A && git commit -m "feat(emails-ux): phase Px terminée — gates G1..G15 verts"
git tag emails-ux-phase-Px
```

## 6. Déploiement prod (par phase, après gate)

```bash
# 1. Migrations additives d'abord (02-modele-donnees.md §3), hors CONCURRENTLY :
sudo -u postgres psql -d femiglow -f <migration.sql>     # via le process migrations du repo
# 2. Build + restart (OBLIGATOIRE — chunks périmés sinon) :
cd /var/www/femiglow/apps/web && pnpm build
systemctl restart femiglow.service
# 3. Smoke prod LECTURE SEULE :
curl -sf -o /dev/null -w '%{http_code}\n' -H "Host: femiglow-maroc.com" \
  http://127.0.0.1:8011/admin/emails          # attendu 307 (login)
journalctl -u femiglow.service --since '2 minutes ago' | grep -ci error  # 0 attendu
# 4. Rollback éventuel : revert du commit code + build + restart
#    (les colonnes additives restent, inertes).
```

## 7. Journal d'exécution

> Colonne « Verdict » : consigner — en plus du vert/rouge des tests — le
> **verdict design + assistance** de la phase (G10/G11) et l'issue de la revue
> sécurité (G12, `/security-review`). À chaque fin de phase, archiver la
> checklist design signée (§5.5a) et l'inventaire d'assistance à jour.

| Date | Étape | Opérateur | Batterie (vert/rouge) | Triage (causes) | Verdict (+ design/assistance/sécu) |
|---|---|---|---|---|---|
| 2026-06-21 | P3.4-c (F07 Lot 2) — catalogue variables honnête + insertion au curseur | session (worktree, feat/emails-ux-p0) | **F07-U-104/105/107** (catalogue) + **F07-C-017** (panneau groupé) + **F07-I-112** (cohérence resolver, vraie DB `femiglow_test_phase8` 13/13) ; 2 contrats adaptés (TPL-EDI-002 + insert basique : clé réelle + curseur) ; templates 42/42 + wizard assistance 4/4 ; tsc RC=0 | HONNÊTETÉ G11 : l'ancien panneau proposait `{{lastName}}`/`{{orderTotal}}` INEXISTANTES côté resolver (rendu vide) + `city`/`address` toujours vides → retirées. Le hook `useTokenInsertion` (créé P3.2-c3 dans wizard/) est PROMU dans `common/` (réutilisé F05+F07, G15) — 2 imports mis à jour. | ✅ `template-variables.ts` : catalogue PUR des clés RÉELLES de `buildEmailContext`, groupé (Identité/Commerce/Date/Liens), syntaxe Handlebars `{{cle}}` (≠ merge-tags Listmonk). Panneau éditeur regroupé + **insertion au curseur** (plus en fin) via `useTokenInsertion`. `city`/`address` retirées du resolver (TPL-11, F07-I-112 le prouve). RESTE Lot 2 : autocomplete `{{` (typeahead) + `variablesResolvedMap` (route preview) + customVars Prettify ; puis Lots 3-6 + F07-S/D. Commit à suivre. |
| 2026-06-21 | P3.4-b (F07 Lot 1) — câblage brouillon + dirty-guard dans TemplateEditor | session (worktree, feat/emails-ux-p0) | **F07-C-012..016** (câblage) = 5 ; **2 contrats PRÉSERVÉS** TemplateEditor.test 5/5 + .qa.msw 17/17 (TPL-EDI-001..016) ; hook 11/11 ; tsc RC=0. **F07 Lot 1 = 16/16 (F07-C-001..016)** | Le restore de VERSION (`window.confirm`, TPL-EDI-014/015) est une feature DISTINCTE du restore de DRAFT → NON touché (reste Lot 6). `UnsavedChangesGuard` tire `useRouter` → ajout `vi.mock('next/navigation')` aux 2 suites + `localStorage.clear()` (isolation du brouillon partagé jsdom). | ✅ `useTemplateDraft` câblé : effet debounced sur les 4 champs (suspendu tant que la restauration n'est pas tranchée), purge au save réussi ; **ConfirmDialog de restauration** au montage (Restaurer→applique / Ignorer→`discardDraft`) ; **dirty-guard** `UnsavedChangesGuard` (beforeunload + interception nav in-app) branché sur `isDirty` ; indicateur de fraîcheur du brouillon. **Note sécu reportée** : preview iframe en `sandbox="allow-same-origin"` (vs `""` ailleurs) à durcir dans un lot F07-S. RESTE Lots 2-6 (assistance `{{`/slug/customVars, preview mobile, test-send sécurisé, CodeMirror, diff) + F07-S/F07-D + design G10. Commit à suivre. |
| 2026-06-21 | P3.4-a (F07 Lot 1) — hook useTemplateDraft (brouillon local + restauration) | session (worktree, feat/emails-ux-p0) | **F07-C-001..011** (hook, faux timers + storage injecté) = 11/11 ; tsc RC=0 | F07 = templates « sécurité d'abord ». Modèle DIFFÉRENT des campagnes : brouillon LOCAL (localStorage) — pas de writer serveur (l'éditeur committe par « versions »). Hook pur construit AVANT le câblage (pattern c1→c2). | ✅ `useTemplateDraft` : écriture debounced 1 s (4 champs subject/preheader/htmlSource/customVars), flush immédiat, détection de restauration au montage (existe + FRAIS + `schemaVersion` courant + DIVERGENT du serveur + `savedAt` > `updatedAt` serveur, sinon PURGE), TTL 7 j (purge — pas de PII qui traîne, G12), **autosave SUSPENDU tant que la restauration n'est pas tranchée** (jamais d'écrasement du brouillon proposé), `restoreResolved`/`discardDraft`, tolérance JSON corrompu, storage/now injectables. RESTE P3.4-b : câbler dans `TemplateEditor` (restore ConfirmDialog + dirty-guard `use-dirty-guard` existant) puis Lots 2-6 (assistance, preview, test-send sécurisé, CodeMirror, diff) + F07-S/D. Commit à suivre. |
| 2026-06-21 | P3.3-e GATE sécurité — /security-review + fix CSV-injection (F04-S) | session (worktree, feat/emails-ux-p0) | `/security-review` (sous-agents identification + filtrage adversarial) sur le diff de phase : **1 finding HIGH confirmé conf. 8/10** (CSV-injection), reste PROPRE (SQL paramétré, authz+Zod sur toutes les routes, iframe `sandbox=""`, PII logs ok) ; correctif + **F04-S-001..004** (9 cas) ; non-régression export intégration 12/12 + cockpit lot2 23/23 ; tsc RC=0 | FAILLE RÉELLE (pré-existante P2.2, `csv.ts`) : `csvEscape` ne faisait que le quoting RFC 4180 → une cellule commençant par `= + - @` (TAB/CR) = formule exécutée par Excel/Sheets. Vecteur = endpoint PUBLIC `/api/contact` (`name`/`subject`) → `email_outbox` → export admin → exfil PII / DDE. Tombe pile dans le périmètre P3.3 (« anti CSV-injection » du plan §SÉCURITÉ). | ✅ **G12** : `csvEscape` préfixe `'` toute valeur à déclencheur de formule en tête AVANT le quoting (source unique → les 2 chemins d'export hérités) ; valeurs bénignes inchangées (`@` en milieu, `-` après chiffre). Batterie F04-S (déclencheurs, =HYPERLINK, DDE =cmd, bénin). **Gate P3 sécurité : finding fermé.** RESTE gate de phase : E2E SM-F05-01 (Mailpit) + build complet + baseline visuelle (env dédié). Commit à suivre. |
| 2026-06-21 | P3.3-d détail — ConfirmDialog/toasts + statut orpheline | session (worktree, feat/emails-ux-p0) | **CMP-ACT-001..007** (CampaignActions migré) = +7 ; **2 CLIQUETS DÉCROISSENT** : CampaignActions retiré des whitelists **window.confirm** ET **couleur** ; tsc RC=0 ; **F05 = 97/154** | ORPHELINE : la *prévention* est DÉJÀ acquise et prouvée (R-010 : réservation atomique `WHERE status=draft` + persistance de `listmonkCampaignId` immédiatement après `create`, tests CMP-INT-002 + « R-010 déréserve » + index unique CMP-INT-012) ; le *nettoyage* des listes éphémères orphelines existe (`cleanupOrphanEphemeralLists`) ; la *réconciliation* de statut/métriques existe (`syncCampaignStatuses`). → pas de 4e couche inventée (honnêteté), périmètre P3.3-d recentré sur la confirmation/feedback du détail. | ✅ `CampaignActions` migré sur le socle v2 : `window.confirm` → **2 ConfirmDialog** (Annuler l'envoi / Supprimer, rappel du nom, focus-trap, Échap, busy) ; boutons → primitive `Button` (couleurs via tokens) ; **toasts** succès/erreur via `useOptionalToast` (refresh/pause/resume/cancel) ; suppression conserve le redirect natif (form + `requestSubmit()` depuis le dialog). RESTE P3.3 : **gate de phase** (/security-review diff, E2E SM-F05-01 Mailpit, build complet, baseline visuelle). Commit à suivre. |
| 2026-06-21 | P3.3-b/c sécurité — rate-limit test-send + minimisation PII audit | session (worktree, feat/emails-ux-p0) | **F05-S-009** (rate-limit, vraie-DB) + **F05-S-010/011/012** (maskEmail unit) + **F05-S-013** (audit masqué, vraie-DB) = +5 ; tsc RC=0 ; **F05 = 90/154** | Le test-send envoie un VRAI e-mail + upsert l'adresse comme abonné → 2 risques : (1) canal de spam si abus/session compromise ; (2) PII destinataire en clair dans l'audit (lu largement). | ✅ **G12** : rate-limit per-admin via le primitif partagé `checkRateLimit` (in-memory, cohérent infra single-instance) — `TEST_SEND_RATE_LIMIT={10,60s}` dans campaigns-shared (wizard-actions='use server'→exports async only) ; refus AVANT tout appel Listmonk + warn `campaign_test_send_rate_limited` (G14). **G12/G14** : `maskEmail` (1re lettre + domaine) appliqué au `meta.to` de l'audit `test_sent` (actorId opérateur NON masqué = responsabilité). RESTE P3.3-d (orpheline + ConfirmDialog/toasts détail) puis gate de phase. Commit à suivre. |
| 2026-06-21 | P3.3-a sécurité — sanitization du corps de campagne (F05-S) | session (worktree, feat/emails-ux-p0) | unit **F05-S-001..005** (sanitize-body) = 5 ; intégration vraie-DB **F05-S-006** (finalize) + **F05-S-007/008** (test-send) = 3, sur femiglow_test_m03campagnes (--no-file-parallelism, 54/54 avec la suite finalize) ; non-régression sanitize custom-templates 58/58 (hostile 48 + render 10) ; tsc RC=0 ; **F05 = 85/154** | Le corps libre partait BRUT à Listmonk : test-send (`/api/tx` → VRAIE boîte) ET envoi de masse (`campaigns.create`, content_type=html). Risque XSS/phishing/CSS exécutable. Vérif préalable (TDD) : DOMPurify PRÉSERVE les merge-tags `{{ … }}` (texte ET `href`, car `{` n'est pas un schéma d'URI dangereux) → la sécurité ne casse pas la personnalisation. | ✅ **G12** : `sanitizeCampaignBody` (mode FRAGMENT) réutilise l'UNIQUE sanitizer e-mail durci (DOMPurify R-017 : whitelist tags/attrs, FORBID interactifs/formulaires, scrub CSS `expression()`/`url(javascript:)`/`@import`) — `sanitizeEmailHtml` reçoit une option `wholeDocument` (défaut inchangé → 0 régression). Câblé dans `sendCampaignTest` ET `finalizeCampaign`. Aperçu iframe déjà `sandbox=""` (scripts inertes) → double rempart. RESTE P3.3 : rate-limit test-send (b), minimisation PII audit-log (c), détection/prévention orpheline + ConfirmDialog/toasts détail (d), /security-review + E2E SM-F05-01 (gate de phase). Commit à suivre. |
| 2026-06-21 | P3.2-c4 design wizard (migration socle v2 + responsive) | session (worktree, feat/emails-ux-p0) | **2 CLIQUETS DÉCROISSENT** : CampaignWizard RETIRÉ de la whitelist COULEUR **et** toLocale (verrou vert SANS lui = preuve dure) ; 66 tests fonctionnels PRÉSERVÉS + **CMP-DESIGN-001..003** (garde primitives) ; tsc RC=0 ; **F05 = 77/154** | Migration mécanique section par section, contrats re-vérifiés à chaque lot. Bouton d'envoi emerald→`primary` (stone) pour rester dans la palette socle 4-variantes (pas de 5e variante ad hoc). `Banner` met role=alert/status selon le ton → vérifié non-collision avec les `findByRole('status'/'alert')` métier (test-send/blocage). | ✅ **G10** : couleurs → tokens (`Banner` ×6 : Listmonk/indispo/preview-error/test-feedback/blocage/errorMsg ; `INK.warning` notes borne-haute ; `TONE.success` pastille étape franchie) ; **primitives** `Button` (footer Préc/Suiv/Envoi + test + « Aucun »), `Card` (conteneur), `Input` (nom/sujet/preheader/datetime), `TYPO.sectionTitle` (6 titres) ; **focus** token `FOCUS` sur le textarea ; **responsive** : libellés stepper masqués <sm, récap `grid-cols-1 sm:grid-cols-3`, datetime `sm:w-auto`, grille planif `sm:grid-cols-2` ; `toLocale`→`formatAbsolute` (TZ visible). Checklist §A.7 : items 3/4/5/6 ✅ (item 1 pas-magiques absents ; item 2 titres tokenisés, labels inline = sweep mineur de suite) ; **signature checklist + baseline visuelle 3 viewports = gate de phase P3**. **P3.2 (F05 wizard) BOUCLÉ** → RESTE P3.3 (envoi/test-send/orpheline + `F05-S` sécurité). Commit à suivre. |
| 2026-06-21 | P3.2-c3 assistance wizard (merge-tags + raccourcis datetime) | session (worktree, feat/emails-ux-p0) | nouveaux : cœurs PURS **F05-U-046..049** (merge-tags) + **F05-U-050..054** (shortcuts) = 9 ; unit composants **CMP-ASSIST-D-001..004 / 010..011** = 6 ; wiring **CMP-ASSIST-001..004** = 4 → **+19** ; **contrats PRÉSERVÉS** msw 27/27 + ux4 5/5 + autosave 6/6 ; verrous couleur+focus verts ; tsc RC=0 ; **F05 = 74/154** | HONNÊTETÉ G11 : le push d'audience ne synchronise QUE l'email → `{{ .Subscriber.Name }}` classé `conditional` (« souvent vide pour les audiences »), Email/UnsubscribeURL/MessageURL `always` ; les variables du moteur de templates custom transactionnel (`{{ firstName }}`…) sont volontairement EXCLUES (syntaxe ≠ Listmonk → ne résoudraient pas). Cœurs purs construits AVANT le câblage (pattern c1→c2). | ✅ **merge-tags** : catalogue honnête + `insertToken` pur (curseur/sélection/clamp bornes) ; `MergeTagInserter` (menu a11y `aria-haspopup=menu`, groupe conditionnel averti, fermeture Échap/clic-extérieur, tokens INK) câblé sur **corps + sujet** via `useTokenInsertion` (restaure focus+curseur après re-render contrôlé). **Raccourcis datetime** : `scheduleShortcuts` pur (créneaux STRICTEMENT futurs → garde étape 5) + `ScheduleShortcuts` chips → remplit l'input datetime-local. A11y : `aria-label` sur corps/sujet/datetime (sortis des `<label>` pour héberger l'inserter). Inventaire `10-…csv` : 6 champs wizard passés `fait`. RESTE **P3.2-c4** (design responsive/skeletons/adoption primitives socle). Commit à suivre. |
| 2026-06-21 | P3.2-c2 câblage autosave + reprise (CampaignWizard) | session (worktree, feat/emails-ux-p0) | nouvelles batteries **CMP-AUTO-001..006** (câblage) + **CMP-AUTO-D-001..007** (indicateur) = 13/13 ; **2 contrats PRÉSERVÉS** CampaignWizard.msw 27/27 + ux4 5/5 ; hook 7/7 ; verrous couleur+focus verts ; tsc RC=0 ; **F05 = 55/154** (+13) | Décision d'archi : `updateCampaignDraft` CONSERVÉ comme checkpoint validé au goNext (contrat CMP-MSW-003/012 intact) → autosave AJOUTÉ, pas substitué. Gotcha test : user-event v14 + fake timers se bloquent (5 timeouts) → réécrit en `fireEvent` synchrone + `act`/`advanceTimersByTimeAsync`. Indicateur en `aria-live` SANS role=status/alert (sinon collision avec les `findByRole('status'/'alert')` métier). Mocks des 2 suites complétés avec `saveWizardProgress` (surface honnête, 0 assertion affaiblie). | ✅ **autosave câblé** : effet debounced sur la frappe in-step (patch = état VALIDE, `name`<3 OMIS → jamais d'échec Zod, U-033) ; goNext/goPrev FLUSHENT immédiatement le `wizardStep` atteint (fiabilité reprise) ; optimistic-lock `expectedRev` seedé depuis `initialRev`. **Reprise** : props `initialStep`/`initialRev` alimentées par `/edit` via `normalizeWizardStep(wizard_step)` + `migratePayload(payload)._rev`. **UX/G11/G14** : `AutosaveIndicator` (idle/saving/saved-âge-qui-court/error/conflict, tokens INK, tick 1 s) + **bannière de conflit** socle `Banner` tone=danger (gel + Recharger, jamais d'écrasement). RESTE P3.2-c3 (assistance : merge-tags `{{}}`, typeahead template, raccourcis datetime) + c4 (design responsive/skeletons). Commit à suivre. |
| 2026-06-20 | P3.2-c1 hook useCampaignAutosave | session (worktree, feat/emails-ux-p0) | hook 7/7 (fake timers) ; tsc RC=0 ; **F05 = 42/154** | Aucun blocage. Hook construit AVANT le câblage UI (dé-risque le god-component). | ✅ `use-campaign-autosave.ts` : debounce trailing 2s réarmé par rafale (U-031/032), patchs fusionnés, flush() immédiat, optimistic-lock (rev→expectedRev), conflit FIGE l'autosave (jamais d'écrasement), statut idle→saving→saved/conflict/error + savedAt, saveRef anti-réarmement (gotcha P2.1), timer dégagé au démontage. RESTE **P3.2-c2** : câbler le hook dans CampaignWizard.tsx (820 l.) + reprise wizard_step + Freshness, en préservant CampaignWizard.msw/ux4.test.tsx ; puis c3 assistance, c4 design. Commit c0f1094. |
| 2026-06-20 | P3.2-b saveWizardProgress (writer autosave) | session (worktree, feat/emails-ux-p0) | unit Zod 4/4 + intégration vraie-DB 6/6 (femiglow_test_m03campagnes) ; tsc RC=0 ; **F05 = 40/154** | Gotcha drizzle `.returning()` 0-arité re-confirmé (→ `.returning()` sans args). 1 erreur de test corrigée (name 'N2' < min 3 Zod). Colonnes additives appliquées à m03campagnes (femiglow_test*). | ✅ `saveWizardProgress` : garde R-010 (`WHERE status='draft'` atomique, 0 écriture hors draft — F05-I-002 oracle DB), optimistic-lock multi-onglets via `payload._rev` (expectedRev périmé → conflict sans écrasement), merge non destructif (F05-I-001), patch partiel (U-033), persistance wizard_step/schedule_timezone, observabilité `mail.campaign.autosave[_rejected/_conflict]` (G14). Zod dans campaigns-shared (pur, U-034/035). RESTE **P3.2-c** : refonte UI god-component CampaignWizard.tsx (Wizard socle + autosave câblé + reprise + assistance + design). Commit 5332434. |
| 2026-06-20 | P3.2-a Fondations campagnes (TZ é5 + payload versionné) | session (worktree, feat/emails-ux-p0) | campaign-schedule 8/8 + campaign-payload 5/5 = 13/13 ; tsc RC=0 ; **F05 = 35/154** | Aucun blocage. Conversion TZ via Intl (pas de date-fns-tz dispo) ; oracle DST = round-trip identité (PAS d'offset ramadan codé en dur — dépend de la version tzdata). 1 collision d'IDs batterie évitée : U-036/037 déjà pris (fallback) → payload renuméroté U-041..045. | ✅ `campaign-schedule.ts` (wallClockToUtc/utcToWallClock DST-safe double-passe ; validateSchedule passé/futur/sans-date sur l'instant CONVERTI) F05-U-026..030 ; `campaign-payload.ts` (version + mapping nommé d'étapes + normalizeWizardStep + migratePayload tolérant legacy/idempotent) F05-U-041..045. Fondations PURES (dé-risquent la refonte UI) ; writer saveWizardProgress + Wizard socle + autosave + assistance + design = P3.2-b/c. Commit 1378823. |
| 2026-06-20 | P3.1 Migration data campagnes (F05) | session (worktree, feat/emails-ux-p0) | filet non-régression F05-U-001..025 = 25/25 (isLegalTransition 7×7 + mapListmonkStatus) ; tsc RC=0 ; colonnes vérifiées sur femiglow_test (SELECT) ; **F05 = 25/149** | **GOTCHA migration** : `drizzle-kit generate` a aussi proposé un ALTER `lead_tag.id` text→uuid (schema.ts aligné chantier 1.1, ancien snapshot disait text) — dérive HORS PÉRIMÈTRE, no-op sur la DB réelle (déjà uuid) → OMISE de 0083.sql (snapshot conservé car il reflète la vérité schema.ts). **SÉCU** : DDL direct sur femiglow_emailqa REFUSÉ par le classifier (limite standing « femiglow_test* seul writable directement ») → emailqa recevra la migration via `pnpm db:migrate`, pas du psql ad-hoc. | ✅ colonnes ADDITIVES `email_campaign_link.wizard_step` (smallint) + `schedule_timezone` (text), inertes jusqu'à P3.2 ; migration 0083 idempotente (IF NOT EXISTS) appliquée à femiglow_test ; filet 7×7 posé AVANT refonte (R-010/transitions verrouillés). Payload-versioning (G15) reporté à P3.2 (livré avec le writer du wizard). Commit à suivre. |
| 2026-06-20 | P3.0 Socle design & assistance v2 (a tokens, b primitives, c pilote+revue) | session (worktree, feat/emails-ux-p0) | tsc RC=0 ; ui/socle 110/110 ; suite emails composant 773/773 ; verrous couleur+focus verts (cliquets décroissants) ; `next build` complet NON rejoué (OOM box partagée prod — à lancer au gate de phase P3) | Revue ADVERSARIALE multi-agents (4 lentilles) du socle v2 → 6 findings réels corrigés : Field aria-describedby pendouillant (hint+error → IDREF mort) ; Button attrs écrasables par {...rest} + `transition` nu→MOTION ; Pill/StatusBadge role=status sur chaque badge (spam live-region) → **DIFFÉRÉ C10/P5.3** (pré-existant P1.2, blast 10 tests) ; StatusBadge dupliquait la géométrie de Pill ; input pilote sans FOCUS ; ConfirmDialog/EmptyState/toast sans anneau de focus. Contraste : warning.solid amber-600→amber-800 (AA) préempté avant la revue. | ✅ **G10 design** : `ui/tokens.ts` source unique (TONE subtle/solid, INK, BUTTON, TYPO/SPACE/RADIUS/FOCUS/MOTION) ; Pill & StatusBadge dérivent de toneClass (fin doublons sage/red/blue + nuances ad hoc) ; **6 primitives** Button/IconButton/Field/Card/Skeleton/Banner + Input + barrel `ui/index.ts` ; états DESSINÉS (SkeletonTable). **Verrous** : couleur hors tokens.ts (43→… décroissant, capte aussi -[#/rgb/hsl) + focus unique FOCUS. **Pilote** SuppressionList + ConfirmDialog migrés (sortis de la dette couleur). Couche **D** : `e2e/emails-visual.spec.ts` (3 viewports, opt-in EMAILS_VISUAL=1, baseline en revue de phase). **G11** : inventaire `10-…csv` (verrou EntityCombobox auto-détection jugée trop fragile → piloté par inventaire + tests/champ). Commits c8fcda1 (a) · ce021c7 (b) · 790b22f (c). |
| 2026-06-20 | MERGE master ← feat/emails-ux-p0 + ENRICHISSEMENT barème (charte 09, gates G10–G15) | session (worktree) | Merge FF local `efbf5b5→8e96a53` après validation (tsc ×2 RC=0 ; suite complète 10 873 tests : seuls 2 F03 rouges = oracle d'horloge >24 h corrigé en test-only 8e96a53, + 1 tracking PRÉ-EXISTANT hors périmètre) ; build OOM (box 15 Gi/0 swap, worker orphelin 2 Go) → gate build couvert par compile-OK + tsc×2 + cible identique au build vert P2 | Évaluation multi-agents (7 aires) : le plan G1–G9 NE COUVRE PAS le barème relevé (design haut calibre, autocomplétion partout, sécu/perf/observabilité/modularité explicites) → 6 angles morts convergents | ✅ Charte `09-charte-ux-qualite.md` (tokens uniques, primitives socle, doctrine d'états, responsive, non-régression visuelle couche D ; invariant autocomplétion + inventaire `10-…csv` + verrou EntityCombobox ; 8 dimensions → critères vérifiables) ; **gates G10–G15** ajoutés à `05 §5` + runbook §2/§5/§7/§8 ; plan `07` : étape `P3.0 Socle design & assistance v2` + gates étendus P3–P5 ; notes d'enrichissement par dossier F05/F06/F07/F09/F10. NON POUSSÉ (master ahead origin de 16+). |
| 2026-06-10 | GATE PHASE P2 — E2E F03+F04+F08 (:3100) | session (worktree, feat/emails-ux-p0) | **21/21 × 3 RUNS consécutifs** (emails-dashboard-f03 + emails-cockpit-f04 + emails-audiences-f08, --workers=1 OBLIGATOIRE : oracles santé globaux + panne DB simulée) ; non-régression P1 10/10 (socle+navigation) ; composant 87 fichiers v ; tsc OK ; **F03 = 94/94, F04 = 144/144, F08 = 102/102 — trois batteries à 100 %** | 2 BUGS PROD trouvés par la batterie : (1) le « Réessayer » de error.tsx ne faisait que reset() — pour une erreur RSC le payload en cache se REJOUE indéfiniment, le bouton ne réessayait RIEN (fix : router.refresh() + reset() sous useTransition) ; (2) contraste AA text-stone-400 sur TOUS les écrans audiences (mad-helper, preview-empty, chips vides… — invisible en axe jsdom) → stone-600. 4 leçons d'oracle : le check dlq24h n'expose son deep-link qu'au-delà de 10 (seuil incident → seeds à 12) ; `to:` sans wildcard = égalité exacte (la grammaire du SM est to:*@bad.tld) ; le deep-link suppression du détail ne se rend que sur statut suppressed ; une coupure DB TOTALE tombe sur le boundary GLOBAL (le layout admin lit tracking_settings) → panne CIBLÉE par rename d'email_outbox pour atteindre le boundary du segment (DASH-09). 1 flake éliminée : axe-core > 30 s sur pages denses → setTimeout(90 s) des tests A-* | ✅ specs F03-E-001..005 + A-001/002 (tri-état « webhook muet », fenêtres ?window=, Diagnostiquer→from=health, error boundary + reprise réelle, radiogroup clavier), F04-E-001..006 + A-001/002 (SM-F04-01 astreinte DLQ bout-en-bout 12→0, domaine pourri export CSV daté + 4 suppressions prouvées en DB, enquête cliente timeline→suppression, filtre fautif warning + filtres valides appliqués, vue d'équipe persistée, reap sending figés → pending), F08-E-098/099/100 + A-101/102 (SM-F08-01 chips pays + Inverser les bornes + aperçu 12 exacts + détail FR, SM-F08-02 drift −99 % → re-snapshoter → « = à jour », SM-F08-03 tags grisés + legacy bloquée puis débloquée) ; helpers e2e étendus (events webhook, leads+orders, audiences+snapshots, vues, panne DB ciblée idempotente) ; **TAG emails-ux-phase-P2** |
| 2026-06-10 | P2.4 audiences F08 — tags/validations/drift/membres | session (worktree, feat/emails-ux-p0) | **F08 = 97/102** (restent 3 E2E + 2 axe Playwright = gate de phase) ; intégration vraie-DB : compilateur+lifecycle 93/93 + routes F08 7/7 (femiglow_test_m04audiences, --no-file-parallelism : les 2 suites partagent la DB) ; suites emails 1530 v ; conformité+verrous inclus ; tsc + lint + next build OK | DÉFAUT CRITIQUE AUD-01 FERMÉ aux 3 surfaces dans le même commit (garde-fou §rollback : jamais partiel) — le compilateur émettait ENCORE EXISTS/NOT EXISTS sur lead_tag (not_has_tag = NOT EXISTS sur table M5.5 vide → TOUTE la base) ; 5 oracles d'intégration AMENDÉS en conséquence (AUD-CMP-030/031/033/034 + negation → « personne, jamais tout le monde ») ; axe a attrapé 3 inputs sans label (inactive_since, date scalaire, email_pattern) ; oracle U-025 amendé (productId vide VOLONTAIRE → bloqué étape 2 PRODUCT_EMPTY_ERROR) ; 2 suites intégration sur la même DB se marchaient dessus en parallèle → --no-file-parallelism documenté ; I-094 : 57014 injecté au moteur (timeout réel non-déterministe sur DB minuscule), mapping route RÉEL | ✅ neutralisation tags : tags-flag.ts (TAGS_ENABLED, levée M5.5 un seul flag) + compilateur FALSE/FALSE + warn tag_neutralized + menu câblé au flag + bannière TagEditor + blocage étape 2 + I-095 vraie-DB (snapshot tag size=0) ; validations : rule-validation.ts (validateBetween/swapBounds + « Inverser les bornes » num+date, chips email_pattern in trim/dédup/vide bloquant, bascule pays in→eq sous ConfirmDialog socle, code pays inconnu bloquant, COUNTRY_CALLING_CODE exporté pour l'alignement bidirectionnel U-012) ; drift : drift.ts (driftPct max(1,size), ▲/▼ ±N (±P %), seuil >10 % strict → surlignage + bandeau re-snapshoter, âge relatif, purge JJ/MM) + liveCount RSC passé au panel (1 calcul/page, HORS boucle 4 s) ; membres « Charger plus » (offset=length, concat dédoublonnée, bouton masqué à épuisement, grille réseau + 404 cross-audience I-096) ; étape 4 : mention ET/OU dès 1 règle, textes mode d'évaluation verbatim (N injecté via onSizeChange), timeout preview 57014→504→message ⏱ dédié, hint R-011 détail, suppression ConfirmDialog ; routes audiences passées au 401 JSON (pattern F02) ; CLIQUETS : window.confirm 5→4, toLocale 19→13, tokens 23→14 (9 fichiers audiences migrés emerald/rose/sky + Intl.NumberFormat) |
| 2026-06-10 | P2.3 cockpit F04 lot 2 — sélection globale + bulk-by-filter | session (worktree, feat/emails-ux-p0) | **F04 = 136/144** (restent 6 E2E + 2 axe Playwright = gate de phase) ; intégration bulk 13/13 (femiglow_test_f04bulk, dont I-010 « même ensemble que /search ») ; suites emails 1542 v ; tsc + build OK | 1 BUG de séquence trouvé par I-017 (compte wrong_status APRÈS l'update → les relancées comptées skipped ; compter AVANT) ; 1 adaptation harnais (12 suites montent le cockpit nu → useOptionalToast ajouté au socle pour l'adoption incrémentale, provider réel au layout) ; oracle I-020 aligné (deleteView = SOFT delete) ; ~25 IDs legacy GREFFÉS sur les tests existants (parser U-001..012, vues C-064..069, grilles C-070..072, presets/a11y C-075..079, non-régressions I-018..021 écrites vraie-DB) | ✅ route /bulk-retry-by-filter (dry-count borné, cap 10 000 → 422 cap_exceeded AVANT toute mutation, audit, compilateur unique buildWhere) ; cap partagé client/serveur via schemas.ts ; machine de sélection page-filter COMPLÈTE (amorce ssi total>page, bannière périmètre, survie page/tri, ANNULATION au changement de filtre + toast, rupture d'exhaustivité au décochage, libellés Retry (N)/Export ~N cohérents) ; ConfirmDialog SOCLE adopté pour le dry-count (échec → erreur DANS le dialog) ; parcours opérateur C-073/074 + a11y bannière A-003 |
| 2026-06-10 | P2.2 cockpit F04 lot 1 + export serveur | session (worktree, feat/emails-ux-p0) | F04 = 69/144 (lot 1 complet ; reste lot 2 = P2.3) ; intégration export 12/12 (femiglow_test_f04exp) ; conformité 9/9 ; suites emails 1385 v ; tsc + build OK | 1 gotcha postgres-js RE-CONFIRMÉ (Date crue dans fragment sql → ERR_INVALID_ARG_TYPE, fix .toISOString()::timestamptz — même racine que R-028) ; 1 piège harnais (stubber URL entier casse new URL() pour MSW : greffer SEULEMENT createObjectURL) ; 1 oracle amendé (P0.3 skip → agrégation COMPTÉE « 2 non trouvé · 1 … ») ; cap export : sonde +1 sur le DERNIER paquet (cas remaining==chunkSize couvert) | ✅ route /export STREAMÉE (keyset (created_at,id), cap 100 000 annoncé en X-Export-Capped via count borné AVANT le flux, BOM+RFC4180, audit mail.outbox.export) ; buildWhere EXPORTÉ (compilateur unique, I-010a même ensemble que /search) ; csv.ts source unique client/serveur ; erreurs parser visibles + messages spec §6 ; skip FR complets ; reap précis ; saut de page borné ; bannière ?from=health (fermeture nettoie l'URL) ; tooltips file/5000+ ; timeline pédagogique 📡/⚙ + encart sent stagnant + retour sticky ; CLIQUETS : toLocale 20→19, tokens 24→23 (détail [id] sorti des 2 listes) |
| 2026-06-10 | P2.1 dashboard F03 | session (worktree, feat/emails-ux-p0) | F03 = 86/93 (restent 5 E2E + 2 axe Playwright, gate de fin de phase) ; intégration vraie-DB 11/11 (femiglow_test_f03sum) ; suites emails complètes 1319 v ; conformité 8/8 ; tsc + next build OK | **BUG PROD MAJEUR attrapé par F03-I** : la sparkline du summary fait `GROUP BY bucket` sans alias (drizzle n'aliase pas un fragment sql brut) → 42703, la route summary **500 depuis la vague 4** et le cockpit la dégradait en silence — fix `.as('bucket')` ; 2 BUGS de test-design corrigés en composant : intervalle 60 s désarmé/réarmé à chaque re-render (deps → ref, oracle C-014) ; messages error.tsx (« base de données » interdit DASH-09) ; auth summary 307→401 JSON (pattern F02) ; grep §3 amendé (quotes simples ET doubles) | ✅ contrat summary étendu (30d, sent, webhookLastSuccessAt, comparaison 30d) + getOutboxKpiForWindow ; tri-état deliveredState (table de vérité exhaustive) ; tendances polarisées + Sparkline ; WindowSelector radiogroup (?window= via replace) ; DashboardAutoRefresh (sonde summary AVANT router.refresh → grille réseau N-001..006 honnête, âge jamais menteur) ; HealthBadge deep-links from=health&check=&window=&at= + pied *-800 ; EmptyState socle + formatAbsolute ; CLIQUET toLocale 24→20 (kpi-format, page, DashboardFreshness supprimé, HealthBadge) |
| 2026-06-10 | P1.6 E2E — gate de phase P1 | session (worktree, feat/emails-ux-p0) | E2E 10/10 × 3 RUNS consécutifs (emails-socle + emails-navigation, serveur :3100 prod build sur femiglow_test_e2e — :8013 historique désormais occupé par corolle-tracking) ; composant 557 v ; tsc OK ; build OK | 2 BUGS PROD trouvés par la batterie : contraste AA `text-stone-400` sur texte (SuppressionList détail+note, dashboard astuce ⌘K, SavedViewsSidebar titres, KpiHeader tirets — INVISIBLE en axe jsdom, color-contrast exige un vrai rendu) + ancre `#nouvelle-campagne` inexistante (le redirect /campaigns/new pointait dans le vide) ; 1 outillage (setup login : evaluate vs redirection → waitForLoadState+retry) ; 1 LEÇON exploitation : `fuser -k 3100/tcp` pas `kill $(lsof)` — un restart raté a servi un build périmé (faux rouge) | ✅ F01-E-073/074 + F01-A-078 et F02-E-001..006 implémentés (helpers seedSuppression + axe-e2e) ; F01-E-075/076/077 REPORTÉS avec leurs adoptants (CSV : reporte_p2_dashboard / reporte_p3_wizard / reporte_p2_cockpit) ; F01 = 73/78, F02 = 63/63 COMPLET ; démo de revue d'écran manuelle : à dérouler par l'opérateur (étape humaine §5.4) |
| 2026-06-06 | P1.5 pilote Suppression | session (worktree, feat/emails-ux-p0) | pilote+socle 80/80 ; suite complète 592 v ; CLIQUETS : SuppressionList retirée des 3 listes blanches (1re décroissance) et les verrous passent | 1 BUG_TEST invariant (précision 4s déléguée à C-017, l'invariant adoptant teste l'auto-dismiss réel) ; suite UX4 historique réécrite pour le dialog (intentions préservées + 1 test re-tentative ajouté) | ✅ SuppressionList = 1er adoptant du socle (ConfirmDialog/toast/EmptyState/format-datetime/Intl.NumberFormat) + invariants describe.each armés (F01-C-069/070) |
| 2026-06-06 | P1.4 navigation F02 | session (worktree, feat/emails-ux-p0) | F02 : 52 composant/U/A + 6 intégration vraie-DB (femiglow_test_f02nav) = 57/63 (restent 6 E2E) ; tsc OK ; build en validation | 2 corrections à la spec : champs contrat alignés (automationErrors/listmonkSyncFailed supersèdent l'ébauche P0.2) ; formatBadge(0)→null (oracle U-010) ; 1 outillage : unstable_cache hors runtime Next → fallback incrementalCache documenté | ✅ route nav-counters (401 JSON, TTL 30s+tag, 500 franc) + EmailsTabs (9 onglets, badges dégradation silencieuse, lastKnown, suspension hidden) + breadcrumbs helper + palette (+Suppression,+Runs) + /campaigns/new (lien palette mort réparé) |
| 2026-06-06 | P1.3 socle (lot 3/3) | session (worktree, feat/emails-ux-p0) | Wizard 14/14 (1er passage) ; composant 535 v ; tsc OK ; build OK | aucun | ✅ ui/Wizard partagé (étapes cliquables <= atteintes, Ctrl+flèches, focus titre, alert près de Suivant, persistance sessionStorage) — SOCLE F01 COMPLET côté composants (68/78 lignes ; restent invariants+E2E -> P1.5) |
| 2026-06-06 | P1.2 socle (lot 2/3) | session (worktree, feat/emails-ux-p0) | F01 lots 1+2 : 57/57 ; composant 521 v ; unit 806 v ; tsc OK ; build OK | 3 amendements d'oracle consignés (U-055 supersédé par DASH-07 ; U-067/068 → sémantique CLIQUET avec listes blanches décroissantes : 6 fichiers confirm, 25 toLocale, 25 tokens) | ✅ EmptyState + Freshness + format-datetime + Pill/tones + STATUS_META dédupliqué (KpiCards re-export, F01-U-059 par égalité de référence) + UnsavedChangesGuard |
| 2026-06-06 | P1.1 socle (lot 1/3) | session (worktree, feat/emails-ux-p0) | F01-C-001..028 : 28/28 (TDD rouge→vert) ; composant 492 v ; unit 806 v ; tsc OK ; build OK | 3 BUG_TEST (focus initial Annuler vs Enter — dérogation consignée ; fake timers auto-advance ; oracle d'ordre) ; 1 outillage (delay non ré-exporté par @/test/msw/server → ajouté) ; reste du lot débuggé via le harnais canonique | ✅ ui/ConfirmDialog + ui/toast + ToastProvider monté dans layout |
| 2026-06-06 | P0.1+P0.2 CI & contrats | session (worktree, feat/emails-ux-p0) | conformité 8/8 ; composant 464 v (57 fichiers, shard 2× vérifié 29+28) ; unit 806 v ; tsc OK | 3 CONTRAT (nominaux manquants détectés par la conformité : reap-stuck, suppression GET/DELETE → ajoutés à emailsHandlers) ; 1 outillage (pnpm `--` n'forwarde pas --shard → retiré) | ✅ CI : jobs build-rsc + coverage(rapport) + shard 2× ; wire-schemas.ts (9 contrats dont nav-counters amont) |
| 2026-06-06 | P0.3 quick-wins | session (worktree femiglow-email-tests, feat/emails-ux-p0) | p0-quickwins 9/9 ; emails composants 458 v / 0 r ; lib/mail 663 v ; tsc OK ; next build OK | 1 BUG_TEST (AutomationWizard utilisait has_tag → consent_marketing) ; EVT-05 INVALIDÉ (déjà conforme) ; lint = échec pré-existant master (preload.test.ts, hors périmètre) | ✅ commit 843d521 — 7 fixes + 9 tests régression |

Consigner UNE ligne par session de travail, même intermédiaire. Les
quarantaines flaky ouvertes sont listées en pied de tableau jusqu'à résolution.

## 8. Critères de clôture du programme (P5.4)

**Correction (historique) :**
- [ ] 10 batteries Fxx : 100 % implémentées (comptage §3, couches `[UCIEADS]`) et vertes
- [ ] Suite globale emails verte 3 runs consécutifs (anti-flaky)
- [ ] Tous les scénarios SM-* verts
- [ ] G1..G9 verts simultanément sur le même commit
- [ ] 111 problèmes de la matrice : statut traité/différé justifié ligne à ligne

**Barème relevé (G10–G15, cf. `09-charte-ux-qualite.md`) :**
- [ ] **G10 Design** : checklist `09 §A.7` signée pour CHAQUE écran refondu ;
  baseline de snapshots visuels (3 viewports) verte ; verrou couleur à 0 hors `tokens.ts` ;
  primitives socle (Button/IconButton/Field/Card/Skeleton/Banner) extraites et adoptées.
- [ ] **G11 Assistance** : `10-inventaire-assistance.csv` complet ; 0 champ assistable
  nu non justifié ; verrou `EntityCombobox` à whitelist vide.
- [ ] **G12 Sécurité** : `/security-review` sur le diff global sans finding bloquant ;
  batteries `Fxx-S-*` vertes ; scan secrets propre.
- [ ] **G13 Performance** : budgets par écran (bundle/DB/p95) tenus ; aucun dépassement en CI.
- [ ] **G14 Observabilité** : 100 % des actions d'écriture loguées + corrélées (tests d'émission verts).
- [ ] **G15 Modularité** : 0 import croisé ; conformité contrats TOTALE ; maps exhaustives ; barrel `ui/`.

**Clôture :**
- [ ] G1..G15 verts simultanément sur le même commit
- [ ] Rapport de clôture + tag `emails-ux-1.0` + mémoire projet mise à jour
