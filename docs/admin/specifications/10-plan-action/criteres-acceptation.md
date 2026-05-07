# Critères d'acceptation par feature

Format Gherkin (Given / When / Then), un cas par scénario.
Référence à la matrice `08-tests/matrice-couverture.csv`.

---

## F-AUTH — Authentification

### F-AUTH-01 — Login admin valide

```
Given un admin existe avec email "fondatrice@femiglow.ma" et mot de passe valide
When elle soumet le formulaire /admin/login avec ces credentials
Then la réponse est 200
 And un cookie "femiglow_admin_session" est posé (HttpOnly, Secure, SameSite=Lax)
 And elle est redirigée vers /admin
 And un audit_event "admin.login.success" est créé
```

### F-AUTH-02 — Login mauvais mot de passe

```
Given un admin existe
When elle soumet un mauvais mot de passe
Then la réponse est 401
 And aucun cookie n'est posé
 And un audit_event "admin.login.failed" est créé
 And admin_login_attempts est incrémenté pour (IP, email)
```

### F-AUTH-03 — Brute-force protection

```
Given 5 tentatives échouées en moins de 15 min sur le même (IP, email)
When une 6e tentative arrive (même mauvais mot de passe ou bon)
Then la réponse est 429
 And aucun login n'est traité (même si mot de passe correct)
 And un Retry-After header est présent
```

### F-AUTH-04 — Session expirée

```
Given un cookie session datant de 8h+ 1min
When une requête vers /admin/leads est envoyée
Then la session est invalide
 And l'utilisateur est redirigé vers /admin/login?next=/admin/leads
```

### F-AUTH-05 — Logout

```
Given un admin connecté
When il POST /api/admin/logout
Then la réponse est 200
 And le cookie est invalidé (Set-Cookie avec maxAge=0)
 And un audit_event "admin.logout" est créé
```

---

## F-LEADS — Gestion des leads

### F-LEADS-01 — Listing avec filtre statut

```
Given 50 leads avec statuts variés
When l'admin charge /admin/leads?status=qualified
Then seuls les leads qualifiés s'affichent
 And la pagination indique le bon total
 And l'URL contient ?status=qualified (partage possible)
```

### F-LEADS-02 — Détail lead

```
Given un lead "l_abc123" existe avec timeline de 5 events
When l'admin charge /admin/leads/l_abc123
Then la page rend les sections : identité, commande, timeline, deliveries
 And la timeline montre les 5 events triés du plus récent au plus ancien
 And la commande affiche les line items, total, devise
```

### F-LEADS-03 — Transition de statut valide

```
Given un lead en statut "new"
When l'admin sélectionne "qualified" dans le menu de statut
Then la transition est appliquée (optimistic UI)
 And un POST /api/admin/leads/[id]/status est envoyé
 And la réponse est 200
 And un lead_event "status_changed" est créé
 And un audit_event est créé
 And un toast "Statut mis à jour" apparaît
```

### F-LEADS-04 — Transition invalide

```
Given un lead en statut "won"
When l'admin tente de passer à "new"
Then la transition n'est pas proposée dans le menu
 And si forçée via API directe, retourne 400 "Transition invalide"
 And aucun event n'est créé
```

### F-LEADS-05 — Ajout d'une note admin

```
Given un lead existant
When l'admin remplit le formulaire de note avec un texte non vide
 And soumet
Then la note apparaît dans la timeline (optimistic)
 And POST /api/admin/leads/[id]/events crée un lead_event "note_added"
 And l'auteur de la note est l'admin connecté
```

### F-LEADS-06 — Lead introuvable

```
Given aucun lead n'existe avec id "l_unknown"
When l'admin charge /admin/leads/l_unknown
Then la page rend un 404 custom "Lead introuvable"
 And un lien retour vers /admin/leads est proposé
```

---

## F-WH — Webhooks endpoints

### F-WH-01 — Création endpoint

```
Given l'admin sur /admin/webhooks/new
When il soumet { url: "https://api.partner.com/hook", events: ["lead.created"] }
Then la réponse est 201
 And l'endpoint est créé en DB avec un secret aléatoire 32 bytes
 And le secret est chiffré at-rest (pgp_sym_encrypt)
 And le secret en clair est affiché UNE FOIS dans l'UI
 And un audit_event est créé
```

### F-WH-02 — Anti-SSRF URL privée

```
Given l'admin tente de créer un endpoint avec url "http://192.168.1.1/hook"
When il soumet le formulaire
Then la réponse est 400 "URL refusée (cible privée)"
 And aucun endpoint n'est créé
```

### F-WH-03 — URL non https

```
Given url "http://api.partner.com/hook" (sans s)
When il soumet
Then la réponse est 400 "HTTPS requis"
```

### F-WH-04 — Rotation secret

```
Given un endpoint existant
When l'admin clique "Régénérer le secret" + confirme
Then un nouveau secret est généré et affiché
 And l'ancien secret est invalidé immédiatement
 And un audit_event "webhook.secret_rotated" est créé
```

### F-WH-05 — Toggle actif/inactif

```
Given un endpoint actif
When l'admin clique le toggle
Then l'endpoint passe en disabled
 And aucune nouvelle delivery n'est planifiée pour cet endpoint
 And les deliveries pending existantes sont marquées canceled
```

### F-WH-06 — Suppression endpoint

```
Given un endpoint avec 200 deliveries historiques
When l'admin supprime l'endpoint avec double confirmation
Then l'endpoint est soft-deleted (deleted_at NOT NULL)
 And les deliveries historiques sont conservées
 And un audit_event est créé
```

