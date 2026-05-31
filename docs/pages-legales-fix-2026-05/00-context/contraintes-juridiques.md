# Contraintes juridiques — cadre Maroc

> ⚠️ **Ce document n'est PAS un avis juridique**. Avant tout déploiement, faire valider par un juriste marocain.

## 1. Mentions légales obligatoires (Loi 04-99 Code Commerce)

Pour un commerçant marocain (personne physique ou morale) opérant un site web :

| Mention | Obligatoire ? | Notes |
|---|---|---|
| Dénomination sociale (nom légal) | ✅ Oui | Le nom commercial peut différer du nom légal |
| Forme juridique (SARL, SA, EI…) | ✅ Oui | |
| Capital social | ⚠️ Si société | Pas pour EI/auto-entrepreneur |
| Numéro RC (Registre Commerce) | ✅ Oui | Format `Ville-NNNNN` |
| Numéro ICE (15 chiffres) | ✅ Oui | Obligatoire depuis 2016 |
| Adresse du siège social | ✅ Oui | Peut être adresse du local commercial |
| Email contact | ✅ Oui | |
| Téléphone | ⚠️ Recommandé | Pas strictement obligatoire dans loi 04-99 |
| Directeur publication | ⚠️ Si éditeur de contenu | Loi 88-13 sur la presse |
| Patente / Taxe pro | ⚠️ Cas spéciaux | Pas systématique |
| Numéro TVA | ⚠️ Si assujetti | |
| Hébergeur (nom + adresse) | ✅ Oui | LOI 53-05 sur l'échange électronique |

## 2. Marges de manœuvre pour anonymisation

### 2.1 Ce qui PEUT être "info sur demande"

À valider par juriste, mais probablement acceptable :
- ✅ **Capital social** (si EI, n/a)
- ✅ **Adresse siège** (si différente de l'adresse opérationnelle commerciale)
- ⚠️ **Directeur publication** (acceptable si email contact est fourni)
- ⚠️ **Patente / TVA** (pas systématiquement requis)

### 2.2 Ce qui DOIT rester public

- ❌ **ICE** (obligation légale stricte)
- ❌ **Forme juridique** (visible dans le RC public)
- ❌ **Hébergeur** (transparence requise)

### 2.3 Compromis possible : RC

Le RC est nécessaire pour vérification, mais on peut le présenter comme :
```
Société immatriculée au Maroc — RC disponible sur demande à legal@femiglow-maroc.com
```

Risque : un client/concurrent pourrait demander → l'entreprise s'engage à répondre sous N jours ouvrés (à inscrire dans la politique légale).

## 3. Loi 09-08 (Protection données — équivalent GDPR Maroc)

Pour le DPO / délégué :
- ✅ Email DPO **obligatoire** si l'entreprise traite des données personnelles à grande échelle
- ✅ Numéro déclaration CNDP **obligatoire** si fichier déclaré
- ⚠️ DPO physique pas obligatoire si entreprise < 250 employés

→ Garder `DPO_EMAIL` et `CNDP_DECLARATION_REF` publics.

## 4. Recommandations finales

| Variable | Recommandation publique | Recommandation "info sur demande" |
|---|---|---|
| `COMPANY_NAME` | ✅ Garder | — |
| `COMPANY_FORM` | ✅ Garder | — |
| `COMPANY_RC` | ⚠️ Validation juriste | ⚠️ Compromis : "RC disponible sur demande" |
| `ICE` | ✅ Doit rester | ❌ |
| `COMPANY_CAPITAL` | ⚠️ Si SARL/SA | ✅ Si EI |
| `COMPANY_ADDRESS` | ⚠️ Adresse postale commerciale | ✅ Adresse siège peut être sur demande |
| `DIRECTOR_NAME` | ⚠️ Si éditeur de contenu | ✅ Sinon "l'équipe éditoriale" |
| `COMPANY_EMAIL` | ✅ Garder | — |
| `COMPANY_PHONE` | ⚠️ Recommandé | ✅ Possible "support@..." |
| `HOST_*` | ✅ Garder | ❌ |
| `DPO_EMAIL` | ✅ Garder | ❌ |
| `CNDP_DECLARATION_REF` | ✅ Garder si déclaré | ❌ |

## 5. Wording recommandé pour anonymisation

### Bloc générique

```md
## Identité de l'éditeur

Le site **FemiGlow** ({{SITE_URL}}) est édité au Maroc.

| | |
|---|---|
| Nom légal | {{COMPANY_NAME}} |
| Forme juridique | {{COMPANY_FORM}} |
| ICE | {{ICE}} |
| Email contact | {{CONTACT_EMAIL}} |
| Téléphone support | {{CONTACT_PHONE}} |

Pour toute demande relative à notre **identité juridique complète**
(numéro RC, adresse de siège social, capital social, directeur de
la publication), merci de nous contacter à **legal@femiglow-maroc.com**.

Nous répondons sous **5 jours ouvrés** à toute demande motivée.

## Hébergement

Site hébergé par {{HOST_NAME}}, {{HOST_ADDRESS}}.
Contact : {{HOST_CONTACT}}.
```

### Bloc pour info sensible cachée

```md
## RC et adresse de siège

Pour toute demande relative à notre numéro de Registre du Commerce
ou à l'adresse de notre siège social, merci d'écrire à
**legal@femiglow-maroc.com** en précisant le motif de votre demande.

Nous répondons à toute demande légitime (clients, fournisseurs,
autorités) sous **5 jours ouvrés**.
```

## 6. Plan de validation juriste

Avant deploy, soumettre au juriste :

- [ ] Nouveau template `mentions-legales.md` v2
- [ ] Nouveau template `cgv.md` v2 (avec ICE caché ou pas ?)
- [ ] Nouveau template `confidentialite.md` v2
- [ ] Nouveau wording du bloc "info sur demande"
- [ ] Email `legal@femiglow-maroc.com` : qui répond ? sous quel délai ?
- [ ] Politique interne de réponse aux demandes

**Coût estimé** : 1h juriste (200-500 MAD selon cabinet).

## 7. Plan B si juriste rejette

Si l'approche "info sur demande" est rejetée :

- **Option C de ADR-003** : créer une page dédiée `/legal/contact-juridique` qui contient TOUTES les informations sensibles, indexable par les seuls bots search engines via une `robots.txt` permissive pour cette URL uniquement
- Risque : si page indexée → mêmes infos publiques. Mais elles ne sont plus dans `mentions-legales` qui est la page la plus consultée.

## 8. Références

- [Loi 04-99 — Code de Commerce Maroc](https://www.cci.ma/wp-content/uploads/2014/05/Loi-04-99-relative-au-code-de-commerce.pdf)
- [Loi 53-05 — Échange électronique](https://www.cnss.ma/sites/default/files/loi%2053-05.pdf)
- [Loi 09-08 — Protection données personnelles](https://www.cndp.ma/images/lois/Loi-09-08-Fr.pdf)
- [CNDP](https://www.cndp.ma/)
- [ANRT](https://www.anrt.ma/)
