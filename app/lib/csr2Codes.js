import crypto from 'crypto'

// Crockford base32 — excludes I, L, O, U so codes never contain ambiguous characters.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

// 5 characters from a 32-symbol alphabet = ~25 bits of entropy (~33M possible
// codes). Deliberately short per request — the global failed-attempt cap in
// csr2RateLimit.js is what actually keeps that keyspace safe from brute force,
// not the length. 4 random bytes (32 bits) gives 7 base32 chars; take 5 of them.
export function generateCsr2Code() {
  return base32Encode(crypto.randomBytes(4)).slice(0, 5)
}

// Normalize (case/dash-insensitive) before hashing so lookups tolerate how it's pasted.
export function hashCsr2Code(code) {
  const normalized = String(code).toUpperCase().replace(/[^0-9A-Z]/g, '')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}
