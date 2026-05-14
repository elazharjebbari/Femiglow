# User journeys

## Journey 1 — Amal change le Pixel Meta (cas le plus fréquent)

**Contexte :** Le compte Meta Business a changé, nouveau Pixel ID. Amal doit propager le changement.

### Avant (système actuel)
```
1. Amal va sur /admin/tracking/pixels
2. Modifie le Pixel ID dans la card "Meta"
3. ⚠ Ne sait pas que la config GTM (par env) n'est PAS mise à jour
4. Va sur /admin/tracking/gtm/configurations
5. Cherche la config active, édite metaPixelId per-env
6. Sauve, ne sait pas si c'est suffisant
7. Va sur /admin/tracking/gtm → onglet Export
8. Télécharge le JSON
9. Va dans GTM UI, import (Merge), espère que ça marche
10. Test en console, scrute le network tab
Durée estimée : 15-20 min, plusieurs hésitations.
```

### Après (cible)
```
1. Amal va sur /admin/tracking
2. Voit "Plan actif : Production v8". Clic "Modifier mon tracking".
3. Wizard ouvre Step 1 — toutes les cases cochées (Meta, GA4, Ads...).
4. Clic "Continuer" → Step 2 (Identifiants).
5. Champ "Meta — Pixel ID" pré-rempli avec l'ancien. Elle remplace par le nouveau.
6. Le badge "auto-rempli" disparaît. Aucune erreur de validation.
7. Clic "Continuer" 3 fois (Step 3, 4 inchangés).
8. Step 5 (Review) : voit "Différences : Meta Pixel ID changé". OK.
9. Clic "Activer maintenant". Confirmation modal. Clic OK.
10. Toast "✓ Plan Production v9 actif". Page redirige home.
11. Sur home : carte status verte. Bouton "Télécharger JSON pour GTM".
12. Clic, download. Dans GTM UI, "Import" (Overwrite). Done.
Durée estimée : 3-5 min. Aucune hésitation.
```

### Gains
- 1 seule route au lieu de 3.
- 1 seul fichier à télécharger au lieu de 2.
- Validation visible avant publication.
- Pas de doute sur "ai-je tout fait ?"

---

## Journey 2 — Younes ajoute un nouveau provider (TikTok Pixel)

**Contexte :** Campagne TikTok à lancer. Il faut activer un Pixel ID.

### Cible
```
1. Younes va sur /admin/tracking, clic "Modifier".
2. Bascule en mode expert (toggle). Layout 3 colonnes.
3. Section "Outils" → coche TikTok.
4. Section "Identifiants" → ouvre TikTok, saisit Pixel ID + access token.
5. Section "Événements" → coche les events à envoyer à TikTok :
   - `view_content` → ViewContent
   - `add_to_cart` → AddToCart
   - `purchase` → CompletePayment
   - `lead_form_submit` → SubmitForm
6. Preview JSON live à droite montre les 4 nouveaux tags TikTok.
7. Section "Validation" → 0 erreurs, 0 warnings.
8. Clic "Activer".
9. Confirmation + activation.
10. Test : ouvre la page produit dans un autre onglet → Network tab → vérifie que la requête TikTok part.
Durée estimée : 8-12 min.
```

---

## Journey 3 — Aïcha vérifie le statut tracking avant un comité

**Contexte :** CMO prépare un point. Veut un état rapide.

### Cible
```
1. Va sur /admin/tracking.
2. Carte status : verte. "Plan actif : Production v8. Tout est synchronisé."
3. Clic sur "Historique des versions" :
   - v8 actif depuis 12/05 (amal@femiglow.ma)
   - v7 archivé 10/05
   - v6 archivé 03/04
4. Voit que la dernière mise à jour date d'il y a 2 jours. OK.
5. Clic sur la carte sync : "Dernier ping il y a 2 min. 4 outils synchronisés."
6. Ferme l'onglet.
Durée estimée : 60 secondes.
```

---

## Journey 4 — Incident : drift critique détecté

**Contexte :** Le drift detector signale que le client envoie un bundleId qui ne correspond pas. Amal est notifiée par email.

### Cible
```
1. Amal reçoit email : "[CRITICAL] Tracking drift détecté".
2. Clique sur le lien → /admin/tracking
3. Bandeau rouge en haut : "Le tracking client diverge de la version active depuis 14:32"
4. Clic "Comprendre" → /admin/tracking/sync
5. Page sync affiche :
   - Plan admin actif : Production v8 (bundleId abc123...)
   - Client ping : bundleId xyz789... (depuis 14:32)
   - Reasons : "Bundle mismatch — client utilise une version antérieure"
   - Recommendation : "Importer la dernière version dans GTM (le JSON est peut-être périmé)"
6. Clic "Télécharger le JSON v8" → download.
7. Va dans GTM UI, importe (Overwrite), publie le container.
8. Attend ~2 min. Refresh /admin/tracking.
9. Bandeau passe à orange (warning, 1 ping reçu). Puis vert après quelques pings.
Durée estimée : 5-10 min selon réseau.
```

---

## Journey 5 — Création d'un plan staging pour tester un changement risqué

**Contexte :** Younes veut tester une refonte d'events sans affecter la prod.

### Cible
```
1. /admin/tracking → "+ Nouveau plan".
2. Modal : "Cloner depuis ?" → choisit Production v8.
3. Nom : "Test refonte purchase params". OK.
4. Plan créé en draft, ouvre en wizard.
5. Skip Step 1 et 2 (clone OK).
6. Step 3 : ouvre `purchase`, modifie les params GA4 (ajoute `shipping_country`).
7. Step 4 : modifie env staging → met un measurementId test différent.
8. Step 5 review : voit le diff. OK.
9. Clic "Sauver en brouillon" (PAS activer).
10. Plan reste en draft, prod inchangée.
11. Plus tard : déploie l'event change sur staging, valide.
12. Revient sur le plan draft, clic "Activer" → swap propre Production v9 = ancien draft.
Durée estimée : 10-15 min (incluant tests).
```
