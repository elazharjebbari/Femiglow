'use client';

export function LegalPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-encre/20 bg-white/60 px-3 py-1.5 text-xs text-encre/80 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
      aria-label="Imprimer cette page ou l'enregistrer en PDF"
    >
      <span aria-hidden="true">🖨</span>
      Imprimer / PDF
    </button>
  );
}
