# 07 — Sécurité & conformité

Posture sécurité de l'admin FemiGlow : modèle de menaces, contrôles
techniques, chiffrement, conformité RGPD et loi marocaine 09-08, headers
HTTP, audit trail, réponse à incident.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`threat-model.md`](./threat-model.md) | Modèle STRIDE pour chaque flux critique |
| [`controles.csv`](./controles.csv) | Inventaire des contrôles (préventifs, détectifs, correctifs) |
| [`chiffrement.md`](./chiffrement.md) | TLS, at-rest, secrets, rotation des clés |
| [`rgpd-loi-09-08.md`](./rgpd-loi-09-08.md) | Conformité RGPD UE + loi marocaine 09-08 |
| [`headers-csp.md`](./headers-csp.md) | Content-Security-Policy + autres headers |
| [`audit-trail.md`](./audit-trail.md) | Quoi loguer, conservation, accès |
| [`incident-response.md`](./incident-response.md) | Runbook : détection → confinement → notification |

## Posture

| Principe | Application |
|---|---|
| Defense in depth | TLS + WAF Vercel + auth + rate-limit + audit |
| Least privilege | un seul rôle admin v1, aucune impersonation |
| Secure by default | tous les cookies HttpOnly/SameSite, CSP strict |
| Fail closed | erreur DB ⇒ refus, pas de bypass |
| Auditable | tout évènement sensible journalisé |
| Privacy by design | minimisation DCP, redaction logs |

## Menaces hors scope (v1, à reconsidérer v2)

- **2FA** : v1 mot de passe seul (faible volume admin, mots de passe forts imposés). v2 : TOTP.
- **SSO** : pas de besoin v1.
- **WAF custom** : on s'appuie sur les protections Vercel Edge.
- **DDoS layer 7 sophistiqué** : Vercel + rate-limit applicatif suffisent au volume FemiGlow.
- **Pen-test annuel** : non v1 (budget). v2 si justifié.
