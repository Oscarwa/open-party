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
    >
      <Select.HiddenSelect id={id} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
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
