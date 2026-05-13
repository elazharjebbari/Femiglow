# 05 — UI/UX & ergonomie

## Principes ergonomiques

### P1 — Progression visible à tout moment
L'admin sait toujours où il en est (étape N/7 en haut) et combien de temps reste (ETA en bas).

### P2 — Décision graduée
On ne demande JAMAIS au premier écran « tu veux reset ? ». On passe par :
1. Lecture (Welcome — contexte)
2. Choix de granularité (Mode)
3. Réglages fins (Custom/Preservation si applicable)
4. Confrontation à l'impact (Preview — voir ce qui disparaît)
5. Confirmation typée (taper le mot exact)
6. Exécution
7. Bilan

### P3 — Coût d'erreur asymétrique
- Annuler = 1 clic, toujours visible en haut à droite.
- Démarrer = action en bas à droite, fond rose, jamais focus par défaut.
- Confirmation = typée (pas cliquable accidentellement).

### P4 — Pas de surprise
Tout ce qui va arriver est annoncé en Preview. Aucune phase silencieuse.

### P5 — Récupération en cas d'erreur
Si reset rate : on voit pourquoi, on a un backup, on peut restore.
Pas de "Erreur. Contactez l'admin" — l'admin EST l'utilisateur.

## Wireframes (ASCII détaillé)

### Step 0 — Welcome

```
╔══════════════════════════════════════════════════════════════════╗
║  Console FemiGlow > Réglages > Reset                              ║
║                                                                   ║
║  ◄ Retour aux réglages                          Étape 1/7         ║
║                                                                   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │                                                           │   ║
║  │   Reset de l'environnement                                │   ║
║  │   ─────────────────────────                               │   ║
║  │                                                           │   ║
║  │   Cet assistant te guide pour ramener la base et les      │   ║
║  │   médias vers un état canonique propre.                   │   ║
║  │                                                           │   ║
║  │   Tu vas successivement :                                 │   ║
║  │   1. Choisir un niveau de reset (soft → hard)             │   ║
║  │   2. Préciser ce que tu veux conserver                    │   ║
║  │   3. Voir l'impact exact AVANT toute action               │   ║
║  │   4. Confirmer par texte                                  │   ║
║  │   5. Suivre l'exécution en direct                         │   ║
║  │                                                           │   ║
║  │   Tout reset crée un backup local. Tu pourras toujours   │   ║
║  │   revenir en arrière via "Restaurer un backup".          │   ║
║  │                                                           │   ║
║  │   Dernier reset : jamais                                  │   ║
║  │   Backups disponibles : 0                                 │   ║
║  │   Espace disque libre : 12.3 GB ✅                         │   ║
║  │                                                           │   ║
║  │                                                           │   ║
║  │                              [ Continuer → ]              │   ║
║  └───────────────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════╝
```

### Step 1 — Mode

```
╔══════════════════════════════════════════════════════════════════╗
║  ◄ Retour                                       Étape 2/7         ║
║                                                                   ║
║  Quel niveau de reset ?                                           ║
║                                                                   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ● SOFT                              (recommandé · ~10 s) │   ║
║  │    Re-run des 16 seeders (upsert). Pas de destructif.     │   ║
║  │    Idéal pour : corriger une donnée stale.                │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ○ MEDIUM                                       (~30 s)   │   ║
║  │    TRUNCATE catalogue + CMS + SEO, puis re-seed.          │   ║
║  │    Préserve médias, users, orders.                        │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ○ HARD                                         (~90 s)   │   ║
║  │    DROP SCHEMA, wipe médias, rebuild from migrations.     │   ║
║  │    Préserve uniquement admin_users + audit_events.        │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ○ CUSTOM                                                  │   ║
║  │    Choisir domaine par domaine.                           │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║                                          [ Annuler ] [ Suivant → ]║
╚══════════════════════════════════════════════════════════════════╝
```

### Step 2 — Custom options (seulement si mode=custom)

```
╔══════════════════════════════════════════════════════════════════╗
║  ◄ Retour                                       Étape 3/7         ║
║                                                                   ║
║  Choisis les domaines à reset (TRUNCATE puis re-seed) :           ║
║                                                                   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ☑ Commerce                                                │   ║
║  │    products, product_variants, form_config,                │   ║
║  │    delivery_cities                                         │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ☐ Content                                                 │   ║
║  │    site_components, media, seo_*, ritual_testimonials      │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ☐ Tracking                                                │   ║
║  │    tracking_*, experiments, insights_*                     │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ☐ Chat                                                    │   ║
║  │    chat_*, chat_lead, chat_session                         │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  ☐ Wipe médias (.media-storage)                            │   ║
║  └───────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║                                          [ Annuler ] [ Suivant → ]║
╚══════════════════════════════════════════════════════════════════╝
```

### Step 3 — Préservation

