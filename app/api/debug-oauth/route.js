export async function GET() {
  const id = process.env.GOOGLE_CLIENT_ID || ''
  const secret = process.env.GOOGLE_CLIENT_SECRET || ''
  const redirect = process.env.GOOGLE_REDIRECT_URI || ''
  return Response.json({
    client_id_length: id.length,
    client_id_prefix: id.slice(0, 20) || '(empty)',
    client_secret_length: secret.length,
    redirect_uri: redirect || '(empty — will use localhost fallback)',
  })
}
