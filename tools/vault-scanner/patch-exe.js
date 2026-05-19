// Patches the Windows PE subsystem from Console (3) to Windows GUI (2)
// so the exe launches without a visible CMD window.
const fs = require('fs')
const file = process.argv[2] || 'aio-tool-v0.6.0.exe'
const buf = fs.readFileSync(file)
const peOffset = buf.readUInt32LE(0x3C)
const subsystemOffset = peOffset + 0x5C
const current = buf.readUInt16LE(subsystemOffset)
if (current !== 2) {
  buf.writeUInt16LE(2, subsystemOffset)
  fs.writeFileSync(file, buf)
  console.log('Patched subsystem', current, '→ 2 (Windows GUI — no CMD window)')
} else {
  console.log('Already patched.')
}
