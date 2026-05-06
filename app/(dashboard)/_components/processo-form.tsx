'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type Processo = {
  id: string
  numero: string | null
  titulo: string
  tipo: string | null
  vara: string | null
  comarca: string | null
  fase: string | null
  status: string
  cliente_id: string | null
  advogado_id: string | null
  valor_causa: number | null
  prazo_proximo: string | null
}

type Props = {
  processo?: Processo
  clientes: { id: string; nome: string }[]
  advogados: { id: string; nome: string }[]
  defaultClienteId?: string
}

export default function ProcessoForm({ processo, clientes, advogados, defaultClienteId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    titulo: processo?.titulo ?? '',
    numero: processo?.numero ?? '',
    tipo: processo?.tipo ?? '',
    vara: processo?.vara ?? '',
    comarca: processo?.comarca ?? '',
    fase: processo?.fase ?? '',
    status: processo?.status ?? 'ativo',
    cliente_id: processo?.cliente_id ?? defaultClienteId ?? '',
    advogado_id: processo?.advogado_id ?? '',
    valor_causa: processo?.valor_causa?.toString() ?? '',
    prazo_proximo: processo?.prazo_proximo ? processo.prazo_proximo.split('T')[0] : '',
  })

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const payload = {
      titulo: form.titulo,
      numero: form.numero || null,
      tipo: form.tipo || null,
      vara: form.vara || null,
      comarca: form.comarca || null,
      fase: form.fase || null,
      status: form.status,
      cliente_id: form.cliente_id || null,
      advogado_id: form.advogado_id || null,
      valor_causa: form.valor_causa ? parseFloat(form.valor_causa) : null,
      prazo_proximo: form.prazo_proximo || null,
    }

    const { data, error } = processo
      ? await supabase.from('processos').update(payload).eq('id', processo.id).select().single()
      : await supabase.from('processos').insert(payload).select().single()

    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
      setLoading(false)
      return
    }

    router.push(`/processos/${data.id}`)
    router.refresh()
  }

  const fieldClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Título do processo *</label>
          <input value={form.titulo} onChange={set('titulo')} required className={fieldClass}
            placeholder="Ex: João Silva vs. Empresa ABC — Rescisão Contratual" />
        </div>
        <div>
          <label className={labelClass}>Número CNJ</label>
          <input value={form.numero} onChange={set('numero')} className={fieldClass}
            placeholder="0000000-00.0000.0.00.0000" />
        </div>
        <div>
          <label className={labelClass}>Tipo de ação</label>
          <input value={form.tipo} onChange={set('tipo')} className={fieldClass}
            placeholder="Ex: Cível, Trabalhista, Criminal..." />
        </div>
        <div>
          <label className={labelClass}>Vara</label>
          <input value={form.vara} onChange={set('vara')} className={fieldClass}
            placeholder="Ex: 1ª Vara Cível" />
        </div>
        <div>
          <label className={labelClass}>Comarca</label>
          <input value={form.comarca} onChange={set('comarca')} className={fieldClass}
            placeholder="Ex: São Paulo - SP" />
        </div>
        <div>
          <label className={labelClass}>Fase processual</label>
          <input value={form.fase} onChange={set('fase')} className={fieldClass}
            placeholder="Ex: Conhecimento, Recursal, Execução..." />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={form.status} onChange={set('status')} className={fieldClass}>
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="arquivado">Arquivado</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Cliente</label>
          <select value={form.cliente_id} onChange={set('cliente_id')} className={fieldClass}>
            <option value="">Selecionar cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Advogado responsável</label>
          <select value={form.advogado_id} onChange={set('advogado_id')} className={fieldClass}>
            <option value="">Selecionar advogado...</option>
            {advogados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Valor da causa (R$)</label>
          <input type="number" step="0.01" min="0" value={form.valor_causa} onChange={set('valor_causa')}
            className={fieldClass} placeholder="0,00" />
        </div>
        <div>
          <label className={labelClass}>Próximo prazo</label>
          <input type="date" value={form.prazo_proximo} onChange={set('prazo_proximo')} className={fieldClass} />
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
          {processo ? 'Salvar Alterações' : 'Cadastrar Processo'}
        </button>
      </div>
    </form>
  )
}
