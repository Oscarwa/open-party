'use client'

import { Select, createListCollection } from '@chakra-ui/react'

export type FormSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

// The one custom-built interactive control in this app — no native
// <select> dropdown anywhere. Select.HiddenSelect renders a real,
// synced-to-selection native <select> under the hood, so this drops
// into any existing <form action={serverAction}> in place of a plain
// <select name="..." defaultValue="..."> with no change to the
// surrounding form or the Server Action reading its FormData.
export function FormSelect({
  id,
  name,
  placeholder,
  defaultValue,
  required,
  options,
}: {
  id?: string
  name: string
  placeholder: string
  defaultValue?: string
  required?: boolean
  options: FormSelectOption[]
}) {
  const collection = createListCollection({ items: options })

  return (
    <Select.Root
      collection={collection}
      name={name}
      required={required}
      defaultValue={defaultValue ? [defaultValue] : []}
      // Passing `id` straight to Select.HiddenSelect (as an override prop on
      // the rendered <select>) used to silently break the machine's own
      // internal element lookup: it tags the DOM node with our id, but
      // zag's dom.getHiddenSelectEl(scope) still searches for its own
      // auto-generated id and finds nothing. That lookup backs
      // syncSelectElement, the effect that reconciles the native <select>'s
      // selectedness after every value change — with it silently failing,
      // clearing a selection (or, if you dig further, any value change)
      // never actually reset the native <select>'s selected option, so the
      // real DOM value a form submission reads stayed stale even though the
      // visible trigger displayed the placeholder. Routing our id through
      // `ids.hiddenSelect` instead keeps the same DOM id (so
      // FieldGroup's htmlFor still resolves, and label-click-to-focus still
      // works) while keeping it in sync with what the machine looks up
      // internally.
      ids={id ? { hiddenSelect: id } : undefined}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          {/* Only for optional selects — the required finalize selects must
              always resolve to a chosen option, so they get no way back to
              empty. Without this, any select with no native empty option
              (unlike the old plain <select>s, which each had one) can be
              set but never unset — a real bug for bringItemId, where a
              stuck selection permanently blocks that item for every other
              attendee (see getClaimedBringItemIds). */}
          {required ? null : <Select.ClearTrigger />}
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          {collection.items.map((item) => (
            // No explicit `disabled` prop here — Select.Item's props don't
            // include one (it's not a valid HTML attribute for a <div>,
            // which is what an item renders as). The underlying collection
            // derives disabled state from each item's own `disabled` field
            // automatically (createListCollection's default
            // isItemDisabled), which is what actually blocks selection —
            // confirmed by this component's "does not allow selecting a
            // disabled option" test.
            <Select.Item key={item.value} item={item}>
              {item.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  )
}
