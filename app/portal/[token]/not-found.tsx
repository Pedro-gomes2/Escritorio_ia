import { Scale } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-14 h-14 bg-slate-200 rounded-2xl flex items-center justify-center mb-4">
        <Scale className="w-7 h-7 text-slate-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-700 mb-2">Link inválido ou expirado</h1>
      <p className="text-slate-400 text-sm text-center max-w-xs">
        Este link de acesso não foi encontrado. Solicite um novo link ao escritório.
      </p>
    </div>
  )
}
