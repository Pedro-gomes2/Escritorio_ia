'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function DeleteClienteButton({ id, nome }: { id: string; nome: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    if (!confirm(`Excluir o cliente "${nome}"? Esta ação não pode ser desfeita.`)) return
    setLoading(true)
    await supabase.from('clientes').delete().eq('id', id)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50 p-1"
      title="Excluir cliente"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
