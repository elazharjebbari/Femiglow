# Communication plan

## 1. Audiences

| Audience | Description | Canal préféré |
|---|---|---|
| **Lead dev** | Architecte technique | Slack DM + GitHub PR |
| **Younes** | Dev exécutant | Slack DM + GitHub |
| **Amal** | Marketing Manager (utilisatrice primaire) | Slack + email + session live |
| **Aïcha** | CMO (décisionnaire) | Email + slide deck |
| **Équipe technique élargie** | Autres devs, SRE | Slack canal `#tech-tracking-plan` |
| **Équipe marketing** | Personnes pouvant être impactées | Email + canal `#marketing` |
| **Stakeholders externes** | DBA, prestataires | Email |

## 2. Messages par phase

### Phase 0 — Discovery

| Quand | Audience | Message | Canal |
|---|---|---|---|
| J-7 | All stakeholders | Annonce projet : objectifs, bénéfices, timeline globale | Email + meeting kickoff |
| J-3 | Lead + Younes | Doc conceptuelle prête pour review | Slack |
| J-1 | Amal + Aïcha | Doc à valider avant fin de semaine | Email |
| J0 | All | GO décidé, sprints démarrent {date} | Email + slack |

### Phase 1 — Build (6 semaines)

| Quand | Audience | Message | Canal |
|---|---|---|---|
| Lundi chaque sprint | Lead + Younes | Sprint planning + objectifs sprint | Standup |
| Vendredi chaque sprint | Lead + Younes | Démo sprint + revue | Demo meeting |
| Vendredi sprints 3+ | Amal | "Le nouveau tracking est en cours, démo possible si tu veux le voir" | Slack |
| Fin sprint 6 | All | "Build complet, validation prévue {date}" | Email |

### Phase 2 — Validate (1 semaine)

| Quand | Audience | Message | Canal |
|---|---|---|---|
| Lundi | All | Validation démarrée, accès staging pour Amal | Slack |
| Mardi-Mercredi | Amal | Onboarding live + accompagnement UAT | Session live (Meet) |
| Jeudi | Lead + Younes | Test ultime d'intégration en cours | Slack |
| Vendredi | All | Validation complète, GO release {date} | Email |

### Phase 3 — Migrate (T-3 à T+1 day)

| Quand | Audience | Message | Canal |
|---|---|---|---|
| T-3 jours | All admins + équipe marketing | "Migration tracking le {date} 14h-15h. Pas d'action requise. Le tracking continuera de fonctionner pendant cette fenêtre." | Email |
| T-1 jour | All | Reminder | Slack |
| T0 - 5 min | Tech élargie | Migration en cours | Slack `#tech-tracking-plan` |
| T0 + 1h | All | Migration terminée. Nouveau système activé progressivement à partir de demain. | Email |
| T0 + 1d | Amal | Rappel onboarding session | Email |

### Phase 4 — Release (1 semaine)

| Quand | Audience | Message | Canal |
|---|---|---|---|
| J+0 | Tech | "Younes utilise le nouveau système, monitoring actif" | Slack |
| J+1 | Amal | Onboarding live (30 min) | Meet |
| J+2 | All admins | "Le nouveau tracking est en ligne pour tous ! Tutoriel : [link]" | Email + Slack |
| J+2 | Marketing | "Aucune action requise de votre côté, mais voici comment vérifier le statut de votre tracking : [link]" | Email |
| J+7 | All | "Rétrospective 7j : tout va bien. Feedback bienvenu." | Slack |

### Phase 5 — Cleanup

| Quand | Audience | Message | Canal |
|---|---|---|---|
| T+30j | Tech | "Code legacy frontend supprimé" | Slack PR |
| T+60j | Tech | "Plus de trafic legacy, on prépare le drop" | Slack |
| T+87j | All | "Nettoyage final dans 3 jours, rien à faire" | Email |
| T+90j | Tech | "Drop tables effectué. Projet 100% complete." | Slack + tag git |

## 3. Templates

