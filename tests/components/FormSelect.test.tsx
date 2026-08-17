// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../src/theme'
import { FormSelect } from '../../src/components/FormSelect'

// jsdom implements neither API these tests exercise:
// - ResizeObserver: Ark UI's popper positioning (used to place the open
//   dropdown relative to the trigger) observes the trigger's size; without
//   a stub it throws inside a requestAnimationFrame callback on every
//   open/close.
// - Element.prototype.scrollTo: the select machine scrolls the option list
//   to top when a selection is committed; without a stub that throws
//   synchronously inside the state-change handler and the selection is
//   never committed, so the hidden <select>'s value never updates.
// Neither is under test here — no test asserts on layout or scroll
// position — so a no-op stub is enough.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error -- jsdom does not implement ResizeObserver
  global.ResizeObserver ??= ResizeObserverStub
  Element.prototype.scrollTo ??= () => {}
})

// This config's test.globals is false (see vitest.config.ts), so
// @testing-library/react's implicit auto-cleanup — which only registers
// when it finds a *global* afterEach — never fires. Without this, each
// test's render leaks into the next, and role/text queries scoped to "the"
// combobox or option start matching one per previous test as well.
afterEach(cleanup)

function renderWithChakra(ui: ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>)
}

describe('FormSelect', () => {
  it('renders a hidden select with the given name and no initial value', () => {
    const { container } = renderWithChakra(
      <FormSelect
        name="foodChoice1"
        placeholder="Pick one"
        options={[
          { value: 'a', label: 'Tacos' },
          { value: 'b', label: 'Pizza' },
        ]}
      />,
    )
    const hiddenSelect = container.querySelector(
      'select[name="foodChoice1"]',
    ) as HTMLSelectElement
    expect(hiddenSelect).not.toBeNull()
    expect(hiddenSelect.value).toBe('')
  })

  it('respects defaultValue for uncontrolled initial selection', () => {
    const { container } = renderWithChakra(
      <FormSelect
        name="foodChoice1"
        placeholder="Pick one"
        defaultValue="b"
        options={[
          { value: 'a', label: 'Tacos' },
          { value: 'b', label: 'Pizza' },
        ]}
      />,
    )
    const hiddenSelect = container.querySelector(
      'select[name="foodChoice1"]',
    ) as HTMLSelectElement
    expect(hiddenSelect.value).toBe('b')
    // The visible trigger shows the selected option's label. Scoped to the
    // combobox itself (via role, not raw text) because the hidden native
    // <select> that Select.HiddenSelect renders alongside it (for FormData
    // compatibility) carries an <option>Pizza</option> with the same text.
    expect(within(screen.getByRole('combobox')).getByText('Pizza')).toBeTruthy()
  })

  it('updates the hidden select value when an option is chosen', async () => {
    const user = userEvent.setup()
    const { container } = renderWithChakra(
      <FormSelect
        name="foodChoice1"
        placeholder="Pick one"
        options={[
          { value: 'a', label: 'Tacos' },
          { value: 'b', label: 'Pizza' },
        ]}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    // getByRole('option', ...), not getByText: the hidden native <select>'s
    // <option>Pizza</option> matches the same text but is excluded from
    // role queries because Select.HiddenSelect marks it aria-hidden.
    await user.click(await screen.findByRole('option', { name: 'Pizza' }))
    const hiddenSelect = container.querySelector(
      'select[name="foodChoice1"]',
    ) as HTMLSelectElement
    expect(hiddenSelect.value).toBe('b')
  })

  it('does not allow selecting a disabled option', async () => {
    const user = userEvent.setup()
    const { container } = renderWithChakra(
      <FormSelect
        name="bringItemId"
        placeholder="Nothing"
        options={[
          { value: 'a', label: 'Drinks' },
          { value: 'b', label: 'Chips (already claimed)', disabled: true },
        ]}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.click(
      await screen.findByRole('option', { name: 'Chips (already claimed)' }),
    )
    const hiddenSelect = container.querySelector(
      'select[name="bringItemId"]',
    ) as HTMLSelectElement
    expect(hiddenSelect.value).toBe('')
  })
})
