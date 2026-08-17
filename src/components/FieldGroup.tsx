import type { ReactNode } from 'react'
import { Field } from '@chakra-ui/react'

export function FieldGroup({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  return (
    <Field.Root invalid={Boolean(error)}>
      <Field.Label htmlFor={htmlFor}>{label}</Field.Label>
      {children}
      {error ? <Field.ErrorText>{error}</Field.ErrorText> : null}
    </Field.Root>
  )
}
