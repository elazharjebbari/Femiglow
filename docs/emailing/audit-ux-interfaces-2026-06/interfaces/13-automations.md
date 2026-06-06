# Automations `/admin/emails/automation` — fiche d'audit

**Fichiers** : `app/admin/emails/automation/**`, `components/admin/emails/automation/
{AutomationWizard,StepList,StepEditor,FrequencySettings}.tsx`,
`lib/mail/automation/{runner,event-dispatcher,frequency,orphan-sweep}.ts`,
`lib/admin/emails/automation-{actions,mutations}.ts`
**Rendu** : liste RSC (toutes les automations + 20 derniers runs + compteur
d'erreurs) ; wizard client 4 étapes ; runs filtrables 50/page ; détail de run RSC.
**Verdict** : moteur riche (7 types de steps, branches, fréquence) mais l'UX la
plus en retard — concentre 3 des 8 problèmes critiques de l'audit.

## 1. État actuel — wireframes

**Liste**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Dashboard emails                              [+ Nouvelle automation]     │
│ Automatisations                                                              │
│ ⚠ 3 run(s) en erreur. Filtrez-les pour les relancer. Voir les runs →        │
│ ┌──────────────┬─────────────┬─────────┬────────┬────────────┬───────────┐ │
│ │ Slug         │ Nom         │ Trigger │ Steps  │ État       │           │ │
│ │ welcome-flow │ Bienvenue   │ event   │ 4 steps│ [Active]   │Runs·Éditer│ │
│ │ cart-1h      │ Panier aband│ event   │ 3 steps│ [Active]   │ ·Désactiver│ │
│ │ promo-cron   │ Promo hebdo │ schedule│ 2 steps│[Désactivée]│ ← fantôme  │ │
│ └──────────────┴─────────────┴─────────┴────────┴────────────┴───────────┘ │
│ RUNS RÉCENTS (20)                                                            │
│ │ Déclenché │ Destinataire │ Step │ Statut        │ Proch. action │ Action │ │
│ │ 06/06 14h │ a@x.com      │ 2    │ [En cours]    │ 06/06 15h     │Annuler │ │
│ │ 06/06 13h │ b@y.com      │ 1    │ [En erreur]   │ —             │Relancer│ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Wizard — étape 2 (Étapes) : le point noir**
```
 [1. Identité] [●2. Étapes] [3. Fréquence] [4. Revue]
┌─────────────────────────────────────────────────────────────────────────────┐
│ #1 │ ⏱️ Attendre 60 min                                        │ ↑ ↓ ✕ │    │ ← cartes dépliables
│ #2 │ ✉️ Envoyer email (welcome-j0)                             │ ↑ ↓ ✕ │    │   au clic
│ #3 │ 🔀 Condition (si / sinon)                                 │ ↑ ↓ ✕ │    │
│    │   ┌─ si vrai ──────────────┬─ sinon ─────────────────┐   │       │    │ ← branches = grilles
│    │   │ #3a ✉️ Envoyer (vip)   │ #3b ⏱️ Attendre 1440 min │   │       │    │   imbriquées : illisible
│    │   │ #3c 🏷️ Étiqueter (vip) │                          │   │       │    │   dès 2 niveaux (AUTO-01)
│    │   └────────────────────────┴──────────────────────────┘   │       │    │
│ [+ Ajouter une étape ▾]  (⏱️ Attendre · ✉️ Envoyer email · 🔀 Condition ·   │
│   🏷️ Étiqueter le lead · ✏️ Modifier le lead · 🔗 Appel webhook ·           │
│   ⏳ Attendre un événement)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
Étape 3 Fréquence : cooldown (min) · quiet hours (HH:mm–HH:mm + TZ) ·
  « Plafond d'envois par jour (par destinataire) » ← FAUX : compté PAR AUTOMATION (AUTO-04)
```

**Détail d'un run**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Automations › Runs › 3a4b5c6d…                                               │
│ Run 3a4b5c6d7e8f…       Automation : Bienvenue                               │
│ Statut [En erreur] · Destinataire a@x.com · Déclenché 06/06 14:02            │
│ Erreur : template welcome-j0 introuvable          [Relancer ce run]          │
│ DÉROULÉ DES ÉTAPES                                                            │
│  #1 ⏱️ Attendre 60 min          — fait                                       │
│  #2 ✉️ Envoyer email            — étape courante (amber)                     │
│  #3 🏷️ Étiqueter                — à venir (pointillé)                        │
│ EMAILS ENVOYÉS (1)   outbox 9f8e… [⏺ sent] → a@x.com                         │
│ ▸ Contexte JSON (diagnostic)      ← SEUL outil de debug (AUTO-02)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Gaps UI ↔ moteur (résumé — détail dans `flux-automation.puml`)

| Sujet | UI | Moteur | Problème |
|---|---|---|---|
| Triggers schedule/webhook | sélectionnables (« bientôt ») | ignorés | persistés inactifs, indistinguables (AUTO-05) |
| Daily cap | « par destinataire » | par automation | libellé faux (AUTO-04, critique) |
| Orphan-sweep | invisible | ré-arme/erre les zombies | pas de trace (AUTO-11) |
| Cancel-on-event | aucune UI | cascade codée | non configurable |
| deleteAutomation | jamais câblé | DELETE brut vs FK RESTRICT | R-031 (AUTO-12) |

## 3. Problèmes (cf. matrice)

Critiques : `AUTO-01` pas de vue de flux · `AUTO-02` debug = JSON brut ·
`AUTO-04` daily cap mensonger. Majeurs : `AUTO-03` pas de dry-run · `AUTO-05`
triggers fantômes · `AUTO-06` pas de replay · `AUTO-12` R-031. Mineurs :
`AUTO-07..16` (cf. CSV).

## 4. Améliorations proposées (chantier C5) — wireframes cibles

**a) Vue de flux arborescente (AUTO-01) — V1 read-only, V2 éditable**
```
│ DÉCLENCHEUR : événement « cart_abandoned » + 2 conditions        [Tester ▾] │
│   │                                                                          │
│   ▼                                                                          │
│ ┌ #1 ⏱️ Attendre 1 h ──────────────────────────────────┐ [éditer]           │
│   │                                                                          │
│   ▼                                                                          │
│ ┌ #2 🔀 A ouvert l'email de bienvenue ? ───────────────┐ [éditer]           │
│   ├─ OUI ─────────────────────┐  ├─ NON ──────────────────────┐             │
│   ▼                            │  ▼                             │            │
│ ┌ #2a ✉️ relance-douce ──────┐│ ┌ #2b ✉️ relance-remise ─────┐│             │
│   │                            │  │                             │            │
│   ▼                            ▼  ▼                             ▼            │
│ ┌ #3 🏷️ Étiqueter « relancé » ────────────────────────┐                     │
│   ▼                                                                          │
│  (fin)                                                                       │
```
Implémentation V1 : rendu vertical indenté avec connecteurs CSS (pas de lib
graphe) ; le même composant sert l'étape Revue du wizard et le détail.

