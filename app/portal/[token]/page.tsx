import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Scale, Clock, CheckCircle, AlertCircle, FileText, ChevronRight } from 'lucide-react'
import { formatDate, formatDateTime, prazoUrgencia } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, string> = {
  ativo: 'Em andamento', suspenso: 'Suspenso', arquivado: 'Arquivado', encerrado: 'Encerrado',
}
const statusStyle: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700 border-green-200',
  suspenso: 'bg-amber-100 text-amber-700 border-amber-200',
  arquivado: 'bg-slate-100 text-slate-600 border-slate-200',
  encerrado: 'bg-blue-100 text-blue-700 border-blue-200',
}
const tipoMovStyle: Record<string, string> = {
  'Petição': 'bg-blue-500',
  'Despacho': 'bg-purple-500',
  'Audiência': 'bg-orange-500',
  'Prazo': 'bg-red-500',
  'Decisão': 'bg-green-500',
}

function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function PortalClientePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = supabasePublic()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, tipo')
    .eq('token_portal', token)
    .single()

  if (!cliente) notFound()

  const { data: processos } = await supabase
    .from('processos')
    .select('id, titulo, numero, tipo, vara, comarca, fase, status, prazo_proximo, created_at')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: false })

  const processosComMovs = await Promise.all(
    (processos ?? []).map(async (p) => {
      const { data: movs } = await supabase
        .from('movimentacoes')
        .select('id, data, tipo, descricao')
        .eq('processo_id', p.id)
        .order('data', { ascending: false })
        .limit(10)
      return { ...p, movimentacoes: movs ?? [] }
    })
  )

  const processosAtivos = processosComMovs.filter(p => p.status === 'ativo').length
  const proximoPrazo = processosComMovs
    .filter(p => p.prazo_proximo && p.status === 'ativo')
    .sort((a, b) => new Date(a.prazo_proximo!).getTime() - new Date(b.prazo_proximo!).getTime())[0]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Portal do Cliente</p>
            <h1 className="font-bold text-lg leading-tight">{cliente.nome}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-1">Processos ativos</p>
            <p className="text-3xl font-bold text-slate-800">{processosAtivos}</p>
            <p className="text-xs text-slate-400 mt-1">de {processosComMovs.length} no total</p>
          </div>
          <div className={`bg-white rounded-xl border p-5 ${
            proximoPrazo
              ? prazoUrgencia(proximoPrazo.prazo_proximo!) === 'urgente' || prazoUrgencia(proximoPrazo.prazo_proximo!) === 'vencido'
                ? 'border-red-200'
                : 'border-amber-200'
              : 'border-slate-200'
          }`}>
            <p className="text-xs text-slate-500 mb-1">Próximo prazo</p>
            {proximoPrazo ? (
              <>
                <p className={`text-2xl font-bold ${
                  prazoUrgencia(proximoPrazo.prazo_proximo!) === 'vencido' ? 'text-red-600' :
                  prazoUrgencia(proximoPrazo.prazo_proximo!) === 'urgente' ? 'text-orange-600' :
                  'text-slate-800'
                }`}>
                  {formatDate(proximoPrazo.prazo_proximo!)}
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate">{proximoPrazo.titulo}</p>
              </>
            ) : (
              <p className="text-slate-400 text-sm mt-2">Sem prazos próximos</p>
            )}
          </div>
        </div>

        {/* Lista de processos */}
        {processosComMovs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-600">Nenhum processo encontrado</p>
            <p className="text-sm text-slate-400 mt-1">Entre em contato com o escritório para mais informações.</p>
          </div>
        ) : (
          processosComMovs.map(processo => {
            const urgencia = processo.prazo_proximo ? prazoUrgencia(processo.prazo_proximo) : null
            return (
              <div key={processo.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Cabeçalho do processo */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-slate-800 text-base leading-tight mb-1">
                        {processo.titulo}
                      </h2>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                        {processo.numero && <span>Nº {processo.numero}</span>}
                        {processo.tipo && <span>· {processo.tipo}</span>}
                        {processo.vara && <span>· {processo.vara}</span>}
                        {processo.comarca && <span>· {processo.comarca}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex-shrink-0 ${statusStyle[processo.status]}`}>
                      {statusLabel[processo.status]}
                    </span>
                  </div>

                  {/* Fase e prazo */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    {processo.fase && (
                      <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600 font-medium">Fase: {processo.fase}</span>
                      </div>
                    )}
                    {processo.prazo_proximo && (
                      <div className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border font-medium ${
                        urgencia === 'vencido' ? 'bg-red-50 border-red-200 text-red-700' :
                        urgencia === 'urgente' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        urgencia === 'proximo' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        {urgencia === 'vencido' || urgencia === 'urgente'
                          ? <AlertCircle className="w-3 h-3" />
                          : <Clock className="w-3 h-3" />
                        }
                        Prazo: {formatDate(processo.prazo_proximo)}
                        {urgencia === 'urgente' && ' — Urgente'}
                        {urgencia === 'vencido' && ' — Vencido'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Movimentações */}
                <div className="p-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                    Andamento do processo
                  </h3>

                  {processo.movimentacoes.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">
                      Nenhuma movimentação registrada ainda.
                    </p>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-100" />
                      <div className="space-y-4">
                        {processo.movimentacoes.map((mov, idx) => (
                          <div key={mov.id} className="relative flex gap-4">
                            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10 ${
                              idx === 0
                                ? (tipoMovStyle[mov.tipo ?? ''] ?? 'bg-blue-500')
                                : 'bg-slate-200'
                            }`}>
                              {idx === 0 ? (
                                <CheckCircle className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-slate-400" />
                              )}
                            </div>
                            <div className={`flex-1 pb-1 ${idx === 0 ? '' : 'opacity-75'}`}>
                              <div className="flex items-center gap-2 mb-0.5">
                                {mov.tipo && (
                                  <span className="text-xs font-semibold text-slate-600">{mov.tipo}</span>
                                )}
                                <span className="text-xs text-slate-400">{formatDateTime(mov.data)}</span>
                              </div>
                              <p className={`text-sm leading-relaxed ${idx === 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                                {mov.descricao}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* Rodapé */}
        <footer className="text-center py-4">
          <p className="text-xs text-slate-400">
            Este portal é atualizado pelo escritório. Para dúvidas, entre em contato diretamente.
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-slate-300">
            <Scale className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">JurisIA</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
