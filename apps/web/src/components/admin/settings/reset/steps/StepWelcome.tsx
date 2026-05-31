'use client';
import type { Dispatch } from 'react';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

export function StepWelcome({ dispatch }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-900">Reset de l&apos;environnement</h2>
      <p className="mt-3 text-sm text-stone-700">
        Cet assistant te guide pour ramener la base, les médias et le cache vers un état canonique.
        Tu vas successivement&nbsp;:
      </p>
      <ol className="mt-3 list-decimal pl-5 text-sm text-stone-700">
        <li>Choisir un niveau de reset (soft → hard)</li>
        <li>Préciser ce que tu veux conserver</li>
        <li>Voir l&apos;impact AVANT toute action</li>
        <li>Confirmer par texte</li>
        <li>Suivre l&apos;exécution en direct</li>
      </ol>
      <p className="mt-4 rounded-md bg-stone-50 p-3 text-xs text-stone-600">
        <strong>Backup automatique</strong> avant toute action destructive. Tu pourras toujours
        revenir en arrière via &laquo;&nbsp;Restaurer un backup&nbsp;&raquo;.
      </p>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => dispatch({ type: 'NEXT' })}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
