// One-time setup. Run locally: node scripts/csr2-gen-worker-keypair.js
//
// Generates the RSA keypair used to protect CSR2 job credentials.
//   - The PRIVATE key goes ONLY in the local Python worker's own env/config —
//     never commit it, never paste it into Vercel.
//   - The PUBLIC key is safe to put in Vercel's CSR2_CRED_PUBLIC_KEY env var —
//     it can only encrypt, not decrypt.
const crypto = require('crypto')

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

console.log('\n=== CSR2_CRED_PUBLIC_KEY (set this in Vercel env vars) ===\n')
console.log(publicKey)
console.log('=== PRIVATE KEY (save this ONLY on your PC, for the Python worker — never commit, never upload) ===\n')
console.log(privateKey)
