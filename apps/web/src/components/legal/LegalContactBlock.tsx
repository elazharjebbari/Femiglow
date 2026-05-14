import { listAllTemplateVars } from '@/lib/legal/repository';

interface Props {
  lastUpdated: Date;
  version: number;
}

/**
 * Bloc Contact en fin de page légale. Affiche email + téléphone (depuis
 * template vars) + signature "Mise à jour le X · vN". Fallback gracieux
 * si vars indisponibles.
 */
export async function LegalContactBlock({ lastUpdated, version }: Props) {
  let email = 'info@femiglow.ma';
  let phone = '+212 630-035905';
  try {
    const vars = await listAllTemplateVars();
    const e = vars.find((v) => v.key === 'COMPANY_EMAIL');
    const p = vars.find((v) => v.key === 'COMPANY_PHONE');
    if (e?.value) email = e.value;
    if (p?.value) phone = p.value;
  } catch {
    // fallback
  }

  return (
    <aside
      aria-labelledby="legal-contact-title"
      className="mt-12 rounded-2xl border border-encre/10 bg-white/60 p-6"
    >
      <h2 id="legal-contact-title" className="text-sm font-medium text-encre">
        Une question ?
      </h2>
      <p className="mt-2 text-sm text-encre/70">
        Notre équipe répond rapidement :
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li>
          <a
            href={`mailto:${email}`}
            className="text-encre underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
          >
            ✉ {email}
          </a>
        </li>
        <li>
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="text-encre underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
          >
            ☎ {phone}
          </a>
        </li>
      </ul>
      <p className="mt-4 text-xs text-encre/50">
        Mise à jour le{' '}
        <time dateTime={lastUpdated.toISOString()}>
          {lastUpdated.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </time>{' '}
        · v{version}
      </p>
    </aside>
  );
}
