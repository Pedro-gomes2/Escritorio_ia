import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-6xl font-bold text-slate-200 mb-4">404</h1>
      <p className="text-slate-600 font-medium mb-2">Página não encontrada</p>
      <Link href="/" className="text-sm text-blue-600 hover:underline">Voltar ao início</Link>
    </div>
  )
}
