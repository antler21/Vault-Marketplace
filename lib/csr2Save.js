import { gunzipSync, gzipSync } from 'zlib'
import { createHash } from 'crypto'

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
const TOKEN_RE = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function isSafeIntegerLiteral(token) {
  try {
    const n = BigInt(token)
    return n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= BigInt(Number.MIN_SAFE_INTEGER)
  } catch { return true } // not a plain integer (shouldn't happen here) — leave it alone
}

function protectBigInts(jsonStr) {
  return jsonStr.replace(TOKEN_RE, token => {
    if (token[0] === '"') return token // a string literal — don't touch its contents
    if (/[.eE]/.test(token)) return token // float/exponent — within double precision anyway
    return isSafeIntegerLiteral(token) ? token : '"' + BIGINT_MARKER + token + '"'
  })
}

function reviveBigInts(value) {
  if (Array.isArray(value)) return value.map(reviveBigInts)
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = reviveBigInts(value[k])
    return value
  }
  if (typeof value === 'string' && value.startsWith(BIGINT_MARKER)) {
    return BigInt(value.slice(BIGINT_MARKER.length))
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

export function writeSave(data) {
  let jsonStr = JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? BIGINT_MARKER + value.toString() : value))
  jsonStr = jsonStr.replace(new RegExp('"' + BIGINT_MARKER + '(-?\\d+)"', 'g'), '$1')
  const hash = createHash('sha1').update(jsonStr, 'utf8').digest('hex')
  return gzipSync(Buffer.from(hash + '\n' + jsonStr, 'utf8'))
}
