'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface LoginFormProps {
  next?: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(data?.error?.message ?? 'Connexion impossible');
        return;
      }
      router.replace(next && next.startsWith('/admin') ? next : '/admin');
      router.refresh();
    } catch {
      setError('Erreur réseau, réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-stone-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="block w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
