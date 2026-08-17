// HMAC-signed session tokens for /admin. Uses the Web Crypto API
// (crypto.subtle), not Node's `crypto` module, because this needs to
// verify tokens from both the Edge middleware runtime and the Node
// Server Action runtime — Web Crypto is the one API available in both.

export const SESSION_COOKIE_NAME = 'admin_session'

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const expiresAt = now + SESSION_DURATION_MS
  const key = await getKey(secret)
  const signature = await crypto.subtle.sign(
    ALGORITHM,
    key,
    new TextEncoder().encode(String(expiresAt)),
  )
  return `${expiresAt}.${toBase64Url(signature)}`
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  const [expiresAtRaw, signatureRaw] = token.split('.')
  if (!expiresAtRaw || !signatureRaw) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt)) return false

  let signatureBytes: Uint8Array<ArrayBuffer>
  try {
    signatureBytes = fromBase64Url(signatureRaw)
  } catch {
    return false
  }

  const key = await getKey(secret)
  const isSignatureValid = await crypto.subtle.verify(
    ALGORITHM,
    key,
    signatureBytes,
    new TextEncoder().encode(expiresAtRaw),
  )
  if (!isSignatureValid) return false

  return expiresAt > now
}
