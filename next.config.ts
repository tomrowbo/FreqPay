import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Shops are served on their own *.localhost hosts; let the dev server accept them.
  allowedDevOrigins: ['tesco.localhost', 'sainsburys.localhost', 'asda.localhost', 'ocado.localhost', 'iceland.localhost', 'waitrose.localhost', 'morrisons.localhost', 'coop.localhost', 'costco.localhost', 'viking.localhost'],
  serverExternalPackages: ['stripe'],
  devIndicators: false, // hide the Next.js badge in the demo recording
}

export default nextConfig
