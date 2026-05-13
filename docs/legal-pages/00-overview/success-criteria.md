# 00.3 — Critères de succès

## Critères fonctionnels

### CF.1 — Admin CRUD

- [ ] `/admin/legal` liste les 9 pages avec leur status, placements, dernière modif
- [ ] Bouton "Nouvelle page" ouvre wizard 5 steps
- [ ] Clic sur une page → éditeur avec MD raw + preview live split-pane
- [ ] Modifications sauvegardées en `draft`
- [ ] Workflow : Draft → Review → Published fonctionne
- [ ] Suppression d'une page : impossible pour `published` (faut archiver d'abord)
- [ ] Historique : toutes les versions visibles, restore possible

### CF.2 — Rendu public

- [ ] Pages accessibles via `/<slug>` (`/mentions-legales`, `/cgv`, …)
- [ ] Style FemiGlow appliqué (Cormorant Garamond + Inter, max-w-prose)
- [ ] Métadonnées correctes : title, description, OG
- [ ] `<meta name="robots" content="noindex,nofollow">` par défaut
- [ ] Sitemap.xml exclut les pages `include_in_search = false`
- [ ] Variables `{{COMPANY_NAME}}`, `{{ICE}}`, etc. remplacées au rendu

### CF.3 — Placement zones

- [ ] Footer affiche les pages dont `placement = 'footer-main'`
- [ ] Cookie banner affiche les pages `cookie-banner-links`
- [ ] Checkout affiche "J'accepte les {{CGV}} et {{politique de retour}}"
- [ ] Admin peut modifier la matrice page × zone
- [ ] Désactiver un placement masque le lien immédiatement (no cache)

### CF.4 — Link health

- [ ] Dashboard `/admin/legal/health` affiche status par zone
- [ ] Build CI échoue si lien footer cassé
- [ ] Cron job toutes les 30 min vérifie les liens
- [ ] Alerte email à admin si > 1 lien cassé

### CF.5 — Pré-rédaction

- [ ] Au premier seed, 9 pages créées en `draft`
- [ ] Chaque page contient un contenu adapté au contexte FemiGlow / Maroc
- [ ] Variables non-remplies signalées dans l'éditeur (`{{VAR}}` highlighté)
- [ ] Disclaimer "review juriste requise" visible avant publication

### CF.6 — Versioning

- [ ] Toute publication crée une entrée dans `legal_pages_history`
- [ ] Auto-commit sur branche `legal-versions` à la publication
- [ ] Restore possible depuis l'admin (révert à version N)

## Critères techniques

### CT.1 — Performance

- [ ] Page publique render < 100ms (cached)
- [ ] Éditeur preview live < 16ms par keystroke (60 FPS)
- [ ] `/admin/legal/health` charge < 500ms

### CT.2 — Sécurité

- [ ] CRUD pages = admin uniquement (RBAC)
- [ ] MD content sanitization (pas de XSS via injection HTML)
- [ ] Pas d'exécution JS dans le contenu MD (whitelist tags HTML)
- [ ] Audit log pour toute modification (qui, quand, quoi)

### CT.3 — Robustesse

- [ ] Si DB perdue : restore depuis branche `legal-versions` possible
- [ ] Si page corrompue : fallback "Cette page est en maintenance"
- [ ] Pas de 500 si admin crée une page sans contenu
- [ ] Validation Zod côté API

### CT.4 — Tests

- [ ] Coverage Jest > 80% sur `lib/legal/`
- [ ] Tous les e2e Playwright verts
- [ ] **Test ultime pipeline** : create → edit → publish → render public →
      footer link → health check → tout vert
- [ ] Axe-core 0 violations critiques sur toutes les pages légales

## Critères qualité contenu

### CQ.1 — Pré-rédaction

- [ ] 9 pages contiennent un contenu **fonctionnel** (pas placeholder vide)
- [ ] Mentions légales : tous les champs marocains présents (RC, ICE, etc.)
- [ ] CGV : prix MAD, paiement COD/bank, livraison Sendit, rétractation 14j
- [ ] Politique de confidentialité : CNDP, droits utilisateurs, finalités
- [ ] Cookies : liste précise des cookies utilisés
- [ ] Sécurité produits : test allergie, conservation, INCI mention

### CQ.2 — Style

- [ ] Ton calme, factuel, pas marketing dans les pages légales
- [ ] Tutoiement éviter (vouvoiement formel)
- [ ] Phrases courtes, lisibles
- [ ] Structure : H2 sections, H3 sous-sections, listes pour énumérations
- [ ] Variables clairement marquées `{{VAR}}`

### CQ.3 — Accessibilité

- [ ] Pages publiques navigables au clavier
- [ ] Structure sémantique HTML correcte (h1, h2, h3, ul, ol)
- [ ] Contraste AA minimum
- [ ] Lecture screen reader testée

## Critères UX

### CUX.1 — Admin

- [ ] Temps moyen pour modifier+publier une page : < 3 min
- [ ] L'admin sait quel statut a une page sans avoir à cliquer
- [ ] Preview live ne lag pas pendant la frappe
- [ ] Wizard "Nouvelle page" : skip possible si user déjà familier (advanced
      mode "Skip to editor")

### CUX.2 — Public

- [ ] Liens du footer visibles et accessibles
- [ ] Pages chargent vite sur mobile (Lighthouse Performance ≥ 85)
- [ ] Date de dernière mise à jour visible en haut de page

## Critères légaux (sous réserve validation juriste)

### CL.1 — Maroc

- [ ] Mentions légales conformes Loi 53-05 (échange électronique)
- [ ] CGV conformes Loi 31-08 (consommateur) — droit de rétractation 14j explicite
- [ ] Politique de confidentialité conforme Loi 09-08 — CNDP mentionnée
- [ ] Politique cookies conforme aux bonnes pratiques (consent management v2)
- [ ] Sécurité produits conforme Loi 24-99 — DMP mentionnée

### CL.2 — Disclaimer

- [ ] Workflow review explicite l'obligation de validation juriste avant
      premier publication
- [ ] Disclaimer visible : "Templates fonctionnels — validation juriste
      recommandée"

## Gates Go/No-Go par milestone

À chaque milestone (cf. `90-plan/milestones.md`) :
- CF + CT + CQ verts ?
- Tests passent ?
- Docs à jour ?
- Stakeholders alignés ?

Si NO sur un critère bloquant → on n'avance pas.
