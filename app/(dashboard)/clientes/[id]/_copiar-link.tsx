'use client'

import { useState } from 'react'
import { Link2, Check, MessageCircle } from 'lucide-react'

type Props = {
  token: string | null
  nome: string
  email: string | null
}

export default function CopiarLinkPortal({ token, nome, email }: Props) {
  const [copiado, setCopiado] = useState(false)

  if (!token) return null

  function portalUrl() {
    return `${window.location.origin}/portal/${token}`
  }

  async function copiar() {
    await navigator.clipboard.writeText(portalUrl())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function enviarWhatsApp() {
    const url = portalUrl()
    const texto = encodeURIComponent(
      `Olá, ${nome}! 👋\n\nSegue o link para acompanhar o andamento do seu processo diretamente pelo portal do escritório:\n\n${url}\n\nO link estará sempre atualizado com as últimas movimentações. Qualquer dúvida, é só nos chamar!`
    )
    window.open(`https://wa.me/?text=${texto}`, '_blank')
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copiar}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
          copiado
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
        }`}
      >
        {copiado ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        {copiado ? 'Link copiado!' : 'Link do portal'}
      </button>

      <button
        onClick={enviarWhatsApp}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border bg-slate-50 border-slate-200 text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all"
      >
        <MessageCircle className="w-4 h-4" />
        Enviar por WhatsApp
      </button>
    </div>
  )
}
