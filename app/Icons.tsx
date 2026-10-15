// Line icons for the dashboard stats (24px grid, currentColor).
const P = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
export const WalletIcon = () => <svg {...P}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Z" /><circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none" /></svg>
export const TruckIcon = () => <svg {...P}><path d="M3 6h11v10H3z" /><path d="M14 9h4l3 3.5V16h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
export const ReceiptIcon = () => <svg {...P}><path d="M6 3h12v18l-3-1.8L12 21l-3-1.8L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
export const LeafIcon = () => <svg {...P}><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-4 6-6.5 9.5-8.5" /></svg>