**b) Timeline de run instrumentée (AUTO-02)**
```
│ DÉROULÉ                                                                      │
│ ✓ #1 ⏱️ Attendre 1 h         14:02 → 15:02 (60 min)                          │
│ ✓ #2 🔀 Condition            15:02 · évaluée VRAI (email_opened: oui)        │
│ ✗ #3 ✉️ Envoyer relance      15:02 · ERREUR : template introuvable           │
│      payload step ▸  ·  [Relancer depuis cette étape] [Réinitialiser & rejouer]│ ← AUTO-06
│ ⏸ envoi différé 22:40 → 08:00 (quiet hours Africa/Casablanca)                │ ← raisons humanisées inline
│ ⓘ run ré-armé par le sweep le 06/06 03:10 (process interrompu)               │ ← AUTO-11
```
Pré-requis moteur : journaliser par étape `{stepIdx, startedAt, finishedAt,
result, error?}` dans `contextJson._trace` (additif, sans migration).

**c) Dry-run (AUTO-03)**
```
[Tester ▾] → dialog : Contact de test [moi@femiglow.ma ▼]
  (•) Simulation seule (aucun envoi, trace complète)
  ( ) Envoi réel redirigé vers ma boîte
  [Lancer le test] → ouvre le run de test avec la timeline (b)
```

**d) Micro-correctifs** : libellé daily cap « plafond global / jour pour cette
automation » ; badge `[Non opérationnel]` (amber) en liste pour schedule/webhook
— ou retrait des deux options du select ; cadenas sur le slug ; `<optgroup>`
par catégorie d'événement ; phrase dynamique sur onTimeout ; compteur de
résultats près du bouton Filtrer ; **traiter R-031 avant tout bouton Supprimer**
(soft-delete + refus si runs existants).
