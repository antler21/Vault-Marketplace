// TEMPORARY — diagnosing why CSR2_ADMIN_TOKEN isn't being recognized in production.
// Reveals only whether the env var is present and its length, never its value. Delete this file once resolved.
export async function GET() {
  const val = process.env.CSR2_ADMIN_TOKEN || ''
  return Response.json({ hasToken: !!val, length: val.length })
}
