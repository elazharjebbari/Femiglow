# N05 — Scénarios (Gherkin FR)

Persona : **Karim**, opérateur, et le **système** qui consomme `navDefault` au démarrage.
Niveau test pur (couche U) : les scénarios décrivent le contrat structurel, pas une UI.

## Scénario N05-S1 — Les defaults de navigation sont structurellement sains (happy)
Contexte: l'application démarre sans ligne `nav` en base ; elle s'appuie sur `navDefault`.
Étant donné la constante `navDefault` de `admin-config/defaults.ts`
Quand on la valide avec `navSchema.safeParse`
Alors le parsing réussit (`success === true`)
Et les 11 clés sont distinctes
Et un item `coupons` existe avec label « Coupons », href `/admin/coupons`, icône `tag`, position 9
Et chaque `position` égale son index (0,1,2,…,10).

## Scénario N05-S2 — Une clé dupliquée serait rejetée (edge superRefine)
Contexte: un défaut hypothétique introduit deux items avec la clé `dashboard`.
Étant donné la fixture `dupKey` (deux items `dashboard`)
Quand on la valide avec `navSchema`
Alors le parsing échoue
Et une issue porte le message « Clé "dashboard" dupliquée. »
Et ce test garantit que le `superRefine` d'unicité est bien actif (sinon le failsafe N06 laisserait
passer des clés en double).

## Scénario N05-S3 — Une clé non kebab-case serait rejetée (edge regex)
Contexte: quelqu'un saisit `Leads` (majuscule) comme clé.
Étant donné la fixture `badKey` (key = « Leads »)
Quand on la valide
Alors le parsing échoue avec « Clé invalide (kebab-case). »
Et ceci verrouille la contrainte `KEY_REGEX` réutilisée par l'éditeur (N07) côté validation client.

## Scénario N05-S4 — Un champ inconnu dans un item serait rejeté (edge strict)
Contexte: un payload contient `{ key, label, href, icon, position, extra: true }`.
Étant donné la fixture `extraField`
Quand on la valide
Alors le parsing échoue (objet `.strict()`)
Et cela protège la base contre des payloads enrichis hors schéma (cohérence avec le PATCH N09).
