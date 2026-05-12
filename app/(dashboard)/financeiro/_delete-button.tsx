'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteButton({ id, descricao }: { id: string; descricao: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Excluir "${descricao}"?\n\nEsta ação não pode ser desfeita.`)) return
    setLoading(true)
    await fetch(`/api/honorarios/${id}/excluir`, { method: 'POST' })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
      title="Excluir"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
