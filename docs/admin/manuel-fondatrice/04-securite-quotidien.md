# 4. Sécurité au quotidien

Quelques règles simples pour garder la console saine sans devenir
ingénieure sécurité.

## Mot de passe

- **Ne le partage avec personne**, même pas l'équipe technique.
- **Change-le tous les 6 mois** (rappel dans le calendrier).
- **Stocke-le dans 1Password**. Pas dans un Notes, pas dans Telegram.

Si tu suspectes une fuite, va à
[En cas de problème](05-en-cas-de-probleme.md) §1.

## Ordinateur et réseau

- Verrouille toujours ton écran quand tu t'éloignes (raccourci
  `⌘ + ⌃ + Q` sur macOS).
- Évite de te connecter depuis un Wi-Fi public (cybercafé, aéroport)
  sans VPN.
- N'enregistre pas le mot de passe dans le navigateur sur un poste
  partagé.

## Secrets webhook

Les secrets HMAC ne sont **affichés qu'une fois**, à la création ou à la
rotation. C'est volontaire : si quelqu'un accède à la console plus tard,
il ne peut pas les récupérer. La console les stocke chiffrés
(AES-256-GCM).

Bonnes pratiques :

- Note-les dans 1Password à côté de l'URL de l'endpoint.
- Rotationne-les **tous les 6 mois** (calendrier), ou immédiatement si
  tu suspectes une fuite côté outil destinataire.

## Accès physique aux écrans

Quand tu es en réunion ou en café, **ne laisse pas la console
ouverte sur un grand écran** que des personnes peuvent lire de loin :
les emails et téléphones des leads sont des données personnelles.

## Ce que la console fait pour toi (sans rien te demander)

- **Bloque les attaques par force brute** sur la connexion (5
  tentatives → blocage 15 min).
- **Refuse d'envoyer un webhook vers une IP privée** (anti-SSRF).
- **Chiffre les secrets** au repos.
- **Loggue chaque action sensible** (connexion, changement de statut,
  rotation secret) dans la table `audit_events`.
- **Envoie une alerte Sentry** si un webhook échoue 5 fois d'affilée.