```
╔══════════════════════════════════════════════════════════════════╗
║  ◄ Retour                                       Étape 4/7         ║
║                                                                   ║
║  Que veux-tu PRÉSERVER (jamais supprimé) ?                        ║
║                                                                   ║
║  ☑ admin_users         · 1 ligne   · TOUJOURS préservé           ║
║  ☑ audit_events        · 47 lignes · TOUJOURS préservé           ║
║                                                                   ║
║  ── Données utilisateurs ─────────────────────────────────       ║
║  ☑ orders              · 0 lignes                                 ║
║  ☑ order_items         · 0 lignes                                 ║
║  ☑ leads               · 0 lignes                                 ║
║  ☑ lead_events         · 0 lignes                                 ║
║  ☑ chat_lead           · 0 lignes                                 ║
║  ☑ ritual_testimonials · 0 lignes                                 ║
║                                                                   ║
║   ⓘ Tout est préservé par défaut. Décoche pour wiper.            ║
║                                                                   ║
║                                          [ Annuler ] [ Suivant → ]║
╚══════════════════════════════════════════════════════════════════╝
```

### Step 4 — Preview (impact)

```
╔══════════════════════════════════════════════════════════════════╗
║  ◄ Retour                                       Étape 5/7         ║
║                                                                   ║
║  Récapitulatif AVANT exécution                                    ║
║                                                                   ║
║  Mode : HARD                                                      ║
║  Backup : automatique                                             ║
║  ETA total : ~ 1 min 30 s                                         ║
║  Disque libre après backup : ~ 11.7 GB                            ║
║                                                                   ║
║  ┌──────────────────────────────────────────────────────────┐    ║
║  │ Table                  Avant   Après     Δ        Action │    ║
║  ├──────────────────────────────────────────────────────────┤    ║
║  │ products                  1     1       =       seed     │    ║
║  │ product_variants          2     1      -1       DROP+seed│    ║
║  │ media                    48    48       =       conservé │    ║
║  │ delivery_cities         430   430       =       seed     │    ║
║  │ ritual_testimonials      52    52       =       préservé │    ║
║  │ orders                    0     0       =       préservé │    ║
║  │ admin_users               1     1       =       préservé │    ║
║  └──────────────────────────────────────────────────────────┘    ║
║                                                                   ║
║  Phases : preflight → backup → audit → wipe-db → wipe-media →     ║
║           migrate → seed → verify → cleanup                       ║
║                                                                   ║
║                                          [ Annuler ] [ Suivant → ]║
╚══════════════════════════════════════════════════════════════════╝
```

### Step 5 — Confirm

```
╔══════════════════════════════════════════════════════════════════╗
║  ◄ Retour                                       Étape 6/7         ║
║                                                                   ║
║  ⚠ Action irréversible (mais avec backup)                          ║
║                                                                   ║
║  Tu vas :                                                         ║
║  · DROPPER 27 tables                                              ║
║  · WIPER 596 médias (704 MB)                                      ║
║  · RECRÉER tout depuis seeds                                       ║
║                                                                   ║
║  Tape exactement HARD RESET pour confirmer :                      ║
║  ┌──────────────────────────────────────────┐                    ║
║  │ HARD RESET█                              │  ✅ correspond     ║
║  └──────────────────────────────────────────┘                    ║
║                                                                   ║
║                                                                   ║
║                                  [ Annuler ] [ Démarrer le reset ]║
║                                              ↑ bouton rose foncé  ║
╚══════════════════════════════════════════════════════════════════╝
```

### Step 6 — Execute (live)

```
╔══════════════════════════════════════════════════════════════════╗
║                                                Étape 7/7         ║
║                                                                  ║
║  Reset en cours…                                                 ║
║                                                                  ║
║  Phase 4 / 10 · Wipe média                                       ║
║  ████████████████████░░░░░░░░  72 %       ETA 18 s               ║
║                                                                  ║
║  ✅ Preflight                                       1.2 s         ║
║  ✅ Backup           bkp_2026-05-13T…             14.8 s         ║
║  ✅ Audit counts                                    0.4 s         ║
║  ✅ Wipe DB                                         3.1 s         ║
║  ▶  Wipe média                                  en cours…         ║
║     Migrate                                       (~ 4 s)         ║
║     Seed (16 seeders)                            (~ 60 s)         ║
║     Verify                                        (~ 5 s)         ║
║     Cleanup                                       (~ 1 s)         ║
║                                                                  ║
║  ▾ Logs détaillés                                                ║
║  ┌──────────────────────────────────────────────────────────┐    ║
║  │ 08:15:23.117  INFO  backup  pg_dump start                 │    ║
║  │ 08:15:38.029  INFO  backup  pg_dump 47 MB                 │    ║
║  │ 08:15:38.045  INFO  backup  tar media start              │    ║
║  │ ...                                                       │    ║
║  └──────────────────────────────────────────────────────────┘    ║
║                                                                  ║
║                                          [ Annuler le reset ]    ║
╚══════════════════════════════════════════════════════════════════╝
```

