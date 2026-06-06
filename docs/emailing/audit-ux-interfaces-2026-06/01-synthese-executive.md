# Synthèse exécutive — audit UX/UI emailing admin

> TL;DR : la **fondation technique est saine** (RSC + server actions, états
> loading/empty/error présents presque partout, a11y au-dessus de la moyenne,
> command palette ⌘K, batterie de tests QA conséquente) mais l'**expérience
> opérateur est inégale** : navigation fragmentée, feedbacks hétérogènes
> (window.confirm natif, pas de toasts), métriques ambiguës (« n/d », livraison
> silencieuse), wizards rigides (pas de saut d'étape, pas d'autosave), et trois
> écrans clés en retrait (automations sans vue de flux, templates sans vrai
> éditeur, suppression sans ajout manuel ni filtres).

## 1. Scoring par interface

| Interface | Complétude fonctionnelle | UX/ergonomie | Design/cohérence | A11y | Verdict |
|---|:---:|:---:|:---:|:---:|---|
| Dashboard `/admin/emails` | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | Bon socle ; fenêtre 7j figée, pas d'auto-refresh, KPI « Livrés » ambigu |
| Transactionnel (cockpit) | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★★★ | L'interface la plus aboutie ; export CSV limité à la page, raisons skip non traduites |
| Campagnes | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | Wizard 6 étapes solide mais rigide (pas de saut d'étape, pas d'autosave, blocage si API estimation down) |
| Automations | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | Le plus gros écart ambition/UX : pas de vue de flux, debug de run = JSON brut, pas de test-run, triggers fantômes |
| Templates | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | Éditeur = textarea nu ; 5 variables affichées sur 20+ ; pas d'autosave ni garde de sortie ; pas de preview mobile |
| Audiences | ★★★★☆ | ★★★★☆ | ★★★★☆ | ★★★★☆ | Rule builder riche et lisible ; mais tags non fonctionnels (stub M5.5), drift snapshot invisible, bornes « entre » non validées |
| Suppression | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | Lecture/retrait seulement : pas d'ajout manuel, pas de filtres raison/source, pas de bulk, orpheline de la navigation |
| Events (debug) | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | Remplit son rôle debug ; aucune corrélation vers outbox/campagne, JSON tronqué sans expand |
| Listmonk (iframe) | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | Fonctionne via sous-domaine ; fallback proxy cassé, panne Listmonk silencieuse partout |

## 2. Top 10 problèmes transverses (TRV)

1. **TRV-01 — Confirmations destructives via `window.confirm()` natif** (9 occurrences :
   annuler campagne, supprimer brouillon, désactiver automation, retry/cancel run,
   restaurer version template, supprimer audience, suppress bulk, reap-stuck, retirer
   suppression). Non stylé, texte long tronqué sur certains navigateurs, inaccessible,
   incohérent avec le seul vrai dialog custom (confirmation snapshot audience).
2. **TRV-02 — Aucun système de toast/notification unifié.** Chaque écran invente son
   feedback : bandeau inline persistant (cockpit), rien du tout (refresh métriques
   campagne, sauvegarde version template), redirect silencieux (création). L'opérateur
   doute en permanence que son action a été prise en compte.
3. **TRV-03 — Navigation fragmentée.** Une seule entrée « Emails » dans AdminShell ;
   la sous-navigation n'existe que via les 7 boutons du dashboard et ⌘K. **Suppression
   est absente des deux** (orpheline). Libellés retour incohérents (« ← Dashboard
   emails » / « ← Tableau de bord » / breadcrumb selon l'écran). Pas d'état actif.
4. **TRV-04 — Métriques ambiguës pendant la montée en charge du webhook.** « Livrés 0 /
   delivery silencieux ? webhook ? » (dashboard), « n/d » sans tooltip (campagnes),
   statut `sent` qui stagne sans explication (cockpit). L'opérateur ne peut pas
   distinguer « pas encore de données » / « cassé » / « non implémenté ».
5. **TRV-05 — Données statiques sans indicateur de fraîcheur homogène.** Dashboard
   et détail campagne figés au chargement (refresh manuel) vs cockpit auto-refresh 5 s ;
   pas de timezone affichée ; « Dernière synchro » qui retombe sur `updatedAt`.
6. **TRV-06 — i18n 100 % français codé en dur**, zéro framework — verrouille toute
   internationalisation et laisse fuir de l'anglais brut (raisons de skip `not_found`,
   `wrong_status`, mode d'évaluation `dynamic`).
7. **TRV-07 — `StatusBadge` défini en double** (`KpiCards.tsx` local + `common/StatusBadge.tsx`
   canonique) : tout nouveau statut divergera silencieusement.
8. **TRV-08 — Wizards rigides** (campagne 6 étapes, automation 4 étapes, audience 3
   étapes) : steppers décoratifs non cliquables, pas de raccourcis clavier, pas
   d'autosave debounced ni de reprise à l'étape courante, pas de focus management.
9. **TRV-09 — Empty states hétérogènes** : box pointillée + emoji (audiences, cockpit)
   vs ligne de table grise (dashboard, campagnes) vs simple phrase (templates, runs).
10. **TRV-10 — Pas de garde « modifications non enregistrées »** nulle part (éditeur
    template, wizards) : fermeture d'onglet = perte sèche.

## 3. Forces à préserver

- **Cockpit transactionnel** : grammaire de filtres (`status:dlq to:*@x.tld after:-7d`),
  autocomplétion d'entités, vues sauvegardées, bulk actions honnêtes (compte des
  ignorés + raisons), export CSV RFC 4180, aria-sort/toolbar — c'est la référence
  interne à généraliser.
- **Rule builder audiences** : 15 types de règles, groupes ET/OU récursifs, preview
  live (taille + échantillon + breakdown ciblés/exclus/envoyables), restitution FR
  lisible des règles en page détail.
- **HealthBadge dashboard** : 15 checks réels (webhook muet, file en retard, sending
  bloqué) avec deep-links vers les populations concernées du cockpit.
- **Sécurité** : sanitization DOMPurify des templates, iframes sandboxées, garde 401
  constant-time, allowlist interne anti-suppression (R-009), audit-log des actions.
- A11y largement au-dessus du standard interne (role/aria-live/aria-sort, skeletons
  `role="status"`, palette ⌘K avec focus trap).

## 4. Lecture stratégique

Le système a été construit **backend-first** puis rattrapé par vagues UX (la « vague 4 »
a livré le cockpit, les comboboxes, la palette). Les écrans alignés sur cette vague
(cockpit, audiences) sont bons ; ceux restés au stade MVP (automations, templates,
suppression) concentrent 60 % des problèmes majeurs. Le backlog (`04-backlog-…yaml`)
propose donc : **un chantier socle** (design system de feedback : dialog + toasts +
nav) qui débloque mécaniquement ~25 problèmes, puis des chantiers par interface
classés par ROI opérateur.

## 5. Chiffres de l'audit

- 9 interfaces, 23 routes pages, 31 routes API, ~35 composants partagés audités.
- **111 problèmes** consignés : 8 critiques, 40 majeurs, 55 mineurs, 8 info.
- 12 stubs/features mortes identifiés (dont `deleteAutomation` non câblé — R-031,
  tags audiences fallback FALSE/TRUE, triggers schedule/webhook fantômes, DELETE
  template sans bouton, ajout manuel suppression sans UI).
- 10 chantiers d'amélioration proposés, dont 3 P0.
