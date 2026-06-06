# Campagnes `/admin/emails/campaigns` — fiche d'audit

**Fichiers** : `app/admin/emails/campaigns/**`, `components/admin/emails/wizard/
CampaignWizard.tsx`, `lib/admin/emails/wizard-actions.ts` (server actions),
`lib/mail/campaigns/listmonk-{status-sync,sync}.ts`
**Rendu** : liste RSC (filtres URL `q/status/page`, 20/page) ; détail RSC ;
wizard client 6 étapes (brouillon persisté à chaque transition d'étape).
**Particularité** : pas de route `/new` — création par formulaire inline en
entête de liste → redirect `/edit`.

## 1. État actuel — wireframes

**Liste**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Dashboard emails                       Nouvelle campagne                  │
│ Campagnes                                [Nom interne________] [+ Créer]    │
│ 42 campagnes                                                                 │
│ Recherche [Nom ou sujet…]   Statut [Tous les statuts ▼]                     │
│ ┌──────────────┬──────────────┬────────────┬───────────┬───────┬─────────┐ │
│ │ Nom          │ Sujet        │ Statut     │ Audience  │ Date  │ Actions │ │
│ │ Été 2026     │ Découvre no… │ [Envoyée]  │ 1 liste   │ 06/01 │ Voir ·  │ │
│ │              │              │            │           │       │ Dupliquer│ │
│ │ Prtps test   │ Rituel du m… │ [Brouillon]│ Audience  │ 06/02 │Continuer│ │
│ └──────────────┴──────────────┴────────────┴───────────┴───────┴─────────┘ │
│ ← Précédent              Page 1/3                          Suivant →        │
└─────────────────────────────────────────────────────────────────────────────┘
Badges : Brouillon(stone) Planifiée(blue) En cours d'envoi(amber) En pause(amber)
         Envoyée(emerald) Annulée(rose) Échec(rose foncé)
```

**Détail**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Campagnes                                    [⧉ Dupliquer]  [Envoyée]     │
│ Été 2026                                                                     │
│ ┌── MÉTADONNÉES ─────────────────┬── MÉTRIQUES ───────────────────────────┐ │
│ │ Sujet      Découvre nos rituels│  Envoyés 2 345   Livrés  n/d ←──────┐  │ │
│ │ Preheader  Une sélection…      │  Ouvert.   567   Clics    89        │  │ │
│ │ Camp. Listmonk  #777 ↗         │  Bounces     5   Désabos n/d ←──────┤  │ │
│ │ Audience   🎯 Été 2026         │  « Non alimenté par le sync actuel »│  │ │
│ │ Snapshot   3a4b5c6d…           │  Dernière synchro : 6 juin 10:45 ←──┘  │ │
│ │ Planifié   envoi immédiat      │  (retombe sur updatedAt — LMK-02)      │ │
│ └────────────────────────────────┴────────────────────────────────────────┘ │
│ [↻ Rafraîchir les métriques] [⏸ Mettre en pause] [⛔ Annuler l'envoi]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Wizard (6 étapes) — étape 6 montrée**
```
 (✓)──(✓)──(✓)──(✓)──(✓)──(●)      Nom·Audience·Contenu·Sujet·Planif.·Vérif.
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. Vérification finale                                                       │
│  Nom: Été 2026 · Audience: 🎯 Été 2026 (~1 234) · Template: #12 · Sujet: …  │
│ ┌─ Aperçu corps (iframe h-64) ──────────────────────────────────────────┐   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│ ┌─ Envoyer un test ─────────────────────────────────────────────────────┐   │
│ │ (Requiert un template Listmonk.)  [email_____▼] [Envoyer le test]     │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│ ⏳ Estimation des destinataires en cours… l'envoi est bloqué tant que le    │ ← CAMP-01 : deadlock
│    nombre n'est pas connu.                                                   │   si l'API reste down
│ [x] Je confirme l'envoi à ~1 234 destinataire(s) après relecture…           │
│ [← Précédent]                                  [📨 Envoyer maintenant]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Flux & états

- Création → draft → wizard (validations par étape, erreurs `role="alert"`) →
  finalize → POST Listmonk (transition atomique R-010) → scheduled|sending →
  sync par poll. Cf. `diagrammes/cycle-vie-campagne.puml`.
- Estimation audience FemiGlow : fetch async à la sélection ; erreur → alerte
  + « Réessayer » ; **l'envoi reste bloqué tant que l'estimation est inconnue**.
- Confirmations destructives : `window.confirm` (annuler, supprimer brouillon).

## 3. Problèmes (cf. matrice)

`CAMP-01` deadlock estimation (critique) · `CAMP-02` n/d sans explication ·
`CAMP-03` pas d'autosave/reprise étape · `CAMP-04` test send exige template ·
`CAMP-05` stepper non cliquable · `CAMP-06` duplication reset planification ·
`CAMP-07` datetime sans TZ · `CAMP-15` campagne orpheline · `CAMP-08` pas de
/new · `CAMP-09..16` (cf. CSV) · spec non implémentée : A/B (CAMP-13),
raccourcis clavier (CAMP-14).

## 4. Améliorations proposées (chantier C4) — wireframes cibles

**a) Étape 6 résiliente (CAMP-01/04)**
```
│ ⚠ Impossible d'estimer l'audience (3 tentatives).                           │
│   [Réessayer]   [Envoyer sans estimation…]                                  │
│      └─> ConfirmDialog : « Vous allez envoyer SANS connaître le volume.     │
│           L'audience sera évaluée au moment du send. Taper ENVOYER : ___ »  │
│ ┌─ Envoyer un test ────────────────────────────────────────────────────┐    │
│ │ Sans template : l'épreuve part par le pipeline transactionnel interne│    │ ← CAMP-04
│ │ [moi@femiglow.ma ▼] [Envoyer le test]                                │    │
│ └───────────────────────────────────────────────────────────────────────┘    │
```

**b) Wizard avec autosave + navigation libre (CAMP-03/05, via <Wizard> C1)**
```
 (✓)──(✓)──(●)──( )──( )──( )     ✓ Brouillon enregistré il y a 2 s
  └clic┘ étapes validées cliquables ; reprise à l'étape 3 après F5/retour
```

**c) Planification avec timezone (CAMP-07)**
```
│ (•) Planifier   [06/06/2026 18:30]  heure de Casablanca (UTC+1)             │
│     ⓘ vos destinataires recevront l'email à 18:30 heure locale Maroc        │
```

**d) Métriques honnêtes (CAMP-02) + campagne orpheline (CAMP-15)**
```
│ Livrés   n/d ⓘ ── tooltip : « Non couvert par le poll Listmonk.            │
│                    Suivi possible via webhook bounce (chantier R-013). »    │
│ ⚠ Cette campagne est en « envoi » sans référence Listmonk (création         │
│   interrompue). [Marquer en échec] [Ré-associer (id Listmonk : ___)]        │
```

**e) Micro-correctifs** : toast post-duplication « planification réinitialisée —
[la conserver] » ; chips des listes sélectionnées à l'étape 2 ; « échec —
réessayer » à la place de « … » ; spinner sur Rafraîchir + toast « métriques à
jour » ; warning async d'unicité du nom ; route `/campaigns/new` (redirect).
