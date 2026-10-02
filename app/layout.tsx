import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata={title:'DOMINO Marketing CRM',description:'Marketing Ads Control Center'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
