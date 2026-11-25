import { gunzipSync, gzipSync } from 'zlib'
import { createHmac } from 'crypto'

// CSR2 save files store some fields (e.g. gfsi) as 64-bit integers that exceed
// JS's safe integer range (±2^53 — Number.MAX_SAFE_INTEGER). Plain JSON.parse/
// JSON.stringify silently round these to the nearest representable double and
// print that back using whatever decimal happens to be its shortest round-trip
// form — which is often NOT the original digit string (e.g. -9223372036854775808,
// exactly INT64_MIN, round-trips to -9223372036854776000). That mismatch was
// enough to make the game reject an edited save. BigInt preserves the exact
// value through parse -> edit -> stringify instead.
const BIGINT_MARKER = '\uE000CSR2BIGINT\uE000' // Unicode Private Use Area — valid unescaped in a JSON string, never real save data
// Matches a whole JSON string literal OR a whole JSON number literal, so a
// digit sequence inside an existing quoted string is never mistaken for one.
const NUMKEY_MARKER = '\uE001' // JS objects reorder integer-like keys; prefixing them keeps the game's order
const TOKEN_RE = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function isSafeIntegerLiteral(token) {
  try {
    const n = BigInt(token)
    return n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= BigInt(Number.MIN_SAFE_INTEGER)
  } catch { return true } // not a plain integer (shouldn't happen here) — leave it alone
}

function protectBigInts(jsonStr) {
  return jsonStr.replace(TOKEN_RE, (token, offset) => {
    if (token[0] === '"') return /^"\d+"$/.test(token) && jsonStr[offset + token.length] === ':' ? '"' + NUMKEY_MARKER + token.slice(1) : token
    if (/[.eE]/.test(token)) return Number.isInteger(Number(token)) ? '"' + BIGINT_MARKER + token + '"' : token
    return isSafeIntegerLiteral(token) ? token : '"' + BIGINT_MARKER + token + '"'
  })
}

function reviveBigInts(value) {
  if (Array.isArray(value)) return value.map(reviveBigInts)
  if (value && typeof value === 'object' && !(value instanceof Number)) {
    for (const k of Object.keys(value)) value[k] = reviveBigInts(value[k])
    return value
  }
  if (typeof value === 'string' && value.startsWith(BIGINT_MARKER)) {
    const raw = value.slice(BIGINT_MARKER.length)
    // Boxed so a whole-valued decimal (0.0) is not mistaken for an int on write; still works in arithmetic.
    return /[.eE]/.test(raw) ? new Number(raw) : BigInt(raw)
  }
  return value
}

export function parseSave(buffer) {
  let dec
  try { dec = gunzipSync(buffer) } catch (e) { throw new Error('Decompress failed: ' + e.message) }
  const start = dec.indexOf(0x7B)
  const end   = dec.lastIndexOf(0x7D)
  if (start === -1 || end <= start) throw new Error('No JSON found in save file')
  try {
    return reviveBigInts(JSON.parse(protectBigInts(dec.slice(start, end + 1).toString('utf8'))))
  } catch (e) { throw new Error('JSON parse error: ' + e.message) }
}

// Mirrors CSRPacker's (Newtonsoft) double formatting.
function formatFloat(n) {
  const abs = Math.abs(n)
  if (n !== 0 && (abs >= 1e15 || abs < 1e-4)) {
    const [m, exp] = n.toExponential().split('e')
    return m + 'E' + exp[0] + exp.slice(1).padStart(2, '0')
  }
  return Number.isInteger(n) ? n + '.0' : String(n)
}

export function writeSave(data) {
  let jsonStr = JSON.stringify(data, (_key, value) => {
    if (typeof value === 'bigint') return BIGINT_MARKER + value
    if (value instanceof Number) return BIGINT_MARKER + formatFloat(Number(value))
    if (typeof value === 'number' && !Number.isInteger(value)) return BIGINT_MARKER + formatFloat(value)
    return value
  })
  jsonStr = jsonStr.replace(new RegExp('"' + BIGINT_MARKER + '(-?[0-9.E+-]+)"', 'g'), '$1')
  jsonStr = jsonStr.replaceAll('"' + NUMKEY_MARKER, '"')
  // Un-prefixed save header = HMAC-SHA1 of the JSON body; a plain SHA-1 never validates.
  const hash = createHmac('sha1', '4cPw3ZyC').update(jsonStr, 'utf8').digest('hex')
  const out = gzipSync(Buffer.from(hash + '\n' + jsonStr, 'utf8'), { level: 6 })
  out[8] = 4 // XFL/OS header bytes as written by CSRPacker
  out[9] = 0
  return out
}
