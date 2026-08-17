// Generic HMAC-signed, expiring token primitive. Uses the Web Crypto API
// (crypto.subtle), not Node's `crypto` module, because callers need to
// verify tokens from both the Edge middleware runtime and the Node Server
// Action runtime — Web Crypto is the one API available in both.
//
// Every caller (admin sessions, attendee sessions, and anything future)
// signs a payload under its OWN context string. The context is folded
// into what gets signed, so a token minted for one purpose can never
// verify as valid for another, even though every caller shares the same
// SESSION_SECRET — this is the property the whole module exists for.

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify'],
  )
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function signedInput(context: string, payloadB64: string, expiresAt: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${context}:${payloadB64}:${expiresAt}`)
}

export async function signToken(
  context: string,
  payload: string,
  secret: string,
  durationMs: number,
  now: number = Date.now(),
): Promise<string> {
  const expiresAt = now + durationMs
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload).buffer as ArrayBuffer)
  const key = await getKey(secret)
  const signature = await crypto.subtle.sign(
    ALGORITHM,
    key,
    signedInput(context, payloadB64, String(expiresAt)),
  )
  return `${payloadB64}.${expiresAt}.${toBase64Url(signature)}`
}

export async function verifyToken(
  context: string,
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<{ valid: true; payload: string } | { valid: false }> {
  const parts = token.split('.')
  if (parts.length !== 3) return { valid: false }
  const [payloadB64, expiresAtRaw, signatureRaw] = parts
  // payloadB64 may legitimately be '' (the admin session always signs an
  // empty payload) — only expiresAt and the signature must be non-empty.
  if (!expiresAtRaw || !signatureRaw) return { valid: false }

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt)) return { valid: false }

  let signatureBytes: Uint8Array<ArrayBuffer>
  let payloadBytes: Uint8Array<ArrayBuffer>
  try {
    signatureBytes = fromBase64Url(signatureRaw)
    payloadBytes = fromBase64Url(payloadB64)
  } catch {
    return { valid: false }
  }

  const key = await getKey(secret)
  const isSignatureValid = await crypto.subtle.verify(
    ALGORITHM,
    key,
    signatureBytes,
    signedInput(context, payloadB64, expiresAtRaw),
  )
  if (!isSignatureValid) return { valid: false }
  if (expiresAt <= now) return { valid: false }

  return { valid: true, payload: new TextDecoder().decode(payloadBytes) }
}
