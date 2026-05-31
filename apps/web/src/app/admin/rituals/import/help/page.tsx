import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { renderMarkdown } from '@/lib/markdown/render';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Aide — Import Rituels' };

const HELP_MARKDOWN = `# Aide à l'import des rituels partagés

L'import permet d'ajouter en lot des témoignages d'initiées à partir
d'un fichier source (CSV, JSON, JSONL, TSV). Tous les rituels créés
passent en statut **PENDING** et nécessitent une modération avant
publication.

## Workflow général

1. **Source** — Choisir le format de votre fichier et télécharger un
   modèle si besoin.
2. **Contenu** — Coller le contenu ou uploader le fichier (5 Mo max,
   500 lignes max).
3. **Aperçu** — Vérifier le mapping des colonnes, la qualité des lignes,
   ajuster si besoin.
4. **Confirmer** — Définir l'inclusion des avertissements et la note interne.
5. **Rapport** — Voir le batch ID + résumé, accéder à la queue de modération.

## Champs canoniques

| Champ            | Obligatoire | Description |
| ---------------- | ----------- | ----------- |
| body             | **Oui**     | Texte du témoignage (50–600 caractères). |
| wouldRecommend   | **Oui**     | \`oui\` / \`hesite\` / \`non\` (synonymes acceptés : *yes*, *hésite*, *no*, *pas pour moi*…). |
| ritualTags       | Non         | Liste séparée par \`,\` ou \`;\` parmi le catalogue (ongles-plus-lisses, halal, etc.). |
| authorFirstName  | Non         | Prénom (1–30 caractères). Vide → signature \`Une initiée\`. |
| authorCity       | Non         | Ville Maroc. Inconnue → mappée sur \`Autre\` avec avertissement. |
| initiatedSince   | Non         | Format \`YYYY-MM\`. Tolère \`YYYY-MM-DD\` et \`MM/YYYY\`. |
| isAnonymous      | Non         | \`true\` / \`false\` (1/0/oui/non/yes/no acceptés). |
| language         | Non         | \`fr\` (défaut) ou \`ar\`. |
| productKey       | Non         | Défaut \`pack-femiglow\`. |

## Formats supportés

### CSV (point-virgule)

\`\`\`
body;wouldRecommend;ritualTags;authorFirstName;authorCity
"Trois mois et l'ongle...";oui;ongles-plus-lisses,plus-de-casse;Amal;Rabat
\`\`\`

UTF-8 obligatoire (BOM toléré). Quotes doubles autorisées avec
échappement \`""\` pour les guillemets internes.

### JSON

\`\`\`json
{
  "version": 1,
  "rituals": [
    { "body": "...", "wouldRecommend": "oui", "ritualTags": ["halal"] }
  ]
}
\`\`\`

Format array racine \`[ {...}, {...} ]\` également accepté.

### JSONL

Un objet JSON valide par ligne, pas de virgule séparatrice, pas
d'array englobant. Plus tolérant pour gros volumes.

## Mapping des colonnes

Si vos en-têtes ne correspondent pas exactement aux champs canoniques,
l'interface détecte automatiquement les synonymes courants (\`Témoignage\`
→ \`body\`, \`Prénom\` → \`authorFirstName\`, etc.). Vous pouvez surcharger
le mapping dans l'aperçu via le panel **Mapping colonnes**.

Les champs obligatoires (\`body\`, \`wouldRecommend\`) doivent être mappés.

## Auto-flags d'avertissement

Lors de l'analyse, certaines lignes sont marquées **WARNING** :

- \`tag_unknown\` — tag absent du catalogue (ignoré).
- \`city_unknown\` — ville absente, mappée sur \`Autre\`.
- \`date_normalized\` — format date adapté automatiquement.
- \`tags_truncated\` — plus de 3 tags, tronqué.

Les avertissements n'empêchent pas la publication. Les vraies erreurs
(body manquant, signal invalide) excluent la ligne du commit.

## Modération après import

Les rituels importés portent les flags \`import_<code>\` (ex.
\`import_tag_unknown\`) pour faciliter le filtrage dans la queue. Le
\`source\` est \`import_csv\` ou \`import_json\`, et \`importBatchId\` lie
chaque rituel à son batch (utile pour audit ou suppression groupée).

## Limites

- Fichier : 5 Mo maximum.
- Lignes : 500 maximum par batch.
- Photos : non encore importables via cet outil — pour joindre des
  photos, soumettre les rituels via l'admin individuellement après
  import ou écrire à info@femiglow-maroc.com.

## Sécurité

- Toute photo passe ensuite par la vision ML (détection visages
  frontaux). Pour les rituels importés sans photos, aucun ML n'est
  déclenché.
- Le contenu original est conservé (\`body_original\`) pour audit.
- Aucun rituel n'est publié sans approbation humaine.
`;

export default async function AdminRitualsImportHelpPage() {
  const session = await requireAdmin('/admin/rituals/import/help');
  const { html } = await renderMarkdown(HELP_MARKDOWN);

  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Aide — Import de rituels
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Documentation complète des formats, champs et workflow.
          </p>
        </div>
        <Link
          href="/admin/rituals/import"
          className="border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
        >
          ← Retour à l'import
        </Link>
      </header>
      <article
        className="prose prose-stone max-w-3xl"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </AdminShell>
  );
}
