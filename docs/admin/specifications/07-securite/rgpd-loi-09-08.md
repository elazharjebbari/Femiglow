# Conformité RGPD & loi marocaine 09-08

FemiGlow opère **au Maroc** (siège, ventes), avec un site potentiellement
accessible à des résidents UE (acheteuses françaises d'origine marocaine, etc.).
La double conformité s'impose :

- **Loi 09-08** (Maroc) — Protection des personnes physiques à l'égard
  du traitement des données à caractère personnel.
- **RGPD** (UE) — applicable dès qu'un résident UE est ciblé.

## Autorité de contrôle

| Pays | Autorité | Site |
|---|---|---|
| Maroc | CNDP — Commission Nationale de contrôle de la protection des Données à caractère Personnel | https://www.cndp.ma |
| France (référence UE) | CNIL | https://www.cnil.fr |
| UE | EDPB | https://edpb.europa.eu |

## Données à caractère personnel (DCP) traitées

| Donnée | Catégorie | Finalité | Base légale |
|---|---|---|---|
| Nom, prénom | DCP standard | identification commerciale | exécution contrat / intérêt légitime |
| Email | DCP standard | communication, livraison | exécution contrat |
| Téléphone | DCP standard | logistique livraison | exécution contrat |
| Ville | DCP standard | logistique livraison | exécution contrat |
| Adresse IP (formulaires) | DCP technique | sécurité (rate-limit, audit) | intérêt légitime |
| Métadonnées formulaire (UTM, referer) | DCP indirecte | analyse marketing | consentement |

Pas de données sensibles (santé, opinions, données biométriques).

## Bases légales par finalité

| Finalité | Base légale principale | Note |
|---|---|---|
| Traiter une commande | exécution du contrat | art. 6.1.b RGPD |
| Répondre à un message contact | mesures précontractuelles | art. 6.1.b RGPD |
| Newsletter | consentement | art. 6.1.a RGPD ; opt-in clair |
| Analyses marketing | consentement (cookies) | banner + opt-in |
| Sécurité (logs, rate-limit) | intérêt légitime | art. 6.1.f RGPD |
| Webhooks vers Slack/CRM | exécution du contrat | sous-traitants — DPA signé |

## Responsabilités

| Rôle | Personne |
|---|---|
| Responsable de traitement | FemiGlow (entité juridique) |
| DPO (point de contact) | dpo@femiglow.ma — fondatrice initialement (v1) |
| Sous-traitants | Vercel, Neon, Sentry (le cas échéant), service email transactionnel |

## Sous-traitants

| Sous-traitant | Donnée traitée | Localisation | Conformité |
|---|---|---|---|
| Vercel | hébergement, logs | régions globales | DPA Vercel (GDPR-compliant) |
| Neon | DB Postgres | eu-central-1 (Francfort) | DPA Neon, sous-traitant AWS |
| Sentry | erreurs (PII redactée) | EU | DPA Sentry |
| Slack/Make/etc. | payloads webhook (potentiellement PII) | variable | l'admin sélectionne ses propres webhooks |

Registre complet dans `docs/admin/compliance/registre-traitements.md`
(à constituer v1.1).

## Obligations couvertes

### Information transparente (art. 12-14 RGPD, art. 5 loi 09-08)

- Page `/confidentialite` listant : finalités, bases légales, durées,
  destinataires, droits, contact DPO.
- Lien dans pied de page de toutes les pages publiques.
- Lien à proximité de **chaque** formulaire avec checkbox de
  consentement explicite.

### Consentement (art. 7 RGPD, art. 4 loi 09-08)

- Case **non pré-cochée** sur formulaires.
- `consent_at` stocké en DB pour preuve.
- Possibilité de retirer le consentement aussi facilement que de le donner.

### Droits des personnes

| Droit | Procédure v1 |
|---|---|
| Accès | demande email à dpo@femiglow.ma → export manuel sous 30j |
| Rectification | idem |
| Effacement | idem (cf. [`../06-data/retention-policy.md`](../06-data/retention-policy.md#droit-à-leffacement)) |
| Limitation | demande email → flag manuel `do_not_process` (v1.1) |
| Portabilité | export CSV envoyé chiffré sous 30j |
| Opposition | retrait consentement newsletter immédiat ; opposition autres traitements traitée au cas par cas |
| Décision automatisée | aucune (pas de scoring auto) |

### Notification de violation (art. 33 RGPD, art. 23 loi 09-08)

| Délai | Cible |
|---|---|
| 72 heures | CNDP (Maroc) en cas de risque pour les personnes |
| 72 heures | CNIL si personnes UE concernées |
| sans délai | personnes concernées si risque élevé |

Runbook : [`incident-response.md`](./incident-response.md).

### DPIA (analyse d'impact)

Non requis v1 — traitement non listé en risque élevé. À refaire si :
- ajout de tracking comportemental,
- ajout de profiling automatisé,
- volume > 100k personnes.

## Transferts hors UE

Neon : `eu-central-1` (Francfort, UE). Pas de transfert hors UE pour la DB.

Vercel : régions multiples (potentiellement US pour edge). Couvert par
**clauses contractuelles types** (CCT/SCC) du DPA Vercel.

Documenter clairement dans la politique de confidentialité.

## Loi 09-08 — Spécificités Maroc

### Déclaration / autorisation CNDP

| Cas | Démarche |
|---|---|
| Traitement standard (commercial) | déclaration simple |
| Données sensibles | autorisation préalable |
| Transfert hors Maroc | autorisation préalable si pays sans niveau adéquat |

V1 : déclaration simple à effectuer **avant mise en production**.
Numéro de récépissé à archiver.

### Affichage du numéro

Numéro CNDP affiché en pied de page conformément à la loi 09-08.

## Conservation

Cf. [`../06-data/retention-policy.md`](../06-data/retention-policy.md).
Aligné sur le principe de minimisation : 18 mois post-relation
commerciale, 36 mois pour audit, 36 mois pour comptabilité.

## Cookies (côté site public)

Pas dans le scope direct admin, mais à mentionner :
- Cookie session admin : strictement nécessaire, pas de consentement requis.
- Cookies analytics, marketing : consentement opt-in (banner conforme CNIL/CNDP).

## Audit annuel

Revue annuelle de conformité par le DPO. Checklist :
- [ ] Registre des traitements à jour ?
- [ ] DPA sous-traitants à jour ?
- [ ] Politique de confidentialité à jour ?
- [ ] Procédures effacement / accès testées ?
- [ ] Aucune notification de violation manquée ?
- [ ] Audit logs accessibles et conservés ?

## Tests

| Type | Fichier |
|---|---|
| E2E | `e2e/consent-form.spec.ts` (vérifie checkbox non pré-cochée, lien politique) |
| E2E | `e2e/privacy-page.spec.ts` (vérifie présence des sections obligatoires) |
| Manuel | revue trimestrielle DPO |
