# Tests composants — Spec

Cibles principales :
- `IdInput`
- `Stepper`
- `EventMatrixRow`
- `StatusCard`
- `TrackingPlanWizard` (intégration)

## IdInput

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdInput } from '@/components/tracking/shared/IdInput'

describe('IdInput', () => {
  it('renders with autofill badge when value is autofilled', () => {
    render(
      <IdInput
        label="GA4 Measurement ID"
        value="G-5VHP17SDZM"
        autofilled
        onChange={jest.fn()}
      />
    )
    expect(screen.getByText('auto-rempli')).toBeInTheDocument()
  })

  it('shows revert button when user modifies value', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    
    render(
      <IdInput
        label="GA4 ID"
        value="G-5VHP17SDZM"
        autofilled
        onChange={onChange}
      />
    )
    
    const input = screen.getByLabelText('GA4 ID')
    await user.clear(input)
    await user.type(input, 'G-CUSTOM123')
    
    expect(screen.getByText('↺ revert')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith('G-CUSTOM123')
  })

  it('warns when value matches placeholder pattern G-PROD0000', () => {
    render(
      <IdInput
        label="GA4 ID"
        value="G-PROD0000"
        onChange={jest.fn()}
      />
    )
    expect(screen.getByText(/Ressemble à une valeur de démo/)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('warns on AW-REPLACE_* pattern', () => {
    render(
      <IdInput
        label="Ads ID"
        value="AW-REPLACE_ME"
        onChange={jest.fn()}
      />
    )
    expect(screen.getByText(/Ressemble à une valeur de démo/)).toBeInTheDocument()
  })

  it('shows format error for invalid GA4 format', () => {
    render(
      <IdInput
        label="GA4 ID"
        value="INVALID-FORMAT"
        expectedFormat={/^G-[A-Z0-9]{9,12}$/}
        onChange={jest.fn()}
      />
    )
    expect(screen.getByText(/Format attendu/)).toBeInTheDocument()
  })

  it('debounces server validation by 300ms', async () => {
    jest.useFakeTimers()
    const onServerValidate = jest.fn()
    
    render(
      <IdInput
        label="GA4 ID"
        value="G-VALID"
        onChange={jest.fn()}
        onServerValidate={onServerValidate}
      />
    )
    
    const input = screen.getByLabelText('GA4 ID')
    await userEvent.type(input, 'X')  // change
    
    expect(onServerValidate).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(299)
    expect(onServerValidate).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(2)  // 301ms total
    expect(onServerValidate).toHaveBeenCalledTimes(1)
    
    jest.useRealTimers()
  })

  it('revert restores autofill value', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    
    const { rerender } = render(
      <IdInput
        label="GA4 ID"
        value="G-CUSTOM"
        autofilled={false}
        autofillValue="G-AUTOFILL"
        onChange={onChange}
      />
    )
    
    await user.click(screen.getByText('↺ revert'))
    
    expect(onChange).toHaveBeenCalledWith('G-AUTOFILL')
  })
})
```

## Stepper

```typescript
describe('Stepper', () => {
  it('renders 5 steps with current=3 indicator', () => {
    render(
      <Stepper
        steps={[
          { id: 'providers', label: 'Outils', state: 'completed' },
          { id: 'ids', label: 'Identifiants', state: 'completed' },
          { id: 'events', label: 'Événements', state: 'current' },
          { id: 'envs', label: 'Environnements', state: 'future' },
          { id: 'review', label: 'Vérification', state: 'future' },
        ]}
      />
    )
    expect(screen.getByRole('button', { name: /Étape 3/ }))
      .toHaveAttribute('aria-current', 'step')
  })

  it('navigates to clicked completed step', async () => {
    const user = userEvent.setup()
    const onNavigate = jest.fn()
    
    render(
      <Stepper
        steps={[
          { id: 'providers', label: 'Outils', state: 'completed' },
          { id: 'ids', label: 'Identifiants', state: 'current' },
        ]}
        onNavigate={onNavigate}
      />
    )
    
    await user.click(screen.getByRole('button', { name: /Outils/ }))
    expect(onNavigate).toHaveBeenCalledWith('providers')
  })

  it('blocks click on future step with shake animation', async () => {
    const user = userEvent.setup()
    const onNavigate = jest.fn()
    
    render(
      <Stepper
        steps={[
          { id: 'providers', label: 'Outils', state: 'current' },
          { id: 'ids', label: 'Identifiants', state: 'future' },
        ]}
        onNavigate={onNavigate}
      />
    )
    
    const futureStep = screen.getByRole('button', { name: /Identifiants/ })
    await user.click(futureStep)
    
    expect(onNavigate).not.toHaveBeenCalled()
    expect(futureStep).toHaveClass(/shake/)
    expect(screen.getByText(/Terminez d'abord/)).toBeInTheDocument()
  })

  it('shows ambré color for completed step with warnings', () => {
    render(
      <Stepper
        steps={[
          { id: 'providers', label: 'Outils', state: 'completed', warnings: 2 },
        ]}
      />
    )
    const step = screen.getByRole('button', { name: /Outils/ })
    expect(step).toHaveClass(/bg-ambre/)
  })
})
```

## EventMatrixRow

```typescript
describe('EventMatrixRow', () => {
  it('renders event with active providers checked', () => {
    render(
      <EventMatrixRow
        event={{
          key: 'purchase',
          providers: { ga4: true, meta: true, ads: false }
        }}
        availableProviders={['ga4', 'meta', 'ads']}
        onToggle={jest.fn()}
      />
    )
    
    expect(screen.getByRole('checkbox', { name: /GA4/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Meta/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Ads/ })).not.toBeChecked()
  })

  it('toggles provider on click', async () => {
    const user = userEvent.setup()
    const onToggle = jest.fn()
    
    render(
      <EventMatrixRow
        event={{
          key: 'purchase',
          providers: { ga4: false }
        }}
        availableProviders={['ga4']}
        onToggle={onToggle}
      />
    )
    
    await user.click(screen.getByRole('checkbox', { name: /GA4/ }))
    expect(onToggle).toHaveBeenCalledWith('purchase', 'ga4', true)
  })
})
```

## TrackingPlanWizard (intégration)

```typescript
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers/tracking'

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterAll(() => server.close())

describe('TrackingPlanWizard (integration)', () => {
  it('auto-saves draft after 5 seconds of inactivity', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    
    render(<TrackingPlanWizard planId="plan-test-001" />)
    
    // Step to identifiers
    await user.click(screen.getByRole('button', { name: /Continuer/ }))
    
    // Modify field
    await user.type(screen.getByLabelText('GA4 Measurement ID'), 'X')
    
    // Should show "Modifications non sauvegardées"
    expect(screen.getByText(/non sauvegardées/)).toBeInTheDocument()
    
    // Advance 5 seconds
    jest.advanceTimersByTime(5000)
    
    // Should auto-save
    await screen.findByText(/Sauvegardé/)
    
    jest.useRealTimers()
  })

  it('blocks "Continuer" on step with validation errors', async () => {
    const user = userEvent.setup()
    render(<TrackingPlanWizard planId="plan-test-001" />)
    
    // Step 2 with empty required ID
    await user.click(screen.getByRole('button', { name: /Continuer/ }))
    await user.click(screen.getByRole('button', { name: /Continuer/ }))
    
    expect(screen.getByText(/Veuillez corriger/)).toBeInTheDocument()
  })
})
```

## Snapshots

À utiliser **avec parcimonie** sur les composants. Préférer assertions explicites.

Exceptions OK :
- StatusCard avec les 4 variants → snapshot pour catch design regression.
- JsonPreview pour un cas représentatif.

## Couverture cible

- Composants partagés : 80%
- Composants wizard : 75%
- Composants expert : 70%

## Tests pour i18n

```typescript
describe('IdInput — i18n', () => {
  it('renders in French by default', () => {
    render(
      <I18nProvider locale="fr-MA">
        <IdInput label="GA4 ID" value="" onChange={jest.fn()} />
      </I18nProvider>
    )
    expect(screen.getByText('auto-rempli')).toBeInTheDocument()
  })

  it('renders in Arabic with RTL', () => {
    render(
      <I18nProvider locale="ar-MA">
        <IdInput label="GA4 ID" value="" onChange={jest.fn()} />
      </I18nProvider>
    )
    expect(screen.getByText('مملوء تلقائيا')).toBeInTheDocument()
    expect(screen.getByLabelText('GA4 ID').parentElement)
      .toHaveAttribute('dir', 'rtl')
  })
})
```
