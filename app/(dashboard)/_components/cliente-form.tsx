'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Folder } from 'lucide-react'

const BASE_PATH = 'G:\\Meu Drive\\ESCRITÓRIO\\PROCESSOS LUCY'

type Props = {
  cliente?: {
    id: string
    nome: string
    tipo: string
    cpf_cnpj: string | null
    email: string | null
    telefone: string | null
    endereco: string | null
    observacoes: string | null
    pasta_path: string | null
  }
}

export default function ClienteForm({ cliente }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: cliente?.nome ?? '',
    tipo: cliente?.tipo ?? 'pf',
    cpf_cnpj: cliente?.cpf_cnpj ?? '',
    email: cliente?.email ?? '',
    telefone: cliente?.telefone ?? '',
    endereco: cliente?.endereco ?? '',
    observacoes: cliente?.observacoes ?? '',
    pasta_path: cliente?.pasta_path ?? '',
  })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const payload = {
      nome: form.nome,
      tipo: form.tipo,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      pasta_path: form.pasta_path || null,
    }

    const { error } = cliente
      ? await supabase.from('clientes').update(payload).eq('id', cliente.id)
      : await supabase.from('clientes').insert(payload)

    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/clientes')
    router.refresh()
  }

  const fieldClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Nome *</label>
          <input value={form.nome} onChange={set('nome')} required className={fieldClass} placeholder="Nome completo ou razão social" />
        </div>
        <div>
          <label className={labelClass}>Tipo</label>
          <select value={form.tipo} onChange={set('tipo')} className={fieldClass}>
            <option value="pf">Pessoa Física</option>
            <option value="pj">Pessoa Jurídica</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{form.tipo === 'pj' ? 'CNPJ' : 'CPF'}</label>
          <input value={form.cpf_cnpj} onChange={set('cpf_cnpj')} className={fieldClass}
            placeholder={form.tipo === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'} />
        </div>
        <div>
          <label className={labelClass}>E-mail</label>
          <input type="email" value={form.email} onChange={set('email')} className={fieldClass} placeholder="email@exemplo.com" />
        </div>
        <div>
          <label className={labelClass}>Telefone</label>
          <input value={form.telefone} onChange={set('telefone')} className={fieldClass} placeholder="(00) 00000-0000" />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Endereço</label>
          <input value={form.endereco} onChange={set('endereco')} className={fieldClass} placeholder="Rua, número, bairro, cidade - UF" />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Caminho da Pasta</label>
          <div className="flex gap-2">
            <input
              value={form.pasta_path}
              onChange={set('pasta_path')}
              className={fieldClass}
              placeholder={`${BASE_PATH}\\NOME DO CLIENTE`}
            />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, pasta_path: `${BASE_PATH}\\${f.nome.trim().toUpperCase() || 'NOME DO CLIENTE'}` }))}
              title="Sugerir caminho baseado no nome"
              className="flex-shrink-0 flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Folder className="w-4 h-4" />
              Sugerir
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Caminho completo no Windows/Drive. Clique em &quot;Sugerir&quot; para gerar automaticamente.</p>
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Observações</label>
          <textarea value={form.observacoes} onChange={set('observacoes')} rows={3} className={fieldClass} placeholder="Informações adicionais sobre o cliente..." />
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
          {cliente ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </button>
      </div>
    </form>
  )
}
