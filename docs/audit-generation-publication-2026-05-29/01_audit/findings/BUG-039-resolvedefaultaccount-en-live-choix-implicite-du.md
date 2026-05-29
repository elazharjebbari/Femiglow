# BUG-039 — resolveDefaultAccount: en live, choix implicite du PREMIER compte Postiz actif (risque de publier sur le mauvais compte client)

| | |
|---|---|
| **Sévérité** | `major` (ajustée depuis critical) |
| **Domaine** | publication-postiz |
| **Composant** | `src/lib/social-publishing/admin-service.ts:566-612 resolveDefaultAccount` |
| **Mode mock** | `n/a` |
| **Mode live** | `untested` |
| **Verdict vérification** | `adjusted` (confiance: medium) |

## État supposé (code + tests)
En mode live, sans accountId explicite, le système publie sur le compte client correct pour la plateforme.

## État réel vérifié
En live + plusieurs comptes Postiz actifs + sans pin, resolveDefaultAccount choisit le compte Postiz le plus récemment mis à jour (desc(updatedAt)), pas un choix aléatoire. Le flux v1 (SocialPublishingPanel) impose un sélecteur de compte explicite (accountId transmis) et n'est PAS affecté; seul le flux v2 (PublishActionGroup) n'envoie aucun accountId et retomberait sur ce fallback. Exposition actuelle nulle car dry_run par défaut; redevient critique si live est activé sans pin et via l'UI v2.

## Écart
Aucune désambiguïsation forcée: l'opérateur croit publier sur un compte, le système en choisit un autre. En dry_run c'est sans conséquence; en live c'est une publication sur le mauvais compte Instagram client.

## Cause racine
Fallback 'premier compte actif' sans pin obligatoire ni sélection explicite imposée côté UI; SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID non configuré.

## Preuves
- admin-service.ts:607-611: return eligible.find(provider==='postiz') ?? eligible.find(provider!=='dry_run') ?? null
- /proc/3603360/environ: SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID non défini
- Probe GET /api/admin/social/accounts: 4 comptes postiz/instagram actifs simultanément => ambiguïté réelle
- PublishActionGroup.tsx:84-88: le body POST n'envoie PAS d'accountId (JSON.stringify({})) => accountId toujours undefined => fallback implicite

## Reproduction
En live, publier depuis l'UI /create sans sélecteur de compte => accountId undefined => resolveDefaultAccount renvoie le 1er Postiz actif, potentiellement pas celui voulu.

## Piste de correction
Rendre la sélection de compte explicite/obligatoire dans l'UI publish (PublishActionGroup n'envoie aucun accountId), ou imposer SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID en prod et échouer (invalid_state) si live + plusieurs comptes + pas de pin.

## Vérification adversariale
- **Verdict :** adjusted (confiance medium)
- **Analyse :** Le fallback 'premier compte Postiz actif' existe (admin-service:607-611) et la v2 PublishActionGroup n'envoie pas d'accountId (body JSON.stringify({}) sauf schedule). MAIS deux corrections: (1) l'UID v1 SocialPublishingPanel.tsx DISPOSE d'un sélecteur de compte (<select> L142-154) et ENVOIE bien accountId (L360/374/386) — donc le chemin opérateur historique désambiguïse explicitement; seul le flux v2 /create est concerné. (2) L'ordre n'est PAS 'non déterministe garanti': listSocialAccounts trie par desc(updatedAt) (repository.ts:195), donc le 'premier' postiz est le plus récemment mis à jour — déterministe mais sans rapport avec l'intention opérateur, et instable après chaque re-sync. Risque réel mais conditionné à live (non atteignable aujourd'hui, SOCIAL_PUBLISHING_MODE=dry_run) + plusieurs comptes + pas de pin + UI v2 sans sélecteur. critical surévalue: la conséquence (mauvais compte) est sérieuse mais l'exposition actuelle est nulle (dry_run) et la voie principale v1 désambiguïse.
- **Contre-preuve / nuance :** SocialPublishingPanel.tsx:142-154 (select compte) + :360,374,386 (accountId envoyé). repository.ts:195 orderBy(desc(updatedAt)). /proc/3603311/environ: SOCIAL_PUBLISHING_MODE non défini (dry_run), SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID non défini. PublishActionGroup.tsx:83 body=JSON.stringify({}).

> Réf. registre : `bug-register.csv` ligne `BUG-039` · matrice : `gap-matrix.csv`.
