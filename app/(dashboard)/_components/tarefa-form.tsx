'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type Props = {
  processos: { id: string; titulo: string }[]
  advogados: { id: string; nome: string }[]
  defaultProcessoId?: string
}

export default function TarefaForm({ processos, advogados, defaultProcessoId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    processo_id: defaultProcessoId ?? '',
    responsavel_id: '',
    prioridade: 'media',
    prazo: '',
  })

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const { error } = await supabase.from('tarefas').insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      processo_id: form.processo_id || null,
      responsavel_id: form.responsavel_id || null,
      prioridade: form.prioridade,
      prazo: form.prazo || null,
    })

    if (error) {
      setErro('Erro ao salvar.')
      setLoading(false)
      return
    }

    router.push('/tarefas')
    router.refresh()
  }

  const fieldClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Título *</label>
          <input value={form.titulo} onChange={set('titulo')} required className={fieldClass}
            placeholder="O que precisa ser feito?" />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Descrição</label>
          <textarea value={form.descricao} onChange={set('descricao')} rows={3} className={fieldClass}
            placeholder="Detalhes adicionais..." />
        </div>
        <div>
          <label className={labelClass}>Processo vinculado</label>
          <select value={form.processo_id} onChange={set('processo_id')} className={fieldClass}>
            <option value="">Nenhum</option>
            {processos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Responsável</label>
          <select value={form.responsavel_id} onChange={set('responsavel_id')} className={fieldClass}>
            <option value="">Nenhum</option>
            {advogados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Prioridade</label>
          <select value={form.prioridade} onChange={set('prioridade')} className={fieldClass}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Prazo</label>
          <input type="date" value={form.prazo} onChange={set('prazo')} className={fieldClass} />
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
          Criar Tarefa
        </button>
      </div>
    </form>
  )
}
