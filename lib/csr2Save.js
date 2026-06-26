import { gunzipSync, gzipSync } from 'zlib'
import { createHash } from 'crypto'

export function parseSave(buffer) {
  let dec
  try { dec = gunzipSync(buffer) } catch (e) { throw new Error('Decompress failed: ' + e.message) }
  const start = dec.indexOf(0x7B)
  const end   = dec.lastIndexOf(0x7D)
  if (start === -1 || end <= start) throw new Error('No JSON found in save file')
  try { return JSON.parse(dec.slice(start, end + 1).toString('utf8')) } catch (e) { throw new Error('JSON parse error: ' + e.message) }
}

export function writeSave(data) {
  const jsonStr = JSON.stringify(data)
  const hash = createHash('sha1').update(jsonStr, 'utf8').digest('hex')
  return gzipSync(Buffer.from(hash + '\n' + jsonStr, 'utf8'))
}
