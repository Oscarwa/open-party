import { Button as ChakraButton, type ButtonProps } from '@chakra-ui/react'

// Thin re-export so every page imports the app's Button from one place —
// a future style change (default color palette, size, variant) is one
// file, not a grep across every page that renders a button.
export function Button(props: ButtonProps) {
  return <ChakraButton colorPalette="orange" {...props} />
}
