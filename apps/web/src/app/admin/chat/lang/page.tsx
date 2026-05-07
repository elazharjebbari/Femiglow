/**
 * CHA-120 — Page Langues : visualisation des dictionnaires darija /
 * MSA utilisés par `detectLanguage()`. Lecture-seule en V1 (édition
 * via PR), mais l'interface affiche les listes pour audit.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import {
  DARIJA_AR_TOKENS,
  DARIJA_FR_TOKENS,
  MSA_AR_TOKENS,
} from '@/lib/chat/lang/dictionary';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function ChatLangPage() {
  const session = await requireAdmin('/admin/chat/lang');

  if (!isChatEnabled()) {
    return (
      <AdminShell adminEmail={session.email} active="chat">
        <ChatAdminNav active="lang" />
        <p className="text-sm text-stone-500">Chat désactivé.</p>
      </AdminShell>
    );
  }

  const sections: Array<{
    title: string;
    description: string;
    tokens: readonly string[];
    rtl?: boolean;
  }> = [
    {
      title: 'Darija (alphabet latin)',
      description:
        "Tokens darija écrits en alphabet latin (chiffres 3, 7, 9 inclus). Au moins 2 hits → langue détectée 'ar-MA'.",
      tokens: DARIJA_FR_TOKENS,
    },
    {
      title: 'Darija (script arabe)',
      description:
        "Marqueurs darija en script arabe. ≥1 hit + <2 hits MSA → 'ar-MA' plutôt que 'ar'.",
      tokens: DARIJA_AR_TOKENS,
      rtl: true,
    },
    {
      title: 'MSA — arabe classique',
      description:
        "Marqueurs d'arabe standard moderne ; leur présence majoritaire bascule vers 'ar' classique.",
      tokens: MSA_AR_TOKENS,
      rtl: true,
    },
  ];

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="lang" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Dictionnaires de langue</h1>
        <p className="text-sm text-stone-600">
          Détection FR / AR / Darija. Édition via PR — versionné dans{' '}
          <code className="rounded bg-stone-100 px-1">lib/chat/lang/dictionary.ts</code>.
        </p>
      </header>

      <div className="space-y-6">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-md border border-stone-200 bg-white p-4"
          >
            <h2 className="text-base font-medium">{section.title}</h2>
            <p className="mt-1 text-sm text-stone-500">{section.description}</p>
            <p className="mt-2 text-xs text-stone-500">
              {section.tokens.length} tokens
            </p>
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              dir={section.rtl ? 'rtl' : undefined}
              lang={section.rtl ? 'ar' : undefined}
            >
              {section.tokens.map((tok) => (
                <span
                  key={tok}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-xs"
                >
                  {tok}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
