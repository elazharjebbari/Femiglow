# Personas et parcours

## Persona 1 — **Sara, fondatrice FemiGlow** (admin principal)

- Connaissance GTM : intermédiaire (a importé/exporté 5 fois en 1 an).
- Stress principal : "Est-ce que mon tracking marche vraiment ?"
- Fréquence d'édition du mapping : 2-3 fois par mois.
- Action attendue : édite mapping → clique export → importe dans GTM → veut savoir "OK, c'est bon".

**Job-to-be-done** : *"Quand j'édite un mapping et que je l'importe dans GTM, je veux être certaine en moins de 5 minutes que tout est bien synchronisé en prod, pour pouvoir passer à autre chose sans anxiété."*

## Persona 2 — **Karim, freelance growth/tracking** (admin occasionnel)

- Connaissance GTM : avancée mais externe à FemiGlow.
- Stress principal : "Je ne veux pas casser le tracking en intervenant."
- Fréquence : 1-2 fois par trimestre (audits, hotfixes).
- Action attendue : ouvre l'admin pour la 1re fois en 3 mois → veut comprendre l'état avant toute intervention.

**Job-to-be-done** : *"Quand je reprends ce projet après 3 mois, je veux voir en un coup d'œil si le tracking est sain et où sont les zones à risque, pour intervenir en confiance."*

## Persona 3 — **Claude/Dev qui maintient**

- Doit pouvoir débuguer un drift signalé en moins de 30 minutes.
- Action attendue : voit une alerte → ouvre `/admin/tracking/gtm/sync-status` → comprend → corrige.

**Job-to-be-done** : *"Quand un drift est signalé, je veux passer du symptôme à la cause racine en moins de 10 minutes, sans avoir à grep dans Sentry."*

---

## Parcours principaux

### Parcours A — Sara édite et importe (happy path)

1. Sara édite mapping v17 dans `/admin/tracking/events/mappings/<id>/edit`.
2. Clique "Exporter pour GTM" → télécharge `fg-mapping-v17.json` + `fg-config-v4.json`.
3. **(Couche A)** Va sur `/admin/tracking/gtm/validate-pair`, drop les 2 fichiers.
4. Lit le diff : ✅ "Compatible. Importer config d'abord, puis mapping."
5. Va dans GTM, importe config v4, puis mapping v17, Submit & Publish.
6. **(Couche B)** Revient sur `/admin/tracking/gtm/sync-status` ; voit "Dernier ping reçu il y a 30s, versions cohérentes ✅".
7. Ferme l'onglet sereine.

**Temps total : ~5 min. Stress : 0. Risque résiduel : 0.**

### Parcours B — Sara importe dans le mauvais ordre (erreur attrapée)

1. Sara saute la couche A (urgence).
2. Importe mapping v17 d'abord, puis config v4, Submit & Publish.
3. **(Couche B)** Au premier pageview, GTM envoie un sentinel ping avec `mapping=v17, config=v3` (l'import de config n'a pas pris).
4. Backend détecte : mapping admin = v17, config détectée = v3 → drift `critical`.
5. **Banner rouge** s'affiche sur toutes les pages admin : "🚨 Drift critique — config GTM est en v3, doit être v4. Corriger ici →".
6. Email envoyé aux admins (digest, pas spam).
7. Sara clique le lien, lit la cause exacte, retourne dans GTM, corrige.
8. Au pageview suivant, banner disparaît automatiquement.

**Temps de détection : ~2 min après publication GTM. Stress : modéré (alerte explicite). Coût : pas de perte d'attribution longue.**

### Parcours C — Karim audite un projet hérité

1. Karim ouvre `/admin/tracking/gtm/sync-status` pour la première fois.
2. Voit 3 indicateurs verts + l'historique des 30 derniers jours.
3. Note "drift résolu il y a 8 jours" → clique pour voir le détail.
4. Comprend l'historique en 2 min, valide l'état sain.
5. Peut intervenir.

**Coût d'onboarding : < 5 min.**

### Parcours D — Drift silencieux (Container jamais publié)

1. Sara importe les fichiers dans GTM mais oublie de Publish.
2. **(Couche B)** Aucun sentinel ping n'arrive en 24h.
3. Cron détecte le silence : alerte `warning` "Aucun ping reçu depuis 24h alors qu'un import récent a été détecté côté admin".
4. Banner orange s'affiche.

**Couvre le mode d'échec n°2 du document vision.**
