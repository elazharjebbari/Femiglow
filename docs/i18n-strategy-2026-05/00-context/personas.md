# Personas i18n

## P1 — Yasmine (visiteur FR Maroc) — persona principal P1

**Profil** :
- Âge 32 ans, Casablanca
- Bilingue FR/AR (darija) — préfère FR pour services et achats
- Smartphone Samsung Galaxy A52, Android 13
- 4G en mouvement / Wifi domicile
- Découvre FemiGlow via Instagram (story story)
- Naviguer Chrome mobile

**Parcours** :
1. Tap Instagram link → atterrit sur `/kit` (depuis FR locale détectée)
2. Lit la description du pack en français — voix FemiGlow l'inspire confiance
3. Voit le wizard checkout, langue FR cohérente
4. Saisit prénom + téléphone, livraison Casablanca, paiement carte
5. Reçoit email confirmation en FR
6. Ne change PAS de langue (FR = sa préférence)

**Pain points actuels (sans i18n)** :
- Aucun — site déjà optimal pour elle
- Mais elle pourrait inviter une amie arabophone qui ferait demi-tour

**Besoins i18n V1** :
- ✅ Site charge en FR par défaut (cookie/IP)
- ✅ Switcher visible mais discret (ne perturbe pas son flow)
- ✅ Devise MAD ; format date FR

---

## P2 — Khadija (visiteur AR/Darija Maroc) — persona prioritaire P1

**Profil** :
- Âge 47 ans, Rabat
- Langue première arabe ; comprend FR mais préfère AR
- Smartphone iPhone SE 2020, iOS 16
- 4G uniquement
- Découvre FemiGlow via WhatsApp (lien partagé par amie)
- Safari mobile

**Parcours souhaité** :
1. Tap WhatsApp link → atterrit sur `/kit` (FR par défaut)
2. **Cherche le switcher** dans le header → trouve le globe avec "FR"
3. Click → choix AR
4. La page se recharge en arabe, RTL, font arabe lisible
5. Lit la description, comprend en quelques secondes
6. Wizard checkout en arabe, RTL
7. Email confirmation en arabe

**Pain points actuels (sans i18n)** :
- ❌ Page en FR, friction cognitive
- ❌ Pas de switcher visible
- ❌ Wizard FR (alors que CHA-231 a déjà l'AR codé !)
- ❌ Bounce rate élevé (~70% estimé)

**Besoins i18n V1** :
- ✅ **Switcher dans header SUPER visible** (icône globe + abrégé FR/AR/EN)
- ✅ **RTL impeccable** (lecture droite-gauche)
- ✅ Font arabe lisible (Noto Sans Arabic ou IBM Plex Arabic)
- ✅ Format date AR (٢٧ مايو)
- ✅ Détection auto (Accept-Language: ar → AR au first visit)

---

## P3 — James (visiteur EN expat ou export) — persona P2

**Profil** :
- Âge 38 ans, expat à Casablanca OU client en France
- Anglophone (US/UK natif)
- MacBook Pro + iPhone
- Wifi fiber
- Découvre FemiGlow via Instagram ou Google search
- Chrome / Safari desktop + mobile

**Parcours** :
1. Google "natural nail care Morocco" → click sur ranked page FemiGlow
2. Page atterrit en FR (default) — il ne comprend pas
3. **Cherche immédiatement le switcher**
4. EN sélectionné → contenu en anglais (formal British or US)
5. Lit, comprend les valeurs FemiGlow (halal, artisanat)
6. Wizard en EN (devise affichée MAD avec hint "≈ USD 20 / EUR 18")
7. Email confirmation en EN

**Pain points actuels (sans i18n)** :
- ❌ Aucun EN nulle part
- ❌ Switcher absent

**Besoins i18n V1** :
- ✅ Switcher EN dans header
- ✅ Détection auto via `Accept-Language: en`
- ✅ Devise MAD avec optionnel preview USD/EUR (tooltip ?)
- ⚠️ Long-term : conversion devise réelle (V2)

---

## P4 — Souheila (fondatrice et admin) — persona admin

**Profil** :
- 38 ans, Rabat
- Bilingue FR/AR, comprend EN
- MacBook Air, Chrome
- Admin power user du site
- Pas dev mais à l'aise outils digitaux (Canva, Notion, Instagram)

**Use cases admin** :

### UC-A1 — Mettre à jour un titre de section

**Actuellement** :
1. Va sur `/admin/components/...`
2. Édite le titre en FR
3. Save → revalidate → live

**Avec i18n V1** :
1. Va sur `/admin/components/...`
2. Voit 3 onglets : `FR ✅` / `AR ⚠️ vide` / `EN ⚠️ vide`
3. Édite FR
4. Clique sur AR → écrit en arabe (input RTL)
5. Save → revalidate par locale
6. **Bonus** : button "Suggest translation (AI)" qui pré-remplit AR/EN, à valider manuellement

### UC-A2 — Ajouter une nouvelle langue (ES)

**Actuellement** : impossible sans dev.

**Avec i18n V1+** :
1. `/admin/i18n/languages` → "+ Ajouter"
2. Sélectionne `es-ES` dans dropdown
3. Choisit "Active" toggle
4. UI admin propose désormais onglet ES pour tous les champs
5. Page `/es/kit` accessible (avec fallback FR si missing)

### UC-A3 — Voir la coverage par langue

**Use case** :
- `/admin/i18n/coverage` → tableau
- `FR : 100%` `AR : 78%` `EN : 45%`
- Click sur "AR 78%" → liste des 22% manquants
- Bouton "Export missing keys to CSV" pour envoyer à traducteur

### UC-A4 — Importer traductions externes

**Use case** : traducteur freelance livre `fr-to-ar.csv`.

**Workflow** :
1. `/admin/i18n/import`
2. Upload CSV
3. Preview diff
4. Valider → DB updated + git commit auto via webhook

**Besoins i18n V1 (admin UX)** :
- ✅ Onglets locale par champ dans tous les éditeurs
- ✅ Indicateur coverage par langue
- ✅ Action "Suggest AI translation" (optionnel V1, P1 V2)
- ⚠️ Import CSV (V2)
- ⚠️ Audit log des modifications (qui a traduit quoi quand)
