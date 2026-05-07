/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'react/no-unescaped-entities': 'off',
  },
  overrides: [
    {
      // CHA-009 — Charte ESLint chat.
      // Le widget rend du markdown LLM sanitizé. On verrouille les
      // sorties au cas où un dev câble du HTML brut par mégarde.
      files: [
        'src/lib/chat/**/*.{ts,tsx}',
        'src/components/chat/**/*.{ts,tsx}',
        'src/app/api/chat/**/*.{ts,tsx}',
        'src/app/admin/chat/**/*.{ts,tsx}',
      ],
      rules: {
        'react/no-danger': 'error',
        'react/no-danger-with-children': 'error',
        // Tracer toute fuite involontaire de PII : les logs chat
        // doivent passer par `logger.*` (qui redact).
        'no-console': ['error', { allow: ['warn', 'error'] }],
      },
    },
  ],
};
