import './globals.css'

export const metadata = {
  title: 'Vault Admin',
  description: 'Account Marketplace Admin Panel',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}