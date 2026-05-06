'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type Perfil = {
  id: string
  nome: string
  cargo: string | null
  oab: string | null
}

export default function EditarPerfilForm({ perfil }: { perfil: Perfil }) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [form, setForm] = useState({
    nome: perfil.nome,
    cargo: perfil.cargo ?? 'advogado',
    oab: perfil.oab ?? '',
  })

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('profiles').update({
      nome: form.nome,
      cargo: form.cargo,
      oab: form.oab || null,
    }).eq('id', perfil.id)
    setLoading(false)
    setOk(true)
    setTimeout(() => setOk(false), 3000)
    router.refresh()
  }

  const fieldClass = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
        <input value={form.nome} onChange={set('nome')} required className={fieldClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Cargo</label>
        <select value={form.cargo} onChange={set('cargo')} className={fieldClass}>
          <option value="socio">Sócio(a)</option>
          <option value="advogado">Advogado(a)</option>
          <option value="estagiario">Estagiário(a)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">OAB</label>
        <input value={form.oab} onChange={set('oab')} className={fieldClass} placeholder="SP 123456" />
      </div>
      <div className="col-span-3 flex items-center gap-3">
        <button type="submit" disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Salvar perfil
        </button>
        {ok && <span className="text-sm text-green-600 font-medium">Salvo com sucesso!</span>}
      </div>
    </form>
  )
}
