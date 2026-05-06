'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'

export default function MovimentacaoForm({ processoId }: { processoId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ tipo: '', descricao: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('movimentacoes').insert({
      processo_id: processoId,
      tipo: form.tipo || null,
      descricao: form.descricao,
      autor_id: user?.id,
    })

    setForm({ tipo: '', descricao: '' })
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
        <Plus className="w-4 h-4" />
        Registrar movimentação
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 rounded-lg p-4 space-y-3 mb-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
          <input value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
            placeholder="Petição, Despacho, Audiência..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Descrição *</label>
        <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          required rows={3} placeholder="Descreva a movimentação processual..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)}
          className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Salvar
        </button>
      </div>
    </form>
  )
}
