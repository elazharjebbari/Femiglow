interface ErrorStateProps {
  email: string;
  /**
   * Phase 7 wiring — texte localisé avant le lien email. Défaut FR si absent.
   * Le `{email}` final de la string catalogue est rendu via le `<a>` + `.`.
   */
  body?: string;
}

export function ErrorState({
  email,
  body = 'L’envoi n’a pas abouti. Réessayez ou écrivez-nous à',
}: ErrorStateProps) {
  return (
    <p
      role="alert"
      className="border-s-2 border-encre ps-6 py-2 text-sm text-encre"
    >
      {body}{' '}
      <a
        href={`mailto:${email}`}
        className="underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
      >
        {email}
      </a>
      .
    </p>
  );
}
