# 90.5 — Decision log

Trace des décisions clés prises pendant la conception. Les **ADR** techniques
sont dans `../10-architecture/adr-*.md` ; ici on documente les décisions
**produit, contenu, organisationnelles**.

| # | Date | Décision | Alternatives | Raison | Décideur |
|---|---|---|---|---|---|
| D01 | 2026-05-13 | **9 pages préconfigurées** vs 4 (minimum légal) | (a) 4 minimum, (b) 9 standard, (c) 15+ exhaustif | 9 couvre le critique tout en restant gérable | Product |
| D02 | 2026-05-13 | **MD raw avec preview** vs WYSIWYG | (a) MD raw, (b) WYSIWYG (Tiptap), (c) hybride | MD plus précis, plus diff-friendly, moins de bugs | Tech |
| D03 | 2026-05-13 | **noindex par défaut** vs index par défaut | (a) noindex, (b) index, (c) per-page choix | Évite content thin issues SEO + protection vie privée | Product + SEO |
| D04 | 2026-05-13 | **DB + Git sync** vs DB seule vs Git seul | 3 options ADR-001 | Best of both : DB rapide + git audit | Tech |
| D05 | 2026-05-13 | **Préfixe /legal/[slug]** vs flat /[slug] | (a) flat, (b) préfixe, (c) catch-all | Préfixe = clarté + cataloguage SEO | Product |
| D06 | 2026-05-13 | **Single admin user pour V1** vs multi-tenant | V1 = single, V2 = multi | Évite complexité 4-yeux trop tôt | Product |
| D07 | 2026-05-13 | **Confirmation par tape "PUBLIER"** vs simple confirm | (a) bouton, (b) checkbox, (c) tape texte | Friction délibérée pour décision lourde | UX |
| D08 | 2026-05-13 | **Variables avec syntax `{{KEY}}`** vs `${KEY}` | (a) handlebars-like, (b) JS template, (c) custom | Lisible + standard internationalement | Tech |
| D09 | 2026-05-13 | **Pessimistic lock 15min** vs optimistic ETag | (a) pessimistic, (b) optimistic, (c) aucun | V1 simple ; V2 = optimistic plus scalable | Tech |
| D10 | 2026-05-13 | **Auto-save 30s** vs 10s vs manuel | (a) 30s, (b) 10s, (c) manuel | Compromis : data-loss vs charge serveur | UX + Tech |
| D11 | 2026-05-13 | **Tribunaux Casablanca** dans CGV | Autres villes possibles | Siège FemiGlow présumé à Casa | Product |
| D12 | 2026-05-13 | **Loi 31-08 art. 36 : 7 jours rétractation** | (a) 7 jours legal, (b) 14 jours géreux | Conformité stricte ; option d'étendre par variable | Product + Juriste |
| D13 | 2026-05-13 | **Exception rétractation : produits descellés** | Suivre la loi 31-08 art. 37 | Standard cosmétique sectoriel | Product + Juriste |
| D14 | 2026-05-13 | **Voix : "vous"** pour le client, "FemiGlow" 3p | (a) tu, (b) vous, (c) on impersonnel | Pro mais accessible ; cohérent avec marque | Content |
| D15 | 2026-05-13 | **Frais retour à charge client** (sauf défaut) | (a) toujours offert, (b) à charge client | Standard sectoriel ; pas de sur-promesse | Product |
| D16 | 2026-05-13 | **CodeMirror 6** comme éditeur MD | (a) CodeMirror, (b) Monaco, (c) textarea brut | Léger, syntax MD, extensible | Tech |
| D17 | 2026-05-13 | **DOMPurify** pour sanitization HTML | (a) DOMPurify, (b) sanitize-html, (c) custom | Standard ; battle-tested ; whitelist clair | Tech |
| D18 | 2026-05-13 | **markdown-it** comme parser | (a) markdown-it, (b) remark, (c) custom | Rapide ; plugins ; sync (pas async overhead) | Tech |
| D19 | 2026-05-13 | **Tailwind Typography** override pour `.legal-prose` | Custom CSS ou Typography plugin | Standard + customisable via charte | Frontend |
| D20 | 2026-05-13 | **CodeMirror lazy load** pour bundle size | (a) eager, (b) lazy avec Suspense | Lazy évite 200kb sur public bundle | Tech |
| D21 | 2026-05-13 | **i18n reporté en V2** | (a) V1 multi-lang, (b) V1 FR only | V1 = simplicité, V2 = arabe | Product |
| D22 | 2026-05-13 | **PDF export via puppeteer** vs html-to-pdf-node | (a) puppeteer, (b) html-pdf, (c) WeasyPrint | Fidélité au rendu HTML | Tech (V1.1) |
| D23 | 2026-05-13 | **Chat ne peut PAS donner avis juridique** | (a) refus total, (b) tentative + disclaimer | Sécurité légale ; renvoi humain systématique | Product + Legal |
| D24 | 2026-05-13 | **Cookie banner non bloquant** | (a) bloquant, (b) non bloquant | Conformité + UX ; choice "Tout refuser" obligatoire | Product + Legal |
| D25 | 2026-05-13 | **Pages legal pages = pages séparées** vs sections d'une page unique | (a) 1 page commune, (b) pages séparées | SEO + maintenabilité + lisibilité | Product |
| D26 | 2026-05-13 | **Section "Voir aussi" automatique** | (a) auto via mapping, (b) manuel, (c) absent | Découvrabilité ; entretien minimal | Product |
| D27 | 2026-05-13 | **Footer bottom bar : max 5 liens** | (a) sans limite, (b) 5 max, (c) 3 max | Ergonomie mobile + densité info | UX |
| D28 | 2026-05-13 | **Pas d'illustrations** sur pages légales | (a) avec illus charte, (b) pures | Sobriété + sérieux + perf | Design |
| D29 | 2026-05-13 | **Variables remplies en DB** (pas hardcodées) | (a) en code, (b) en DB, (c) en config | Configurable sans deploy ; auditable | Tech |
| D30 | 2026-05-13 | **Audit events réutilise table existante** | (a) table dédiée legal, (b) extend audit_events | Cohérence avec audit global FemiGlow | Tech |

## Décisions reportées (à trancher avant launch)

| # | Sujet | Date limite | Owner |
|---|---|---|---|
| LATER-01 | Choix juriste partenaire | 2026-05-20 | Product |
| LATER-02 | Branding du PDF export juriste (logo + entête) | 2026-06-15 | Design |
| LATER-03 | Décision V2 sur 4-eyes workflow | 2026-08-01 | Product |
| LATER-04 | Multi-langue (FR/AR) timing | 2026-09-01 | Product |
| LATER-05 | Format des notifications email juriste | 2026-06-01 | Product |

## Décisions réversibles vs irréversibles

**Faciles à reverser** :
- Toutes les décisions UX (D14, D27)
- Choix lib si abstraction propre (D16, D17, D18)
- Cadence cron (D10)

**Difficiles à reverser** :
- Préfixe /legal/ (D05) — implique redirects
- Variables format (D08) — substitution dans tous les contenus
- noindex par défaut (D03) — peut affecter classement SEO si reverse

**Irréversibles ou coûteux** :
- D04 (DB + git) — change de modèle = migration complexe
- D11 (juridiction Casa) — affecte chaque contrat existant
- D12 (7 jours rétractation) — modification = action client

## Suivi des décisions

Cette table doit être mise à jour à chaque décision substantielle prise pendant les 7 semaines de dev. Format consistant pour audit ultérieur.

Owner : Tech Lead.