---

## F-DEL — Deliveries / livraison webhook

### F-DEL-01 — Tentative réussie

```
Given une delivery pending pour un endpoint qui répond 2xx
When le cron pick cette delivery
Then la requête est envoyée avec :
   - header X-FemiGlow-Signature : HMAC SHA-256 du body
   - header Idempotency-Key : delivery.id
   - body JSON
 And le statut est "succeeded"
 And response_status, response_body (max 4 KB), latency_ms sont enregistrés
```

### F-DEL-02 — Échec retryable

```
Given un endpoint qui répond 503
When le cron tente la livraison (attempt_count = 1)
Then status passe à "pending"
 And next_attempt_at = now + 60s ± 20% jitter
 And attempt_count = 2
```

### F-DEL-03 — Échec définitif

```
Given une delivery avec attempt_count = 5 (5 échecs)
When le cron pick et la 6e tentative échoue
Then status passe à "permanent"
 And aucune retry future n'est planifiée
 And un audit_event "webhook.delivery.permanent" est créé
 And une alerte (email) est envoyée si > 5 deliveries permanentes/h
```

### F-DEL-04 — Timeout 10s

```
Given un endpoint qui ne répond pas en 10s
When le cron tente la livraison
Then la requête est aboutie après 10s
 And status -> failed (retryable)
 And error_code = "timeout"
```

### F-DEL-05 — Retry manuel

```
Given une delivery en statut "permanent"
When l'admin clique "Réessayer maintenant"
Then la delivery passe à status "pending"
 And next_attempt_at = now
 And attempt_count est conservé (info historique)
```

---

## F-CRON — Cron tick

### F-CRON-01 — Tick batch nominal

```
Given 50 deliveries pending avec next_attempt_at <= now
When Vercel POST /api/cron/tick avec Bearer CRON_SECRET valide
Then la réponse est 200 { processed: 50, took_ms: <50000 }
 And toutes les 50 ont été tentées
 And un audit_event "system.cron_tick" est créé
```

### F-CRON-02 — Concurrence

```
Given 2 invocations cron simultanées (theoric, normalement Vercel sérialise)
When les 2 lisent webhook_deliveries
Then FOR UPDATE SKIP LOCKED garantit qu'aucune delivery n'est traitée 2 fois
```

### F-CRON-03 — Bearer absent ou invalide

```
Given POST /api/cron/tick sans header Authorization
When le handler est appelé
Then la réponse est 401
 And aucune delivery n'est traitée
```

---

## F-A11Y — Accessibilité (transverse)

### F-A11Y-01 — Navigation clavier

```
Given une page admin
When l'utilisateur navigue avec Tab uniquement
Then tous les éléments interactifs sont atteignables
 And l'ordre est logique (haut→bas, gauche→droite)
 And le focus est toujours visible (outline)
```

### F-A11Y-02 — Lecteur d'écran labels

```
Given une icone-only button (ex. trash)
When un lecteur d'écran lit la page
Then l'aria-label "Supprimer l'endpoint" est annoncé
```

### F-A11Y-03 — Modale piégée

```
Given une modale ouverte
When l'utilisateur Tab
Then le focus reste dans la modale (cycle)
 And Echap ferme la modale
 And le focus revient sur l'élément qui l'a ouverte
```

### F-A11Y-04 — Contraste

```
Given chaque texte de l'interface
When mesuré via Axe ou inspecteur
Then le ratio de contraste >= 4.5:1 (texte normal)
 And >= 3:1 (texte large 18pt+ ou 14pt bold)
```

---

## F-SEC — Sécurité (transverse)

### F-SEC-01 — Headers sécurité

```
Given une réponse de /admin/*
When on inspecte les headers
Then on trouve :
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'self'; ... (avec nonce)
  Referrer-Policy: strict-origin-when-cross-origin
```

### F-SEC-02 — CSP report

```
Given une violation CSP simulée
When le navigateur POST /api/csp-report
Then la réponse est 204
 And un log structured "csp.violation" est émis
```

### F-SEC-03 — SQL injection

```
Given un paramètre URL contrôlé par l'utilisateur (ex. status filter)
When une chaîne avec syntaxe SQL est passée ("'; DROP TABLE leads;--")
Then Drizzle paramétrise correctement
 And la requête échoue silencieusement (status enum invalide) ou retourne []
 And aucune table n'est touchée
```

---

## F-PUB — Endpoints publics (formulaire site)

### F-PUB-01 — Création lead via site public

```
Given le formulaire site public POST /api/public/leads
When un visiteur soumet name+email+phone+order
Then un lead est créé en statut "new"
 And un audit_event est créé
 And un webhook "lead.created" est enqueué pour les endpoints actifs
 And la réponse 201 contient { id }
```

### F-PUB-02 — Rate-limit IP

```
Given un visiteur a soumis 10 leads en 1h depuis la même IP
When la 11e soumission arrive
Then la réponse est 429 avec Retry-After
```

### F-PUB-03 — Validation Zod

```
Given un payload sans email
When POST /api/public/leads
Then la réponse est 400 avec { errors: [{ field: "email", message: "Requis" }] }
 And aucun lead n'est créé
```

---

## Synthèse

Chaque scénario a un test associé dans
[`08-tests/matrice-couverture.csv`](../08-tests/matrice-couverture.csv).

L'ensemble couvre les flows critiques. Les flows secondaires (export
CSV, etc.) sont hors scope v1.
