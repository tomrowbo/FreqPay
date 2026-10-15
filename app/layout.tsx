import './globals.css'
import { DM_Sans, Fraunces } from 'next/font/google'

const head = Fraunces({ subsets: ['latin'], variable: '--font-head', weight: ['500', '600'], style: ['normal', 'italic'] })
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' })

export const metadata = { title: 'FreqPay', robots: { index: false, follow: false } } // simulated shops with real retailer branding stay out of search

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable}`}>
      <body>
        <div style={{ background: '#111827', color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: 600, padding: '7px 12px', letterSpacing: '0.02em' }}>
          DEMO · Stripe test mode · the shops are simulated: nothing here is a real store, order or payment
        </div>
        {children}
      </body>
    </html>
  )
}
