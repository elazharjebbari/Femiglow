# Audiences `/admin/emails/audiences` — fiche d'audit

**Fichiers** : `app/admin/emails/audiences/**`, `components/admin/emails/audiences/
{AudienceWizard,AudienceRulesBuilder,RuleEditor,AudiencePreview,SnapshotsPanel,
ExclusionFlagsFieldset,CountryMultiSelect}.tsx`, `lib/mail/audiences/
{rules-compiler,preview,snapshot}.ts`
**DSL** : 15 types de règles (email_pattern, country, consent_marketing,
created_at, order_count, order_total, has_ordered_product, last_order_at,
email_opened, email_clicked, received_without_open, inactive_since,
session_count, has_tag, not_has_tag) ; groupes ET/OU récursifs ; 4 flags
d'exclusion. Preview debounce 800 ms / timeout 5 s ; snapshots idempotents
avec reaper 30 min.
**Verdict** : avec le cockpit, la meilleure interface de la section.

## 1. État actuel — wireframes

**Wizard étape 2 (cœur de l'interface)**
```
 [1 Métadonnées] [●2 Critères] [3 Récap]
┌─────────────────────────────────────────────────────────────────────────────┐
│ Combinateur : (•ET (toutes)) ( OU (au moins une))   ← visible si ≥2 règles  │
│ ┌─ NOMBRE DE COMMANDES ────────────────────────────────────────────[✕]─┐    │
│ │ [≥ ▼] [2]  depuis le [2026-01-01]                                     │    │
│ └────────────────────────────────────────────────────────────────────────┘    │
│ ┌─ A OUVERT UN EMAIL ──────────────────────────────────────────────[✕]─┐    │
│ │ dans les derniers [30d]  au moins [1] fois  template [welcome… ▼]     │    │
│ └────────────────────────────────────────────────────────────────────────┘    │
│ ┌╌ GROUPE OU ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐    │
│ ┆  PAYS [parmi ▼] [🇲🇦 MA ✕] [🇫🇷 FR ✕] [+ pays…]                      ┆    │
│ ┆  TOTAL COMMANDES [entre ▼] [100] et [500] MAD                          ┆    │
│ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘    │
│ [+ Ajouter un critère ▾]  [+ Ajouter un groupe OU]                           │
│ ┌─ EXCLUSIONS AUTOMATIQUES ────────────────────────────────────────────┐    │
│ │ [x] Bounces permanents  [x] Désinscrits  [x] Suppression manuelle    │    │
│ │ [x] Opt-out marketing   (impact expliqué sous chaque case)           │    │
│ └────────────────────────────────────────────────────────────────────────┘    │
│ ┌─ APERÇU ──────────────────────────────────────────────── [↻ Rafraîchir]┐  │
│ │ 🎯 1 234 contacts                                                       │  │
│ │ ▾ Détailler ciblés / exclus / envoyables                                │  │
│ │   1 400 ciblés − 166 exclus = 1 234 envoyables                          │  │
│ │ ▾ Voir 10 exemples (emails + noms)                                      │  │
│ └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Détail** : entête (🎯 nom, slug, « N contacts envoyables », boutons Modifier /
+ Snapshot maintenant / Supprimer) ; 2 colonnes Critères (restitution FR
indentée) | Exclusions (✓/○) ; SnapshotsPanel (Date/Taille/Statut/Actions,
auto-refresh 4 s pendant `running`, membres 50 premiers, export CSV, Relancer
si errored). Confirmation de snapshot = **dialog custom** affichant la taille
calculée (le seul vrai dialog de la section — modèle pour TRV-01).

## 2. Points forts

- Restitution lisible des règles en FR sur la page détail.
- Exclusions pédagogiques (impact expliqué par flag).
- Preview triple (taille / échantillon / breakdown) + erreur avec Réessayer.
- Slug immuable, modes d'évaluation explicites en step 3.

## 3. Problèmes (cf. matrice)

`AUD-01` **has_tag/not_has_tag trompeurs (critique — aggravé à la
contre-vérification technique F08 : le compilateur génère de vrais
EXISTS/NOT EXISTS sur `lead_tag`, table quasi vide avec drift uuid → `has_tag`
cible ~0 contact, `not_has_tag` cible TOUTE la base, sans signal UI)** ·
`AUD-02` « entre » sans validation lo≤hi ·
`AUD-03` drift snapshot/live invisible · `AUD-04` dynamic/static
sous-documenté · `AUD-05` bascule pays perd des données · `AUD-06` membres
limités à 50 · `AUD-07` codes pays inconnus enregistrables · `AUD-08` ET/OU
invisible à 1 règle · `AUD-09` « in » = CSV texte · `AUD-13` timeout preview
silencieux · + `AUD-10/11/12` (cf. CSV). Note : la règle `country` est dérivée
du préfixe E.164 du téléphone (R-011) — un lead sans téléphone n'est jamais
ciblé par pays, sans avertissement.

## 4. Améliorations proposées (chantier C7) — wireframes cibles

**a) Règles tag neutralisées (AUD-01)**
```
[+ Ajouter un critère ▾]
   …
   Possède le tag        (bientôt — M5.5)   ← grisé, non sélectionnable
   Ne possède pas le tag (bientôt — M5.5)
— et pour les audiences EXISTANTES portant déjà une règle tag :
┌─ POSSÈDE LE TAG ────────────────────────────────────────────────[✕]─┐
│ ⛔ Critère inactif : le moteur de tags (M5.5) n'est pas livré.        │
│    Cette règle ne cible actuellement AUCUN contact.                   │
└────────────────────────────────────────────────────────────────────────┘
```

**b) Drift & staleness des snapshots (AUD-03/11)**
```
│ SNAPSHOTS (3)                                                                │
│ │ 04/06 10:12 · il y a 2 j │ 1 100 │ [Terminé] │ live : 1 234 (▲ +134, +12 %)│
│ │                          │       │           │ purge auto le 02/09         │
│ │ ⚠ écart >10 % avec l'audience live — [re-snapshoter]                       │
```

**c) Validation « entre » (AUD-02) + pays (AUD-05/07)**
```
│ TOTAL COMMANDES [entre ▼] [500] et [100] MAD                                 │
│ ⚠ la borne basse doit être ≤ la borne haute — [inverser les bornes]          │
│ PAYS : bascule « parmi → égal » avec 5 pays sélectionnés                     │
│ ConfirmDialog : « Ne conserver que 🇲🇦 Maroc ? Les 4 autres seront retirés. »│
│ Code inconnu « XX » → erreur bloquante à la validation de l'étape.           │
```

**d) Mode d'évaluation documenté (AUD-04) — étape 3**
```
│ (•) Re-évaluer au moment de l'envoi (recommandé)                             │
│     Les contacts qui rempliront les critères au moment du send seront        │
│     inclus, même s'ils n'existent pas encore aujourd'hui.                    │
│ ( ) Figer la liste maintenant (snapshot statique)                            │
│     Seuls les 1 234 contacts actuels recevront — reproductible (A/B,         │
│     conformité), mais ignore les nouveaux inscrits.                          │
```

**e) Micro-correctifs** : mention « toutes les conditions (ET) » dès la 1re
règle ; chips pour `in` (email_pattern) ; « Charger plus » sur les membres ;
message dédié au timeout (« requête trop lourde — simplifiez ou snapshotez ») ;
hint R-011 sur la règle pays (« ciblage par préfixe téléphonique — les leads
sans téléphone ne matchent pas »).
