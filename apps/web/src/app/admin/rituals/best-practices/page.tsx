import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

/**
 * Guide opérationnel des bonnes pratiques pour un mur d'avis qui convertit.
 *
 * Synthèse des références Kolenda (Copywriting, UX, Pricing, Luxury) appliquée
 * au cas FemiGlow et calibrée sur les benchmarks e-commerce 2026 (Trustpilot,
 * Yotpo, Baymard Institute).
 *
 * Public cible : Souheila + futures modératrices. Imprimable.
 */
export default async function AdminRitualsBestPracticesPage() {
  const session = await requireAdmin('/admin/rituals/best-practices');
  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-800">
          Guide opérationnel
        </p>
        <h1 className="mt-2 font-serif text-3xl text-stone-900">
          Un wall d'avis qui convertit
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-700">
          Les douze repères ci-dessous distillent les bonnes pratiques Kolenda
          (Copywriting · UX · Pricing · Luxury) et les benchmarks e-commerce
          maison. À utiliser comme grille de relecture avant chaque approbation.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/rituals/queue"
            className="border border-stone-300 px-3 py-1 hover:bg-stone-100"
          >
            ← Queue
          </Link>
          <Link
            href="/admin/rituals/published"
            className="border border-stone-300 px-3 py-1 hover:bg-stone-100"
          >
            Publiés
          </Link>
          <Link
            href="/admin/rituals/insights"
            className="border border-stone-300 px-3 py-1 hover:bg-stone-100"
          >
            Insights
          </Link>
          <Link
            href="/admin/rituals/best-practices"
            className="border border-emerald-700 bg-emerald-700 px-3 py-1 text-white"
          >
            Bonnes pratiques
          </Link>
        </nav>
      </header>

      <section
        aria-labelledby="numbers-title"
        className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="bp-numbers"
      >
        <h2 id="numbers-title" className="sr-only">
          Repères chiffrés
        </h2>
        <Kpi label="Conversion +" value="+27 %" hint="présence ≥ 50 avis vs aucun" />
        <Kpi label="Conversion +" value="+108 %" hint="avis avec photos UGC vs sans" />
        <Kpi label="Confiance" value="4,2–4,5" hint="note moyenne idéale (vs 4,9 = suspect)" />
        <Kpi label="Réponse" value="< 30 j" hint="taux de rejet acceptable" />
      </section>

      <Principle
        n="01"
        title="Mixez du oui, du hésite et du non."
        body={
          <>
            <p>
              Un mur 100 % cinq étoiles fait fuir. Les acheteurs avertis cherchent
              les avis 3 et 4 étoiles : ils donnent l'angle critique, l'objection,
              et permettent de mesurer le risque. Yotpo : présenter 3-5 % d'avis
              négatifs <em>augmente</em> la conversion de 15 % vs un wall épuré.
            </p>
            <p className="mt-2">
              Notre cible : <strong>~ 82 % « oui »</strong>,{' '}
              <strong>~ 12 % « hesite »</strong>, <strong>~ 6 % « non »</strong>{' '}
              parmi les publiés. Les « non » publiés démontrent la transparence —
              et la qualité du SAV quand on répond.
            </p>
          </>
        }
        sources={['Kolenda · Copywriting p.18', 'Yotpo 2024 benchmark']}
      />

      <Principle
        n="02"
        title="Les photos UGC convertissent 2× mieux."
        body={
          <>
            <p>
              Une photo d'initiée en situation (pots, mains, ambiance) double le
              taux de conversion d'une vue produit (Baymard). C'est la preuve
              sociale incarnée. Cible : <strong>30 % des avis publiés avec photo</strong>.
            </p>
            <p className="mt-2">
              Trois règles maison : (a) pas de visage frontal, (b) cadrage main /
              produit / matière, (c) lumière naturelle. La détection auto
              <code className="mx-1 rounded bg-stone-100 px-1 py-0.5 text-xs">
                face_detected
              </code>
              flag les photos à modérer. Refuser le visage, garder l'avis.
            </p>
          </>
        }
        sources={['Baymard Institute · UGC patterns', 'Kolenda · Luxury p.32']}
      />

      <Principle
        n="03"
        title="Voix : sensorielle, première personne, jamais superlative."
        body={
          <>
            <p>
              Refuser :{' '}
              <em>« Produit incroyable !!! Magique !!! Le meilleur du marché ! »</em>
              {' — '}
              flou, agressif, vide. Préférer :{' '}
              <em>
                « Trois mois et l'ongle a retrouvé sa nervure. J'ai cessé de le
                forcer. »
              </em>
            </p>
            <p className="mt-2">
              Critères pratiques : un détail concret (durée, contexte, geste), une
              première personne, un mot sensoriel. Si l'avis pourrait être copié
              sur n'importe quel produit → refuser ou demander complément.
            </p>
          </>
        }
        sources={['Kolenda · Copywriting p.5-9', 'NN/g · Voice & tone']}
      />

      <Principle
        n="04"
        title="Densité : variez les longueurs."
        body={
          <>
            <p>
              Le wall idéal mixe : 30 % d'avis longs (180-280 caractères, racontent
              un moment), 50 % moyens (90-180), 20 % courts (60-90). Le lecteur
              scanne d'abord les courts, lit les moyens, et se cale sur un long
              pour valider l'achat.
            </p>
            <p className="mt-2">
              Sur le wall public, prévoir une carte « featured » longue + 2-3 cartes
              moyennes en regard. Les courts vivent dans le drawer.
            </p>
          </>
        }
        sources={['Kolenda · UX p.41', 'Baymard · Reviews module']}
      />

      <Principle
        n="05"
        title="3 featured, pas plus, soigneusement choisis."
        body={
          <>
            <p>
              Le « top 3 » épinglé doit raconter l'histoire de la marque :{' '}
              <strong>(1)</strong> un avis qui dit la patience (rituel mesuré),{' '}
              <strong>(2)</strong> un avis qui dit la beauté du résultat,{' '}
              <strong>(3)</strong> un avis qui dit la régularité (rituel adopté).
              C'est un triptyque qui couvre les trois axes de valeur FemiGlow.
            </p>
            <p className="mt-2">
              Roulement mensuel recommandé pour éviter la pétrification éditoriale.
              Bouton{' '}
              <code className="rounded bg-stone-100 px-1 text-xs">F</code> au
              clavier dans la vue détail.
            </p>
          </>
        }
        sources={['Kolenda · Luxury p.20', 'maison FemiGlow']}
      />

      <Principle
        n="06"
        title="Vérifié visible, pas dominant."
        body={
          <>
            <p>
              Le badge « Initiée vérifiée » accroît la confiance, mais ne doit pas
              dominer visuellement (couleur sobre, kicker discret). Cible :{' '}
              <strong>≥ 60 % d'avis vérifiés</strong>. Les avis non vérifiés ne sont
              pas dévalorisés ; ils complètent.
            </p>
            <p className="mt-2">
              Vérifié = client lié à une commande payée (via le lien e-mail J+45).
              On peut aussi marquer manuellement après confirmation Souheila.
            </p>
          </>
        }
        sources={['Trustpilot · trust signals', 'Kolenda · Attention p.27']}
      />

      <Principle
        n="07"
        title="Récence : 30 % des avis publiés < 30 jours."
        body={
          <>
            <p>
              Un wall figé envoie le signal « personne ne parle de nous ». Cible :{' '}
              <strong>au moins 30 % d'avis publiés des 30 derniers jours</strong>.
              L'e-mail J+45 (CRON automatique) maintient ce débit.
            </p>
            <p className="mt-2">
              Insights → daily chart 30j permet de mesurer l'élan. Si la courbe
              s'affaisse, vérifier le CRON e-mail et le taux d'ouverture.
            </p>
          </>
        }
        sources={['Yotpo · Reviews freshness', 'maison FemiGlow']}
      />

      <Principle
        n="08"
        title="Modération transparente : note interne sur chaque rejet."
        body={
          <>
            <p>
              Pas de rejet sans note. Ça oblige à formuler la raison, ça nourrit
              l'audit, ça permet de revenir si l'initiée demande. Critères types :
              <em> spam</em>, <em>copié-collé</em>, <em>photo visage</em>,{' '}
              <em>insulte</em>, <em>concurrent</em>, <em>contenu illisible</em>.
            </p>
            <p className="mt-2">
              Le journal d'audit signé HMAC (chaîne cryptographique) rend le log
              inviolable : une modification a posteriori casse la chaîne, et est
              détectée par <code className="rounded bg-stone-100 px-1 text-xs">pnpm verify-audit</code>.
            </p>
          </>
        }
        sources={['RGPD · droit d\'accès', 'docs/19-plan-action-ameliorations.md §P3.4']}
      />

      <Principle
        n="09"
        title="Tags : 0 à 3, pas plus."
        body={
          <>
            <p>
              Trop de tags = bruit visuel et SEO dilué. Trois tags max suffisent
              pour qualifier l'avis et alimenter les filtres « ongles plus lisses »,
              « plaque souple », etc.
            </p>
            <p className="mt-2">
              Le catalogue maison (9 tags fermés) garantit la cohérence. Pas de
              tags libres : ça fragmenterait la facette publique du wall.
            </p>
          </>
        }
        sources={['Kolenda · UX p.50', 'maison FemiGlow']}
      />

      <Principle
        n="10"
        title="Photos vision-ML : modération humaine en cas de doute."
        body={
          <>
            <p>
              Si le provider Vision ML retourne{' '}
              <code className="rounded bg-stone-100 px-1 text-xs">MANUAL_REVIEW</code>{' '}
              ou{' '}
              <code className="rounded bg-stone-100 px-1 text-xs">REJECTED_FACE</code>,
              regarder la photo. Si le visage est partiel ou flouté → garder. Si
              frontal et identifiable → refuser <em>la photo seule</em>, garder le
              texte de l'avis.
            </p>
            <p className="mt-2">
              Le taux d'override admin (insights) doit rester sous{' '}
              <strong>30 %</strong>. Au-delà, le seuil ML est trop sévère et
              perd des photos légitimes.
            </p>
          </>
        }
        sources={['RGPD · données biométriques', 'maison FemiGlow']}
      />

      <Principle
        n="11"
        title="SLA 48 h sur la queue."
        body={
          <>
            <p>
              Un avis qui attend &gt; 48 h tue l'enthousiasme. L'initiée s'attend à
              voir son rituel publié dans la semaine. Cible :{' '}
              <strong>délai médian de modération &lt; 24 h</strong>.
            </p>
            <p className="mt-2">
              Le mode rafale (touche{' '}
              <code className="rounded bg-stone-100 px-1 text-xs">S</code>) permet
              de traiter 6-10 rituels par minute en session focus. Combiné aux
              raccourcis <code className="rounded bg-stone-100 px-1 text-xs">A/R</code>,
              c'est l'outil de batch idéal.
            </p>
          </>
        }
        sources={['Kolenda · Attention p.12', 'docs/19-plan-action-ameliorations.md §P2.2']}
      />

      <Principle
        n="12"
        title="Ne jamais répondre publiquement à un avis négatif sans valider en interne."
        body={
          <>
            <p>
              Tentation : se défendre dans les commentaires. À éviter. Préférer un
              e-mail privé à l'initiée, lui proposer remboursement ou
              accompagnement. Si la réponse publique est nécessaire (calomnie,
              désinformation), faire valider Souheila + service juridique avant
              publication.
            </p>
            <p className="mt-2">
              Note interne sur le rituel = source de vérité. La réponse publique
              vient après, avec recul.
            </p>
          </>
        }
        sources={['Kolenda · Luxury p.45', 'jurisprudence consommation MA']}
      />

      <section
        aria-labelledby="checklist-title"
        className="mt-10 rounded border border-stone-200 bg-stone-50 p-6"
        data-testid="bp-checklist"
      >
        <h2
          id="checklist-title"
          className="mb-3 font-serif text-xl text-stone-900"
        >
          Check-list avant approbation
        </h2>
        <ol className="space-y-2 text-sm text-stone-700">
          <Check>Première personne, geste concret, pas de superlatif vide</Check>
          <Check>Photo (si présente) sans visage frontal identifiable</Check>
          <Check>0 à 3 tags du catalogue maison, alignés avec le texte</Check>
          <Check>Auteur + ville renseignés ou anonymat assumé</Check>
          <Check>« Initiée depuis » plausible (au moins 2 semaines)</Check>
          <Check>
            Pas de lien externe, pas de promotion concurrent, pas de menace
          </Check>
          <Check>
            Si auto-flag présent : revue manuelle avant approve
          </Check>
        </ol>
      </section>

      <footer className="mt-8 text-xs text-stone-500">
        <p>
          Sources : Kolenda (Copywriting, UX, Pricing, Luxury) ·{' '}
          <a
            href="https://baymard.com/blog/reviews"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Baymard Reviews UX
          </a>{' '}
          · Trustpilot benchmarks 2024-2025 · jurisprudence consommation Maroc.
        </p>
      </footer>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded border border-stone-200 bg-white p-4">
      <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 font-serif text-2xl text-stone-900">{value}</p>
      <p className="mt-1 text-xs text-stone-600">{hint}</p>
    </div>
  );
}

function Principle({
  n,
  title,
  body,
  sources,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
  sources: string[];
}) {
  return (
    <article
      className="mb-8 rounded border border-stone-200 bg-white p-6"
      data-testid="bp-principle"
    >
      <header className="mb-3 flex items-baseline gap-3">
        <span className="font-serif text-2xl text-emerald-700">{n}</span>
        <h2 className="font-serif text-xl text-stone-900">{title}</h2>
      </header>
      <div className="space-y-2 text-sm leading-relaxed text-stone-700">{body}</div>
      <p className="mt-3 text-[11px] text-stone-500">
        Sources : {sources.join(' · ')}
      </p>
    </article>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 inline-block w-4 text-emerald-700">
        ☐
      </span>
      <span>{children}</span>
    </li>
  );
}