### Email kickoff (Phase 0)
```
Subject: [GO] Projet Tracking Plan v2 — refonte unifiée

Bonjour,

Nous lançons le projet "Tracking Plan v2", refonte unifiée de l'administration
tracking pour FemiGlow Maroc.

Pourquoi :
- Élimine la confusion entre les 2 JSON GTM actuels
- Réduit de 15min à 5min le temps "changer un Pixel" pour Amal
- Garantit zéro placeholder en production

Timeline :
- Build : 6 sprints ({date début} → {date fin})
- Validation : 1 semaine
- Release : J+45

Stakeholders et rôles :
- Younes : implémentation
- Lead : architecture + review
- Amal : validation UX + UAT
- Aïcha : sign-off produit

Vous pouvez consulter le document conceptuel ici : [link]
Et le dossier technique complet ici : [link]

Standup quotidien démarrent lundi {date} 9h30.
Demo de fin de sprint chaque vendredi 16h.

Pour toute question : Slack canal #tech-tracking-plan.

Merci,
{Lead dev}
```

### Email migration T-3 (Phase 3)
```
Subject: [INFO] Migration tracking prévue {date} 14h-15h

Bonjour,

Une migration de la base de données tracking est prévue :

📅 Date : {date}
🕐 Heure : 14h00 - 15h00 (fenêtre)
✅ Impact utilisateur : aucun, le tracking continue à fonctionner normalement.
🛠️ Action requise : aucune.

Pourquoi : passage au nouveau système unifié (cf. annonce du {date}).

Le nouveau système ne sera activé que progressivement à partir de demain.
Amal aura une session live d'onboarding mardi.

En cas de question : Slack canal #tech-tracking-plan.

Merci,
{Lead dev}
```

### Email rollout J+2 (Phase 4)
```
Subject: [LANCEMENT] Le nouveau tracking est en ligne 🎉

Bonjour,

C'est officiel : le nouveau système de tracking est en ligne pour tous les admins.

Ce qui change pour vous :
- Plus simple : 1 seule page pour gérer pixels, events, providers.
- Plus sûr : validation avant publication, zéro placeholder possible.
- Plus rapide : 5 min au lieu de 15 pour les opérations courantes.

Où ?
👉 /admin/tracking

Comment démarrer ?
1. Allez sur le lien ci-dessus.
2. Le tutoriel s'ouvre automatiquement la première fois.
3. Suivez les 5 popovers (2 minutes).

Besoin d'aide ?
- Tutoriel intégré : bouton "?" en haut.
- Documentation : [link]
- Question urgente : Slack #tech-tracking-plan ou DM {Younes}.

L'ancien système reste accessible via URL legacy pendant 30 jours, mais les nouvelles
fonctions ne sont que sur le nouveau.

Merci à Younes pour l'implémentation et à Amal pour les tests utilisateurs !

{Lead dev}
```

## 4. Style et ton

### Principes
- **Clair > exhaustif**. Si le destinataire lit en 30 secondes, il doit savoir l'essentiel.
- **Bénéfices avant features**. "Plus simple" plutôt que "TrackingPlan unifié".
- **Action concrète si nécessaire**. "Rien à faire" ou "Action requise : X".
- **Personnalisé**. Amal n'a pas besoin de "Drizzle migration completed". Tech élargie oui.
- **Inclusif**. Pas de jargon non expliqué dans les emails grand public.

### Anti-patterns
- "Suite à un changement infrastructurel… " (jargon corporate).
- "Veuillez prendre acte" (ton froid).
- Emails > 300 mots pour les non-techs.
- Annonce sans timeline claire.

## 5. Suivi

- Chaque communication est trackée dans un Google Sheet partagé.
- Délivrabilité vérifiée (qui a ouvert, qui a cliqué le tutoriel).
- Feedback collecté à J+7 et J+30 post-release.

## 6. Escalation

Si silence inattendu d'une partie prenante (ex : Amal ne répond pas à 2 messages consécutifs) :
1. Slack DM direct par Lead.
2. Si silence 24h : Meet 15 min impromptu.
3. Si silence 48h : escalade à direction.

L'objectif est de ne **jamais** laisser un blocage tranquille pendant > 48h.
