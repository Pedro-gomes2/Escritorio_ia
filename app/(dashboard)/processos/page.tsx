import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FolderOpen, AlertCircle, Clock } from 'lucide-react'
import { formatDate, prazoUrgencia } from '@/lib/utils'
import DeleteProcessoButton from './_components/delete-processo-button'

const statusLabel: Record<string, string> = {
  ativo: 'Ativo', suspenso: 'Suspenso', arquivado: 'Arquivado', encerrado: 'Encerrado',
}
const statusColor: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  suspenso: 'bg-amber-100 text-amber-700',
  arquivado: 'bg-slate-100 text-slate-600',
  encerrado: 'bg-red-100 text-red-700',
}

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('processos')
    .select('*, clientes(nome), profiles(nome)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (q) query = query.or(`titulo.ilike.%${q}%,numero.ilike.%${q}%`)

  const { data: processos } = await query

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Processos</h1>
          <p className="text-slate-500 text-sm mt-1">{processos?.length ?? 0} processo(s)</p>
        </div>
        <Link href="/processos/novo"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Novo Processo
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'ativo', 'suspenso', 'arquivado', 'encerrado'].map(s => (
          <Link key={s} href={s ? `/processos?status=${s}` : '/processos'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (status ?? '') === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {s === '' ? 'Todos' : statusLabel[s]}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {processos?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum processo encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {processos?.map(p => {
              const urgencia = p.prazo_proximo ? prazoUrgencia(p.prazo_proximo) : null
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  <Link href={`/processos/${p.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-slate-800 truncate">{p.titulo}</p>
                      {urgencia === 'urgente' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      {urgencia === 'vencido' && <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {p.numero && <span>{p.numero}</span>}
                      {p.clientes?.nome && <span>· {p.clientes.nome}</span>}
                      {p.tipo && <span>· {p.tipo}</span>}
                      {p.vara && <span>· {p.vara}</span>}
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {p.prazo_proximo && (
                      <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                        urgencia === 'vencido' ? 'bg-red-100 text-red-700' :
                        urgencia === 'urgente' ? 'bg-orange-100 text-orange-700' :
                        urgencia === 'proximo' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {formatDate(p.prazo_proximo)}
                      </div>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                    <DeleteProcessoButton id={p.id} titulo={p.titulo} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
