interface ErrorStateProps {
  email: string;
}

export function ErrorState({ email }: ErrorStateProps) {
  return (
    <p
      role="alert"
      className="border-s-2 border-encre ps-6 py-2 text-sm text-encre"
    >
      L{'\u2019'}envoi n{'\u2019'}a pas abouti. Réessayez ou écrivez-nous à{' '}
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
