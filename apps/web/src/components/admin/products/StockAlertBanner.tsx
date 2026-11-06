import Link from 'next/link';
import type { StockAlert } from '@/lib/checkout/stock-status';

interface StockAlertBannerProps {
  alerts: StockAlert[];
  /** Compteurs illisibles : on ne peut rien affirmer sur le stock. */
  unreadable?: boolean;
}

function AlertIdentity({ alert }: { alert: StockAlert }) {
  const name = alert.productTitle ?? alert.label;
  return (
    <>
      <span className="font-mono">{alert.sku}</span>
      {alert.productSlug ? (
        <>
          {' '}
          (
          <Link
            href={`/admin/products/${alert.productSlug}`}
            className="underline underline-offset-2"
          >
            {name}
          </Link>
          )
        </>
      ) : (
        ` (${name})`
      )}
    </>
  );
}

export function StockAlertBanner({ alerts, unreadable = false }: StockAlertBannerProps) {
  const refused = alerts.filter((a) => a.level === 'refused');
  const low = alerts.filter((a) => a.level === 'low');
  if (refused.length === 0 && low.length === 0 && !unreadable) return null;

  return (
    <div className="mb-6 space-y-2" data-testid="stock-alert-banner">
      {refused.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-semibold">Commandes refusées</p>
          <p className="mt-1">
            Le formulaire affiche « Rupture momentanée » et rejette toute commande
            de ces variantes.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {refused.map((a) => (
              <li key={`${a.productSlug ?? ''}:${a.sku}`}>
                <AlertIdentity alert={a} /> :{' '}
                {a.effective === null
                  ? 'aucun compteur de stock'
                  : `stock effectif ${a.effective}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {low.length > 0 ? (
        <div
          role="status"
          className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-semibold">Stock bas</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {low.map((a) => (
              <li key={`${a.productSlug ?? ''}:${a.sku}`}>
                <AlertIdentity alert={a} /> : stock effectif {a.effective}, seuil{' '}
                {a.thresholdLow}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {unreadable ? (
        <div
          role="alert"
          className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-semibold">Stock illisible</p>
          <p className="mt-1">
            Les compteurs n&apos;ont pas pu être lus. Des commandes peuvent être
            refusées sans que cette page le signale.
          </p>
        </div>
      ) : null}
    </div>
  );
}
