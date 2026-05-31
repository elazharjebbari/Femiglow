# 50.4 — Wireframes Conversion Categorization

## Page `/admin/tracking/events/categorization`

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Console FemiGlow > Tracking > Events > Categorization                   ║
║                                                                          ║
║  Catégorisation des événements pour Google Ads                           ║
║  ─────────────────────────────────────────────                            ║
║                                                                          ║
║  Cette page définit la catégorie Google Ads (Purchase, Lead, Contact…)   ║
║  pour chaque événement de conversion. Les Conversion Actions de ton      ║
║  compte Google Ads sont mappées à ces catégories.                        ║
║                                                                          ║
║  ┌─ KPIs ───────────────────────────────────────────────────────────┐   ║
║  │  Events de conversion : 8                                         │   ║
║  │  Overridés : 1     (par Sara, il y a 3 j)                         │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  ┌─ Événements ─────────────────────────────────────────────────────┐   ║
║  │ Event              isConv    Catégorie            État           │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ purchase             ✅      [Purchase     ▼]   default          │   ║
║  │                              ⓘ "Conversion d'achat e-commerce"    │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ lead_capture         ✅      [Lead         ▼]   default          │   ║
║  │                              ⓘ "Formulaire de lead capturé"       │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ generate_lead        ✅      [Lead         ▼]   default          │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ chat_lead_form_submit ✅     [Lead         ▼]   default          │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ contact_form_submit  ✅      [Contact      ▼]   default          │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ phone_call_initiated ✅      [Contact      ▼]   default          │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ sign_up              ✅      [Sign up      ▼]   default          │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ stock_notify_subscribe       [Lead         ▼]   ✏ override        │   ║
║  │                              Default: None — override en Lead     │   ║
║  │                              par Sara · 2026-05-13                │   ║
║  │                              [Reset au default]                   │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ begin_checkout       ✅      [— None       ▼]   default          │   ║
║  │                              ⓘ "Pas une conversion GAds — c'est   │   ║
║  │                                 un signal de démarrage de funnel" │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Configuration Google Ads associée                                       ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Catégorie     →  Conversion Action Label   (gestion GTM)         │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ Purchase      →  AbCdEf123Abc        [Editer dans GTM ▸]         │   ║
║  │ Lead          →  XyZ789xyZ123        [Editer dans GTM ▸]         │   ║
║  │ Contact       →  + Ajouter                                       │   ║
║  │ Sign up       →  + Ajouter                                       │   ║
║  │ View Content  →  + Ajouter                                       │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Edit in-place — modal léger

Au clic sur le dropdown :

```
╔══════════════════════════════════════════════════════════════════════════╗
║  stock_notify_subscribe                                                  ║
║                                                                          ║
║  Default (catalog) : None                                                ║
║                                                                          ║
║  Override actuel                                                         ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  ○ — None                                                          │   ║
║  │  ● Lead                                                            │   ║
║  │  ○ Purchase                                                        │   ║
║  │  ○ Contact                                                         │   ║
║  │  ○ Sign up                                                         │   ║
║  │  ○ View Content                                                    │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Note (optionnel)                                                        ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ On considère un opt-in stock comme lead (marketing décision)      │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║                              [ Annuler ] [ Sauvegarder ]                 ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## États visuels

- **Default** : texte grisé "default" à côté du dropdown
- **Override** : badge violet `✏ override` + auteur + date
- **None** : dropdown affiche "—" en italique
- **Reset** : link "Reset au default" visible uniquement si override

## Interaction

- Click dropdown → ouvre menu inline (pas de modal)
- Sélection → optimistic update + POST `/api/admin/tracking/events/categorization`
- Erreur server → rollback + toast rouge
- Success → toast vert "Catégorie mise à jour" (5s)
- "Reset au default" → DELETE override → PUT `googleAdsCategory: null`
