import { createSystem, defaultConfig } from '@chakra-ui/react'

// No custom tokens for this phase — Chakra's defaults (the numeric
// spacing scale, typography, color palettes, and the mobile-first
// breakpoints base/sm/md/lg/xl) are used as-is. App-wide visual
// consistency comes from convention, not custom tokens: primary actions
// use colorPalette="orange" (the default baked into the shared Button
// wrapper, src/components/Button.tsx) instead of Chakra's default gray,
// so the app reads as intentionally designed without the added surface
// area — and token-name risk — of a hand-rolled color palette.
export const system = createSystem(defaultConfig)
