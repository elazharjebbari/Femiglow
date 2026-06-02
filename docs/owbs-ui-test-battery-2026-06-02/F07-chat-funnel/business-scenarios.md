# F07 — Scénarios métier réalistes (chat)

## BM-F07-1 — Salma laisse ses coordonnées via le chat, réseau lent
**Parcours :** le chat propose de laisser un contact → Salma remplit → soumet
(réseau lent).
**Attendu :** confirmation **immédiate** (« Merci, on vous rappelle ») ; en coulisse,
le lead part et le `generate_lead` valorisé (prix du kit) est émis quand la réponse
arrive.
**Bug recherché :** ROAS faussé (generate_lead sans valeur), ou gel d'1 confirmation.

## BM-F07-2 — Échec réseau après confirmation optimiste
**Attendu :** Salma a vu « Merci » ; si l'envoi échoue, on ne lui ré-affiche **pas**
une erreur anxiogène (best-effort) ; le serveur dédupe si un retry aboutit.
**Bug recherché :** message d'erreur après un « Merci » déjà affiché (incohérence UX).

## BM-F07-3 — Bot tente de spammer le formulaire chat
**Attendu :** honeypot `_phone_alt` → succès silencieux, **aucun** lead créé.

## BM-F07-4 — Cohérence attribution (transverse F14)
**Attendu :** le lead chat valorisé alimente correctement `generate_lead` et le pont
lead→Meta Purchase (cookie), sans doublon avec un achat ultérieur.