### Step 7 — Report

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  ✅ Reset terminé en 1 m 32 s                                      ║
║                                                                   ║
║  Backup créé    bkp_2026-05-13T08-15-22-345Z                     ║
║                 /var/backups/femiglow/…  (158 MB)                ║
║                 [ Télécharger ]  [ Restaurer cet état ]          ║
║                                                                   ║
║  Tables         27 dropped + 27 recreated                        ║
║  Médias         596 wipés, 48 seedés                              ║
║  Seeders        16 / 16 ✅                                         ║
║                                                                   ║
║  Vérifications post-reset :                                       ║
║  ✅ /kit accessible (HTTP 200)                                    ║
║  ✅ Prix FEMI-KIT-100 = 199 dh                                    ║
║  ✅ Image hero présente                                           ║
║  ✅ 7 cartes /admin/settings rendues                              ║
║  ⚠ 1 média orphelin détecté (non bloquant)                        ║
║                                                                   ║
║  → Voir les 11 entrées audit_events                               ║
║                                                                   ║
║                            [ Faire un autre reset ]  [ Fermer ]   ║
╚══════════════════════════════════════════════════════════════════╝
```

### Cas d'erreur — Step Execute avec rollback

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  ❌ Reset échoué : phase Migrate                                   ║
║                                                                   ║
║  Erreur : ECONNREFUSED postgres on 5432                          ║
║  Code   : DB_CONNECTION_LOST                                      ║
║                                                                   ║
║  🔄 Rollback automatique en cours depuis bkp_2026-05-13T…         ║
║  ████████████████░░░░░░░░  60 %                                  ║
║                                                                   ║
║  ✅ Preflight, Backup, Audit counts                                ║
║  ✅ Wipe DB, Wipe média                                            ║
║  ❌ Migrate                                                        ║
║  ▶  Rollback (restore from backup)                                ║
║                                                                   ║
║  ── Diagnostic ─────────────────────────────────────────         ║
║  · service postgres : à vérifier (systemctl status)              ║
║  · backup : intact (sha256 validé)                               ║
║  · restore command : pnpm reset restore --backup-id=bkp_…        ║
║                                                                   ║
║                                                  [ Fermer ]       ║
╚══════════════════════════════════════════════════════════════════╝
```

## Micro-interactions

| Élément              | État        | Animation                                            |
|----------------------|-------------|------------------------------------------------------|
| ModeCard             | hover       | border-stone-400, élévation légère                   |
| ModeCard             | selected    | ring-2 ring-stone-900, sans flash                    |
| ImpactTable row      | "wipe"      | text-rose-700                                        |
| ImpactTable row      | "préservé"  | text-stone-500                                       |
| TypedConfirmInput    | match       | ✅ icon green inline, no toast                       |
| Démarrer button      | disabled    | bg-stone-300, cursor-not-allowed                     |
| Démarrer button      | enabled     | bg-rose-700, hover:bg-rose-800                       |
| PhaseProgress bar    | running     | bg-stone-900, transition-width 200ms                 |
| PhaseProgress bar    | success     | bg-emerald-600                                       |
| PhaseProgress bar    | error       | bg-rose-700                                          |
| LogStream            | new line    | fade-in 100ms, auto-scroll si en bas                 |

Reduced-motion : animations désactivées via `motion-safe:` Tailwind.

## Anti-patterns à éviter

- ❌ Modal "Are you sure?" sans contexte : on a déjà la confirmation typée.
- ❌ Spinners infinis sans ETA : toujours fournir ETA ou phase.
- ❌ Toaster pour les erreurs critiques : trop éphémère ; on garde la bannière inline.
- ❌ "Demain" ou "tout à l'heure" dans les dates : utiliser ISO + relatif (« il y a 2 h »).
- ❌ Bouton "Continuer" en gros rouge : red = erreur, pas action.
- ❌ Désactivation silencieuse d'option : toujours dire pourquoi (tooltip).

## Tests d'ergonomie (manuels)

1. **Test du panique** — fermer l'onglet pendant phase Wipe : au retour, le job doit
   continuer côté serveur ; rouvrir /admin/settings/reset doit montrer "Reset en cours".
2. **Test du clavier** — parcourir l'intégralité du wizard sans souris.
3. **Test du néophyte** — montrer à quelqu'un qui n'a jamais utilisé : doit comprendre
   les différences entre modes en < 30 s.
4. **Test du distrait** — tenter de cliquer Démarrer sans rien sélectionner : doit
   bloquer avec feedback clair, pas silencieux.
