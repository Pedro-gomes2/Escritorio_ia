import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JurisIA — Gestão Jurídica',
  description: 'Sistema de gestão jurídica com inteligência artificial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
