// @vitest-environment jsdom
/**
 * F01 — Wizard partagé (SOC-F05 / TRV-08) : batterie F01-C-044..052 + F01-A-053.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expectNoAxeViolations } from '@/test/axe';

import { Wizard, type WizardStep } from '@/components/admin/emails/ui/Wizard';

/** 4 étapes ; l'étape 2 est invalidable à la demande. */
function makeSteps(opts: { step2Valid?: () => boolean } = {}): WizardStep[] {
  return [
    { id: 'nom', title: 'Nom', content: <p>contenu nom</p> },
    {
      id: 'audience',
      title: 'Audience',
      validate: () =>
        (opts.step2Valid?.() ?? true) ? true : 'Sélectionnez au moins une audience.',
      content: <p>contenu audience</p>,
    },
    { id: 'contenu', title: 'Contenu', content: <p>contenu contenu</p> },
    { id: 'verif', title: 'Vérif.', content: <p>contenu vérif</p> },
  ];
}

const stepBtn = (name: RegExp) => screen.getByRole('button', { name });
const nextBtn = () => screen.getByRole('button', { name: /suivant/i });

async function goToStep(user: ReturnType<typeof userEvent.setup>, n: number) {
  for (let i = 1; i < n; i += 1) await user.click(nextBtn());
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
    new RegExp(`^${n}\\.`),
  );
}

afterEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('Wizard — navigation par la barre d’étapes', () => {
  it('F01-C-044 — étape déjà atteinte cliquable : retour direct de 3 vers 1', async () => {
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps()} />);
    await goToStep(user, 3);

    await user.click(stepBtn(/nom/i));
    expect(screen.getByText('contenu nom')).toBeInTheDocument();
  });

  it('F01-C-045 — étape future inerte : clic sur 4 depuis 1, rien ne bouge', async () => {
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps()} />);

    const future = stepBtn(/vérif/i);
    expect(future).toBeDisabled();
    expect(future).toHaveAttribute('aria-disabled', 'true');
    await user.click(future).catch(() => {});
    expect(screen.getByText('contenu nom')).toBeInTheDocument();
  });

  it('F01-C-052 — aria-current=step sur l’étape affichée uniquement', async () => {
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps()} />);
    await user.click(nextBtn());

    expect(stepBtn(/audience/i)).toHaveAttribute('aria-current', 'step');
    expect(stepBtn(/nom/i)).not.toHaveAttribute('aria-current');
    expect(stepBtn(/contenu/i)).not.toHaveAttribute('aria-current');
  });
});

describe('Wizard — clavier', () => {
  it('F01-C-046 — Ctrl+ArrowRight avance si l’étape est valide', () => {
    const { container } = render(<Wizard steps={makeSteps()} />);
    fireEvent.keyDown(container.firstChild as Element, { key: 'ArrowRight', ctrlKey: true });
    expect(screen.getByText('contenu audience')).toBeInTheDocument();
  });

  it('F01-C-047 — Ctrl+ArrowLeft recule', async () => {
    const user = userEvent.setup();
    const { container } = render(<Wizard steps={makeSteps()} />);
    await user.click(nextBtn());
    fireEvent.keyDown(container.firstChild as Element, { key: 'ArrowLeft', ctrlKey: true });
    expect(screen.getByText('contenu nom')).toBeInTheDocument();
  });
});

describe('Wizard — validation & focus', () => {
  it('F01-C-048 — après next(), le focus est sur le titre de la nouvelle étape', async () => {
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps()} />);
    await user.click(nextBtn());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 })),
    );
  });

  it('F01-C-049 — next sur étape invalide : on reste + role=alert', async () => {
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps({ step2Valid: () => false })} />);
    await user.click(nextBtn()); // 1 → 2 (étape 1 sans validate)
    await user.click(nextBtn()); // 2 → bloqué

    expect(screen.getByText('contenu audience')).toBeInTheDocument(); // resté
    expect(screen.getByRole('alert')).toHaveTextContent(/sélectionnez au moins une audience/i);
  });

  it('F01-C-050 — le message d’erreur est voisin DOM du bouton Suivant', async () => {
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps({ step2Valid: () => false })} />);
    await user.click(nextBtn());
    await user.click(nextBtn());

    const alert = screen.getByRole('alert');
    // Même conteneur direct que le bouton Suivant (pas en tête de page).
    expect(alert.parentElement).toBe(nextBtn().parentElement);
  });

  it('F01-C-049b — corriger la validation débloque l’avancée et efface l’alerte', async () => {
    let valid = false;
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps({ step2Valid: () => valid })} />);
    await user.click(nextBtn());
    await user.click(nextBtn());
    expect(screen.getByRole('alert')).toBeInTheDocument();

    valid = true;
    await user.click(nextBtn());
    expect(screen.getByText('contenu contenu')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Wizard — persistance (reprise après F5)', () => {
  it('F01-C-051 — persistKey : remontage → rouvre à l’étape 3', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wizard steps={makeSteps()} persistKey="test-camp-42" />);
    await goToStep(user, 3);
    unmount();

    render(<Wizard steps={makeSteps()} persistKey="test-camp-42" />);
    expect(screen.getByText('contenu contenu')).toBeInTheDocument();
    // Les étapes 1-2 restent atteintes (cliquables) après reprise.
    expect(stepBtn(/nom/i)).toBeEnabled();
  });

  it('F01-C-051b — sans persistKey : remontage → étape 1 (pas de fuite d’état)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wizard steps={makeSteps()} />);
    await goToStep(user, 3);
    unmount();

    render(<Wizard steps={makeSteps()} />);
    expect(screen.getByText('contenu nom')).toBeInTheDocument();
  });
});

describe('Wizard — fin de parcours & a11y', () => {
  it('F01-C-052b — dernière étape : bouton finishLabel, onFinish appelé après validation', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<Wizard steps={makeSteps()} finishLabel="📨 Envoyer" onFinish={onFinish} />);
    await goToStep(user, 4);

    await user.click(screen.getByRole('button', { name: /envoyer/i }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('F01-A-053 — axe : 0 violation sur barre + étape + erreur visible', async () => {
    const user = userEvent.setup();
    const { container } = render(<Wizard steps={makeSteps({ step2Valid: () => false })} />);
    await user.click(nextBtn());
    await user.click(nextBtn()); // erreur affichée
    await expectNoAxeViolations(container);
  });
});

/** Harnais d'intégration légère : Wizard + état consommateur (préfigure F05). */
describe('Wizard — avec données consommateur', () => {
  it('F01-C-044b — le retour vers une étape conserve les données saisies', async () => {
    function Consumer() {
      const [name, setName] = useState('');
      const steps: WizardStep[] = [
        {
          id: 'nom',
          title: 'Nom',
          validate: () => (name.length >= 3 ? true : 'Le nom doit faire au moins 3 caractères.'),
          content: (
            <label>
              Nom interne
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          ),
        },
        { id: 'fin', title: 'Fin', content: <p>fin — nom : {name}</p> },
      ];
      return <Wizard steps={steps} />;
    }
    const user = userEvent.setup();
    render(<Consumer />);

    await user.click(nextBtn());
    expect(screen.getByRole('alert')).toHaveTextContent(/au moins 3 caractères/i);

    await user.type(screen.getByLabelText(/nom interne/i), 'Aïd 2026');
    await user.click(nextBtn());
    expect(screen.getByText(/fin — nom : Aïd 2026/)).toBeInTheDocument();

    await user.click(stepBtn(/nom/i));
    expect(screen.getByLabelText(/nom interne/i)).toHaveValue('Aïd 2026');
  });
});
