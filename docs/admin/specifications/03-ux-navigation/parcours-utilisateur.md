# Parcours utilisateur

> Sept parcours clés couvrant 95 % de l'usage admin. Chaque parcours
> précise : déclencheur, étapes, résultat attendu, durée cible.

---

## UF-01 — Connexion matinale

**Déclencheur** : la fondatrice ouvre `femiglow.ma/admin` au début de
sa journée.

| # | Étape | Page | Action | Durée |
|---|---|---|---|---|
| 1 | Arrivée | `/admin/dashboard` | redirigée vers `/admin/login?next=/admin/dashboard` | < 200 ms |
| 2 | Saisie | `/admin/login` | tape email puis tab + mot de passe | ~10 s |
| 3 | Soumission | — | clic "Se connecter" | < 500 ms |
| 4 | Confirmation | `/admin/dashboard` | redirigée, voit "Bienvenue." en toast | — |

**Durée totale cible** : < 15 s.
**Erreurs gérées** : email/mot de passe faux (message générique sans
révéler quoi est faux), rate limit (toast "Trop de tentatives, réessayez
dans 10 min.").

## UF-02 — Vue panoramique du matin

**Déclencheur** : juste après login, la fondatrice veut voir l'état des
choses.

| # | Étape | Page | Information vue |
|---|---|---|---|
| 1 | Accueil | `/admin/dashboard` | 3 cartes KPI : leads 24 h, leads non traités, livraisons échouées 24 h |
| 2 | Lecture | — | aperçu des 5 derniers leads (lien "Voir tous") |
| 3 | Décision | — | clic "Voir tous" → `/admin/leads?status=new` |

**Durée cible** : 5 s pour scanner.

## UF-03 — Qualifier 3 leads en une session

**Déclencheur** : 3 nouveaux leads sont arrivés cette nuit.

| # | Étape | Page | Action | Durée |
|---|---|---|---|---|
| 1 | Liste filtrée | `/admin/leads?status=new` | voit la liste | — |
| 2 | Ouverture lead 1 | `/admin/leads/[id]` | clic sur la ligne | < 300 ms |
| 3 | Lecture | — | scanne payload, message, contexte | ~10 s |
| 4 | Changement statut | — | dropdown statut → "En cours" | ~3 s |
| 5 | Note (option) | — | ajoute note "Appel prévu lundi" | ~15 s |
| 6 | Retour liste | breadcrumb / Esc | retour `/admin/leads?status=new` | < 300 ms |
| 7 | Répéter étapes 2-6 pour leads 2 et 3 | — | — | — |

**Durée totale cible** : < 90 s pour 3 leads.

**Raccourcis ergonomiques** :
- Touche `j`/`k` : navigation lead suivant/précédent dans le détail.
- Touche `s` : focus dropdown statut.
- Touche `n` : focus champ note.
- `Esc` : retour à la liste.

## UF-04 — Configurer un nouveau webhook

**Déclencheur** : un nouveau partenaire CRM doit recevoir les leads.

| # | Étape | Page | Action |
|---|---|---|---|
| 1 | Liste webhooks | `/admin/webhooks` | clic "Ajouter une destination" |
| 2 | Formulaire | `/admin/webhooks/new` | saisie URL, génère secret, choisit filtre |
| 3 | Validation | — | Zod côté client + server, erreurs inline |
| 4 | Soumission | — | clic "Enregistrer" |
| 5 | Test (option) | `/admin/webhooks/[id]` | clic "Envoyer un payload test" |
| 6 | Vérification | — | voit la livraison test avec statut 200 |
| 7 | Activation | — | toggle "Activer" |

**Durée cible** : 3 minutes incluant copie du secret côté partenaire.

## UF-05 — Rejouer une livraison échouée

**Déclencheur** : le matin, la fondatrice voit "2 livraisons échouées"
sur le dashboard.

| # | Étape | Page | Action |
|---|---|---|---|
| 1 | Dashboard | `/admin/dashboard` | clic "2 livraisons échouées" |
| 2 | Liste filtrée | `/admin/webhooks/[id]/deliveries?status=failed` | voit les 2 |
| 3 | Inspection | clic ligne 1 | expand row : voit payload, réponse, erreur |
| 4 | Replay | bouton "Rejouer" | confirme dialog |
| 5 | Feedback | — | toast "Livraison reprogrammée." |
| 6 | Idem ligne 2 | — | — |

**Durée cible** : 30 s pour 2 replays.

## UF-06 — Exporter le carnet de leads pour comptabilité

**Déclencheur** : fin de mois, la fondatrice exporte les leads
"converted" pour rapprochement.

| # | Étape | Page | Action |
|---|---|---|---|
| 1 | Filtres | `/admin/leads?status=converted&from=2026-04-01&to=2026-04-30` | applique filtres |
| 2 | Export | bouton "Exporter en CSV" | téléchargement immédiat |
| 3 | Vérification | — | ouvre dans Numbers/Excel |

**Durée cible** : < 20 s pour l'export.

## UF-07 — Investigation après incident partenaire

**Déclencheur** : le partenaire annonce avoir été down de 14 h à 16 h
hier ; vérifier que les retries ont bien repris.

| # | Étape | Page | Action |
|---|---|---|---|
| 1 | Liste deliveries | `/admin/webhooks/[id]/deliveries?from=hier-14h&to=hier-18h` | applique filtres |
| 2 | Inspection | tableau coloré par statut | voit la séquence : `failed → failed → success` après retry |
| 3 | Rapport | clic "Exporter en CSV" | preuves d'audit |

**Durée cible** : 1 min.
