'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type Props = {
  clientes: { id: string; nome: string }[]
  processos: { id: string; titulo: string }[]
  defaultClienteId?: string
}

export default function HonorarioForm({ clientes, processos, defaultClienteId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    tipo: 'fixo',
    status: 'pendente',
    cliente_id: defaultClienteId ?? '',
    processo_id: '',
    vencimento: '',
  })

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const { error } = await supabase.from('honorarios').insert({
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      tipo: form.tipo,
      status: form.status,
      cliente_id: form.cliente_id || null,
      processo_id: form.processo_id || null,
      vencimento: form.vencimento || null,
    })

    if (error) {
      setErro('Erro ao salvar.')
      setLoading(false)
      return
    }

    router.push('/financeiro')
    router.refresh()
  }

  const fieldClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Descrição *</label>
          <input value={form.descricao} onChange={set('descricao')} required className={fieldClass}
            placeholder="Ex: Honorários advocatícios — Processo Trabalhista" />
        </div>
        <div>
          <label className={labelClass}>Valor (R$) *</label>
          <input type="number" step="0.01" min="0" value={form.valor} onChange={set('valor')} required
            className={fieldClass} placeholder="0,00" />
        </div>
        <div>
          <label className={labelClass}>Tipo</label>
          <select value={form.tipo} onChange={set('tipo')} className={fieldClass}>
            <option value="fixo">Fixo</option>
            <option value="exito">Êxito</option>
            <option value="hora">Por hora</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Cliente</label>
          <select value={form.cliente_id} onChange={set('cliente_id')} className={fieldClass}>
            <option value="">Selecionar...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Processo</label>
          <select value={form.processo_id} onChange={set('processo_id')} className={fieldClass}>
            <option value="">Selecionar...</option>
            {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={form.status} onChange={set('status')} className={fieldClass}>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Vencimento</label>
          <input type="date" value={form.vencimento} onChange={set('vencimento')} className={fieldClass} />
        </div>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-lg text-sm font-medium transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Registrar Honorário
        </button>
      </div>
    </form>
  )
}
