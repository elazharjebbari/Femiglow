# Templates — refonte anonymisée

> ⚠️ **Pré-requis** : validation juriste (cf. `00-context/contraintes-juridiques.md`) avant de publier ces refontes en prod.

## 1. `mentions-legales.md` — nouveau template

**Fichier source** : `docs/legal-pages/60-content/mentions-legales.md`

```markdown
---
slug: mentions-legales
title: Mentions légales
description: Informations légales de l'éditeur du site FemiGlow.
status: draft
include_in_search: false
require_legal_review: true
---

# Mentions légales

Dernière mise à jour : {{LAST_UPDATED}} — version {{VERSION}}

## Identité de l'éditeur

Le site **FemiGlow** ({{SITE_URL}}) est édité au Maroc.

| | |
|---|---|
| Nom légal | {{COMPANY_NAME}} |
| Forme juridique | {{COMPANY_FORM}} |
| ICE | {{ICE}} |
| Email contact | {{CONTACT_EMAIL}} |
| Téléphone support | {{CONTACT_PHONE}} |

> **Informations juridiques complémentaires** (numéro RC, adresse de
> siège social, capital social, directeur de la publication) :
> ces informations sont disponibles sur demande motivée à l'adresse
> **legal@femiglow-maroc.com**. Nous répondons sous **5 jours ouvrés**.

## Hébergement

Site hébergé par :

| | |
|---|---|
| Nom | {{HOST_NAME}} |
| Adresse | {{HOST_ADDRESS}} |
| Contact | {{HOST_CONTACT}} |

## Protection des données

Conformément à la loi 09-08 sur la protection des données à caractère
personnel, vous disposez d'un droit d'accès, de rectification et de
suppression de vos données.

Pour exercer ces droits : **{{CONTACT_EMAIL}}**.

Référence déclaration CNDP : {{CNDP_DECLARATION_REF}}.

## Propriété intellectuelle

L'ensemble du contenu du site (textes, images, vidéos, logos) est
protégé par le droit d'auteur. Toute reproduction sans autorisation
est interdite.

## Contact

Pour toute question : **{{CONTACT_EMAIL}}** ou {{CONTACT_PHONE}}
({{SUPPORT_HOURS}}).
```

## 2. `cgv.md` — nouveau template

**Fichier source** : `docs/legal-pages/60-content/cgv.md`

Section "Identité du vendeur" remplacée :

```markdown
## Article 1 — Identité du vendeur

Le site FemiGlow ({{SITE_URL}}) est édité par {{COMPANY_NAME}}.

Coordonnées commerciales :
- Email : **{{CONTACT_EMAIL}}**
- Téléphone : {{CONTACT_PHONE}} ({{SUPPORT_HOURS}})

> Pour toute demande relative à notre identité juridique complète
> (RC, adresse de siège, capital, ICE), merci de nous contacter à
> **legal@femiglow-maroc.com**.

## Article 2 — Devise et paiement

Devise : {{CURRENCY}} (Dirham marocain).

Prestataires de paiement acceptés : {{PAYMENT_PROVIDERS}}.

## Article 3 — Délai de rétractation

Conformément à la loi marocaine sur la vente à distance, vous
disposez de **{{COOLING_OFF_DAYS}} jours** pour exercer votre droit
de rétractation à compter de la réception du produit.

Pour exercer ce droit : envoyer un email à **{{CONTACT_EMAIL}}**.

[... reste du CGV inchangé ...]
```

## 3. `confidentialite.md` — nouveau template

Section "Identité du responsable de traitement" :

```markdown
## Identité du responsable de traitement

Les données collectées via FemiGlow sont traitées par {{COMPANY_NAME}},
société éditée au Maroc.

> Pour toute demande relative à notre identité juridique complète
> (RC, adresse de siège, capital, ICE), merci de nous contacter à
> **legal@femiglow-maroc.com**.

Référence CNDP : {{CNDP_DECLARATION_REF}}.

Durée de conservation : **{{DATA_RETENTION_YEARS}} ans** après la
dernière interaction.

[... reste inchangé ...]
```

## 4. `retours-remboursements.md` — nouveau template

Section identification entreprise :

