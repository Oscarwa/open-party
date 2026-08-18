'use client'

import { useState } from 'react'
import { DatePicker } from '@chakra-ui/react'

// Chakra's DatePicker has no native-input/hidden-input form participation
// in `inline` mode (that machinery — DatePicker.Input's `name` attribute —
// only exists on the popover-trigger Input part, which `inline` mode
// omits entirely, per Chakra's own "Calendar" description: "the inline
// variant of the DatePicker... without the input, positioner, and content
// parts"). So this component tracks the selection itself and mirrors it
// into a plain hidden input, the same way it would if this were still a
// native <input type="date"> — the enclosing <form action={serverAction}>
// and its FormData parsing need no changes to accept this in its place.
export function DateField({
  id,
  name,
  required,
}: {
  id?: string
  name: string
  required?: boolean
}) {
  const [dateString, setDateString] = useState('')

  return (
    <>
      <input type="hidden" id={id} name={name} value={dateString} required={required} />
      <DatePicker.Root
        inline
        selectionMode="single"
        onValueChange={(details) => {
          const [selected] = details.value
          // @internationalized/date's CalendarDate.toString() is already
          // the ISO 8601 "YYYY-MM-DD" form the `date` DB column and this
          // form's zod schema expect — the same format a native
          // <input type="date"> would have submitted.
          setDateString(selected ? selected.toString() : '')
        }}
      >
        <DatePicker.View view="day">
          <DatePicker.Header />
          <DatePicker.DayTable />
        </DatePicker.View>
        <DatePicker.View view="month">
          <DatePicker.Header />
          <DatePicker.MonthTable />
        </DatePicker.View>
        <DatePicker.View view="year">
          <DatePicker.Header />
          <DatePicker.YearTable />
        </DatePicker.View>
      </DatePicker.Root>
    </>
  )
}
