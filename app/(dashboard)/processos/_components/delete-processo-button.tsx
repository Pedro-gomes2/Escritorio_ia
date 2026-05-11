'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  id: string
  titulo: string
  redirectAfter?: boolean
}

export default function DeleteProcessoButton({ id, titulo, redirectAfter }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    if (!confirm(`Excluir o processo "${titulo}"? Esta ação não pode ser desfeita.`)) return
    setLoading(true)
    await supabase.from('processos').delete().eq('id', id)
    if (redirectAfter) {
      router.push('/processos')
    } else {
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
      {loading ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}
