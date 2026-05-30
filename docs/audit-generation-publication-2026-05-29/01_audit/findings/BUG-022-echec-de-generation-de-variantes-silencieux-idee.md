# BUG-022 — Echec de generation de variantes silencieux: idee creee sans variantes, sans erreur a l'operateur

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | create-ui-flow |
| **Composant** | `CreateWorkspace.tsx onCreated (lignes 195-228)` |
| **Mode mock** | `partial` |
| **Mode live** | `partial` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Si la generation des variantes echoue (budget_exceeded, provider down), l'operateur voit une erreur claire et peut reessayer.

## État réel vérifié
Dans onCreated: si res.ok est false, le bloc ne fait RIEN (aucun toast, aucun draft); le catch (ligne 226) est vide avec commentaire 'Generation failure is not blocking — user can retry.'. L'operateur se retrouve avec une idee creee mais zero variante affichee et aucun feedback. Etat UI bloque sans explication.

## Écart
Aucune remontee d'erreur ni d'etat de chargement/echec pour l'etape generate apres creation d'idee.

## Cause racine
CreateWorkspace.tsx:201 'if (res.ok) {...}' sans branche else; :226 catch {} vide.

## Preuves
- CreateWorkspace.tsx:201 if (res.ok) { ... } — pas de else
- CreateWorkspace.tsx:226 } catch { // Generation failure is not blocking — user can retry. }
- budget endpoint: dailyBudgetCents=500 — un depassement renverrait budget_exceeded non gere ici

## Reproduction
1. /create avec budget epuise ou provider en erreur. 2. Creer une idee. 3. L'idee est creee mais aucune variante n'apparait, aucun toast d'erreur. L'operateur est bloque sans savoir pourquoi.

## Piste de correction
Ajouter une branche d'erreur: toast.error(formatError(json.error)) sur !res.ok et dans le catch; afficher un etat 'echec de génération - réessayer' avec bouton retry.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Vérifié ligne par ligne dans CreateWorkspace.tsx onCreated: :196-200 fetch ideas/:id/generate; :201 'if (res.ok) {...}' sans branche else; :226-228 'catch { // Generation failure is not blocking — user can retry. }' vide, aucun toast. En cas de !res.ok (ex. budget_exceeded -> HttpError 429) ou d'exception réseau, l'idée est créée (IntentionForm a déjà POST /ideas avec succès) mais aucune variante n'apparaît et aucun feedback n'est donné. Pas d'état loading/échec pour l'étape generate. Confirmé.
- **Contre-preuve / nuance :** Atténuant: en staging aujourd'hui la génération texte ne lève jamais d'erreur (generation.ts dégrade en fallback template, cf. finding #3), donc res.ok est quasi toujours true et des variantes apparaissent (template). Le scénario d'échec silencieux nécessite un vrai échec serveur (budget_exceeded, 5xx) — réel mais non déclenché par l'état env actuel. Le défaut de code (catch vide + pas de else) est néanmoins indéniable.

> Réf. registre : `bug-register.csv` ligne `BUG-022` · matrice : `gap-matrix.csv`.