```markdown
# Politique de retours et remboursements

Dernière mise à jour : {{LAST_UPDATED}} — version {{VERSION}}

## Délai de rétractation

Vous disposez de **{{COOLING_OFF_DAYS}} jours** à compter de la
réception du produit pour exercer votre droit de rétractation,
conformément à la loi marocaine.

## Comment procéder

Envoyez un email à **{{CONTACT_EMAIL}}** en précisant :
- Votre numéro de commande
- La raison du retour (optionnel)

Notre équipe vous répond sous {{SUPPORT_HOURS}} et vous indique
l'adresse de retour.

[... reste inchangé ...]
```

## 5. Diff appliqué à la DB

Une fois les templates sources mis à jour, exécuter dans `/admin/legal` :

1. **Soit** seed défauts (réinsère depuis fichiers source) — risque d'écraser des édits admin
2. **Soit** édition manuelle par page via l'admin (préférable pour préserver les édits)
3. **Soit** script de patch SQL avec REPLACE ciblé :

```sql
-- Exemple pour cgv : remplacer le bloc identité vendeur
UPDATE legal_pages
   SET body_md = REPLACE(
         body_md,
         '## Article 1 — Identité du vendeur\n\nNom légal : {{COMPANY_NAME}}\nForme juridique : {{COMPANY_FORM}}\nRC : {{COMPANY_RC}}\nICE : {{ICE}}',
         '## Article 1 — Identité du vendeur\n\nLe site FemiGlow est édité par {{COMPANY_NAME}}.\n\n> Identité juridique complète sur demande à legal@femiglow-maroc.com.'
       ),
       updated_at = NOW(),
       updated_by = '<actorId>'
 WHERE slug = 'cgv'
   AND status = 'published';
```

⚠️ Cette approche est fragile (dépend du wording exact du current body_md). **Préférer édition admin manuelle**.

## 6. Procédure de republish

Pour chaque page modifiée :

1. Admin → `/admin/legal/<slug>/edit`
2. Coller le nouveau body_md ci-dessus
3. Save (status → review ou draft selon `requireLegalReview`)
4. Pré-visualiser sur `/legal/<slug>?preview=true`
5. Vérifier que :
   - ICE, RC ne sont pas visibles en clair
   - Le bloc "info sur demande email" est présent
   - L'email `legal@femiglow-maroc.com` est en gras
6. Publier (confirm "PUBLIER")

## 7. Vérifications après refonte

```sql
-- Vars utilisées par chaque page mise à jour
WITH used AS (
  SELECT slug, regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
  FROM legal_pages WHERE slug IN ('mentions-legales', 'cgv', 'confidentialite', 'retours-remboursements')
)
SELECT slug, array_agg(DISTINCT m[1]) AS vars
FROM used GROUP BY slug ORDER BY slug;
```

Attendu : aucune var sensible (ICE, COMPANY_RC, COMPANY_ADDRESS, etc.) directement dans le bloc "identité publique" — uniquement dans le rendu via bloc "info sur demande".

## 8. Email `legal@femiglow-maroc.com`

À setup côté infra :

- [ ] Boîte email créée (Google Workspace ou équivalent)
- [ ] Routing vers la fondatrice (ou équipe care)
- [ ] Auto-reply optionnel : "Votre demande a été reçue. Nous répondons sous 5 jours ouvrés."
- [ ] Monitoring : alerter si email reste sans réponse > 5j (cron + n8n ?)

## 9. Validation juriste — template à soumettre

À envoyer au juriste :

```
Bonjour Maître,

Nous travaillons sur l'anonymisation de nos pages légales publiques.
Pourriez-vous valider la conformité avec la loi marocaine :

1. Lien : [staging URL des nouvelles mentions légales]
2. Approche : afficher uniquement nom légal + ICE + email contact, et
   indiquer pour le reste (RC, adresse siège, capital, directeur) que
   les informations sont disponibles sur demande à legal@femiglow-maroc.com
   sous 5 jours ouvrés.

Question :
- Cette approche est-elle conforme à la loi 04-99 (Code Commerce) et
  à la loi 53-05 (échange électronique) ?
- Si non, quelles mentions DOIVENT impérativement rester visibles
  publiquement ?
- Le délai de 5 jours ouvrés pour répondre à une demande est-il
  acceptable juridiquement ?

Cordialement,
[Nom]
```
