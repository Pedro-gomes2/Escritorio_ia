import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Clock, FileText, CheckSquare } from 'lucide-react'
import { formatDate, formatDateTime, formatMoeda, prazoUrgencia } from '@/lib/utils'
import MovimentacaoForm from '../../_components/movimentacao-form'
import DeleteProcessoButton from '../_components/delete-processo-button'

const statusColor: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  suspenso: 'bg-amber-100 text-amber-700',
  arquivado: 'bg-slate-100 text-slate-600',
  encerrado: 'bg-red-100 text-red-700',
}

export default async function ProcessoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: processo } = await supabase
    .from('processos')
    .select('*, clientes(id, nome), profiles(nome)')
    .eq('id', id)
    .single()

  if (!processo) notFound()

  const [{ data: movimentacoes }, { data: tarefas }, { data: documentos }] = await Promise.all([
    supabase.from('movimentacoes').select('*, profiles(nome)').eq('processo_id', id).order('data', { ascending: false }),
    supabase.from('tarefas').select('*').eq('processo_id', id).order('created_at', { ascending: false }),
    supabase.from('documentos').select('*').eq('processo_id', id).order('created_at', { ascending: false }),
  ])

  const urgencia = processo.prazo_proximo ? prazoUrgencia(processo.prazo_proximo) : null

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start gap-4 mb-6">
        <Link href="/processos" className="text-slate-400 hover:text-slate-600 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-800">{processo.titulo}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[processo.status]}`}>
              {processo.status}
            </span>
          </div>
          {processo.numero && <p className="text-slate-500 text-sm">{processo.numero}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/processos/${id}/editar`}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium">
            <Pencil className="w-4 h-4" />
            Editar
          </Link>
          <DeleteProcessoButton id={id} titulo={processo.titulo} redirectAfter />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Cliente', value: processo.clientes?.nome ?? '—' },
          { label: 'Advogado', value: processo.profiles?.nome ?? '—' },
          { label: 'Vara / Comarca', value: [processo.vara, processo.comarca].filter(Boolean).join(' · ') || '—' },
          { label: 'Valor da causa', value: processo.valor_causa ? formatMoeda(processo.valor_causa) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="font-semibold text-slate-800 text-sm truncate">{value}</p>
          </div>
        ))}
      </div>

      {processo.prazo_proximo && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm font-medium ${
          urgencia === 'vencido' ? 'bg-red-50 text-red-700 border border-red-200' :
          urgencia === 'urgente' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
          urgencia === 'proximo' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          'bg-slate-50 text-slate-600 border border-slate-200'
        }`}>
          <Clock className="w-4 h-4" />
          Próximo prazo: {formatDate(processo.prazo_proximo)}
          {urgencia === 'vencido' && ' — VENCIDO'}
          {urgencia === 'urgente' && ' — URGENTE'}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Movimentações</h3>
              <span className="text-xs text-slate-400">{movimentacoes?.length ?? 0} registro(s)</span>
            </div>
            <div className="p-5">
              <MovimentacaoForm processoId={id} />
            </div>
            {movimentacoes && movimentacoes.length > 0 && (
              <div className="px-5 pb-5">
                <div className="border-l-2 border-slate-200 pl-4 space-y-4">
                  {movimentacoes.map(m => (
                    <div key={m.id} className="relative">
                      <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium`}>
                            {m.tipo || 'Geral'}
                          </span>
                          <span className="text-xs text-slate-400">{formatDateTime(m.data)}</span>
                        </div>
                        <p className="text-sm text-slate-700">{m.descricao}</p>
                        {m.profiles?.nome && (
                          <p className="text-xs text-slate-400 mt-1">por {m.profiles.nome}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-500" />
                Tarefas
              </h3>
              <Link href={`/tarefas/nova?processo_id=${id}`} className="text-xs text-blue-600 hover:underline">
                + Nova
              </Link>
            </div>
            {tarefas?.length === 0 ? (
              <p className="text-xs text-slate-400 p-4">Sem tarefas</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {tarefas?.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      t.prioridade === 'urgente' ? 'bg-red-500' :
                      t.prioridade === 'alta' ? 'bg-orange-500' :
                      t.prioridade === 'media' ? 'bg-amber-400' : 'bg-slate-300'
                    }`} />
                    <p className="text-sm text-slate-700 flex-1 truncate">{t.titulo}</p>
                    <span className="text-xs text-slate-400">{t.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-500" />
                Documentos
              </h3>
              <span className="text-xs text-slate-400">
                {documentos?.length ?? 0} arquivo(s)
              </span>
            </div>
            {documentos?.length === 0 ? (
              <p className="text-xs text-slate-400 p-4">Sem documentos</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {documentos?.map(d => (
                  <div key={d.id} className="px-4 py-2.5">
                    <p className="text-sm text-slate-700 truncate">{d.nome}</p>
                    <p className="text-xs text-slate-400">{formatDate(d.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
