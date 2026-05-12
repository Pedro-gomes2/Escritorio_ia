'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clienteId: string
  nome: string
  telefone: string | null
}

export default function WhatsappButton({ nome, telefone }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function iniciarConversa() {
    if (!telefone) return
    setLoading(true)
    try {
      // Verifica se já existe um atendimento ativo com esse telefone
      const tel = telefone.replace(/\D/g, '')
      const { data: existente } = await supabase
        .from('atendimentos_whatsapp')
        .select('id')
        .or(`telefone.eq.${tel},telefone.eq.55${tel}`)
        .neq('coluna', 'finalizado')
        .maybeSingle()

      if (existente) {
        router.push(`/whatsapp?id=${existente.id}`)
        return
      }

      // Cria novo atendimento
      const { data: novo } = await supabase
        .from('atendimentos_whatsapp')
        .insert({
          nome,
          telefone: tel.startsWith('55') ? tel : '55' + tel,
          coluna: 'novo',
          tags: [],
          mensagens: [],
          nao_lido: false,
        })
        .select('id')
        .single()

      if (novo) {
        router.push(`/whatsapp?id=${novo.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!telefone) {
    return (
      <div title="Cadastre o telefone do cliente para iniciar conversa">
        <button disabled
          className="flex items-center gap-2 border border-slate-200 text-slate-400 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-60">
          <MessageSquare className="w-4 h-4" />
          WhatsApp
        </button>
      </div>
    )
  }

  return (
    <button onClick={iniciarConversa} disabled={loading}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
      WhatsApp
    </button>
  )
}
