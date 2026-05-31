# 50.3 — Wireframes GTM Editor

## Vue d'ensemble — `/admin/tracking/gtm`

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Console FemiGlow > Tracking > GTM Config                                ║
║                                                                          ║
║  ┌─ KPIs ───────────────────────────────────────────────────────────┐   ║
║  │  Version active: v3 — Mai 2026                                   │   ║
║  │  Dernière activation: il y a 2 j par Sara                        │   ║
║  │  Pixels enabled: Meta · GA4 · Google Ads · GTM                   │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║                                              [+ Nouvelle version]       ║
║                                                                          ║
║  Versions enregistrées                                                   ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Version                  Active   Créée par     Actions          │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ v3 — Mai 2026        ●  ACTIVE   Sara · 2 j    [Voir] [Exporter]│   ║
║  │ v2 — BF 2026                     Mike · 6 m    [Voir] [Modifier] [Activer] [⋮]│   ║
║  │ v1 — initial                     Sara · 1 a    [Voir] [Modifier] [Activer] [⋮]│   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Wizard "Nouvelle version" — Step 1 Source

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Nouvelle version GTM                                Étape 1/8           ║
║                                                                          ║
║  À partir de quoi ?                                                      ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  ● ⚡ Providers actuels                          (recommandé)     │   ║
║  │      Pré-rempli depuis /admin/tracking/pixels                     │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  ○ 📋 Version existante (clone)                                   │   ║
║  │      Sélectionne une version précédente comme base                │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  ○ 📁 Template prédéfini                                          │   ║
║  │      Minimal · GA-only · GA+Meta · Full                           │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  ○ ▢ Vide                                                          │   ║
║  │      Tout à zéro, je remplis manuellement                         │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║                                            [ Annuler ] [ Continuer → ]  ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Wizard "Nouvelle version" — Step 3 Production (avec SyncIndicator)

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Nouvelle version GTM · Production                   Étape 3/8           ║
║                                                                          ║
║  Configure les pixels pour l'environnement production.                   ║
║  Indicateurs : ✅ aligné avec Providers · ⚠ divergence · ✏ override     ║
║                                                                          ║
║  ┌─ Meta ───────────────────────────────────────────────────────────┐   ║
║  │  Meta Pixel ID        [ 2179682406197934               ]  ✅     │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌─ Google ─────────────────────────────────────────────────────────┐   ║
║  │  GA4 Measurement ID   [ G-5VHP17SDZM                   ]  ✅     │   ║
║  │  GAds Customer ID     [ 7082602195                     ]  ✅     │   ║
║  │  GAds Conv labels                                                 │   ║
║  │   • Purchase          [ AbCdEf123Abc                   ]  ✅     │   ║
║  │   • Lead              [ XyZ789xyZ123                   ]  ✅     │   ║
║  │   • Contact           [ PqR456pqR123                   ]  ✏      │   ║
║  │   • Sign up           [                                ]  —     │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌─ Autres ─────────────────────────────────────────────────────────┐   ║
║  │  TikTok Pixel ID      [                                ]  —     │   ║
║  │  Snap Pixel ID        [                                ]  —     │   ║
║  │  Pinterest Tag ID     [                                ]  —     │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  [Re-sync depuis Providers]              [ ← Retour ] [ Suivant → ]    ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Wizard "Nouvelle version" — Step Récap (diff)

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Nouvelle version GTM · Récap                        Étape 8/8           ║
║                                                                          ║
║  Nom : v4 — Mai 2026 Black Friday Setup                                  ║
║  Source : Providers actuels                                              ║
║                                                                          ║
║  Configuration par environnement :                                       ║
║                                                                          ║
║  ┌─ Production ─────────────────────────────────────────────────────┐   ║
║  │  ✓ 7 pixels configurés                                            │   ║
║  │  ⚠ 1 divergence avec Providers (Contact label)                    │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌─ Stage ──────────────────────────────────────────────────────────┐   ║
║  │  ✓ 7 pixels configurés (copie Production)                         │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌─ Preview / Dev ──────────────────────────────────────────────────┐   ║
║  │  ✓ 2 pixels configurés (minimal)                                  │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║                              [ ← Retour ] [ Créer la version ]          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Wizard "Modifier" — Step 1 Confirm

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Modifier v2 — BF 2026                               Étape 1/7           ║
║                                                                          ║
║  ⓘ La modification créera une NOUVELLE version (audit trail              ║
║    préservé). L'ancienne version reste accessible.                       ║
║                                                                          ║
║  Nom de la nouvelle version                                              ║
║  [v2.1 — patch                                                       ]   ║
║                                                                          ║
║  Notes de modification                                                   ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Corrige le Meta Pixel ID en production suite à test live          │   ║
║  │                                                                  │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║                                           [ Annuler ] [ Continuer → ]   ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Wizard "Modifier" — Step 6 Diff visuel

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Modifier v2 — BF 2026 · Récap diff                 Étape 6/7            ║
║                                                                          ║
║  Modifications détectées :                                               ║
║                                                                          ║
║  Production                                                              ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  Meta Pixel ID                                                    │   ║
║  │  ─ 2179682406197934                                               │   ║
║  │  + 9876543210123456   ✏ modifié                                  │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │  Conv label purchase                                              │   ║
║  │  ─ ABC123                                                         │   ║
║  │  + XYZ789            ✏ modifié                                   │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Stage / Preview / Dev : aucun changement                                ║
║                                                                          ║
║                          [ ← Retour ] [ Sauvegarder v2.1 ]              ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Wizard "Modifier" — Step 7 Activation

```
╔══════════════════════════════════════════════════════════════════════════╗
║  ✅ v2.1 sauvegardée                                                      ║
║                                                                          ║
║  La version v2.1 a été créée à partir de v2. Elle apparaît dans la       ║
║  liste des versions, non activée.                                        ║
║                                                                          ║
║  Souhaites-tu activer v2.1 maintenant ?                                  ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  ○ Oui, activer v2.1 immédiatement                                 │   ║
║  │     v3 sera désactivée. Les exports GTM utiliseront v2.1.          │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  ● Plus tard (rester sur v3 actuelle)                              │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║                                                       [ Terminer ]     ║
╚══════════════════════════════════════════════════════════════════════════╝
```
