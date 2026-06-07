export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback` : 'http://localhost:3000/api/auth/gmail/callback')

// gmail.send is required for sending reply emails from Offers page
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')
