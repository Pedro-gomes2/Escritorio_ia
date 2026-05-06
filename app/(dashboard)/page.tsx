import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  FolderOpen, CheckSquare, DollarSign, AlertCircle,
  Clock, TrendingUp, Users, Bot, ArrowRight
} from 'lucide-react'
import { formatDate, formatMoeda, prazoUrgencia } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo')
    .eq('id', user?.id)
    .single()

  const [
    { count: processosAtivos },
    { count: tarefasPendentes },
    { data: prazosProximos },
    { data: tarefasUrgentes },
    { data: honorariosPendentes },
    { data: processosRecentes },
    { count: totalClientes },
  ] = await Promise.all([
    supabase.from('processos').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('tarefas').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'em_andamento']),
    supabase.from('processos')
      .select('id, titulo, prazo_proximo, status')
      .not('prazo_proximo', 'is', null)
      .eq('status', 'ativo')
      .gte('prazo_proximo', new Date().toISOString())
      .order('prazo_proximo')
      .limit(5),
    supabase.from('tarefas')
      .select('id, titulo, prazo, prioridade, processos(titulo)')
      .in('prioridade', ['alta', 'urgente'])
      .in('status', ['pendente', 'em_andamento'])
      .order('prazo')
      .limit(5),
    supabase.from('honorarios')
      .select('valor, status')
      .eq('status', 'pendente'),
    supabase.from('processos')
      .select('id, titulo, status, created_at, clientes(nome)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
  ])

  const totalPendente = honorariosPendentes?.reduce((s, h) => s + h.valor, 0) ?? 0

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          {saudacao}, {profile?.nome?.split(' ')[0] ?? 'Advogado(a)'}!
        </h1>
        <p className="text-slate-500 mt-1">Aqui está o resumo do escritório hoje.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Processos ativos', value: processosAtivos ?? 0, icon: FolderOpen,
            color: 'text-blue-600', bg: 'bg-blue-50', href: '/processos',
          },
          {
            label: 'Tarefas pendentes', value: tarefasPendentes ?? 0, icon: CheckSquare,
            color: 'text-amber-600', bg: 'bg-amber-50', href: '/tarefas',
          },
          {
            label: 'A receber', value: formatMoeda(totalPendente), icon: DollarSign,
            color: 'text-green-600', bg: 'bg-green-50', href: '/financeiro',
          },
          {
            label: 'Clientes', value: totalClientes ?? 0, icon: Users,
            color: 'text-purple-600', bg: 'bg-purple-50', href: '/clientes',
          },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={href} href={href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all group">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Prazos próximos */}
        <div className="col-span-1 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-500" />
              Prazos Próximos
            </h3>
            <Link href="/processos" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
          </div>
          {prazosProximos?.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">Sem prazos próximos</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {prazosProximos?.map(p => {
                const urgencia = prazoUrgencia(p.prazo_proximo!)
                return (
                  <Link key={p.id} href={`/processos/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      urgencia === 'urgente' ? 'bg-red-500' :
                      urgencia === 'proximo' ? 'bg-amber-400' : 'bg-slate-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{p.titulo}</p>
                      <p className="text-xs text-slate-400">{formatDate(p.prazo_proximo!)}</p>
                    </div>
                    {urgencia === 'urgente' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Tarefas urgentes */}
        <div className="col-span-1 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Tarefas Urgentes
            </h3>
            <Link href="/tarefas" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
          </div>
          {tarefasUrgentes?.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">Sem tarefas urgentes</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {tarefasUrgentes?.map(t => (
                <div key={t.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${
                      t.prioridade === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>{t.prioridade}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{t.titulo}</p>
                      {Array.isArray(t.processos) && t.processos[0]?.titulo && (
                        <p className="text-xs text-slate-400">{t.processos[0].titulo}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos e processos recentes */}
        <div className="col-span-1 space-y-4">
          {/* Atalho assistente IA */}
          <Link href="/assistente"
            className="block bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white hover:from-blue-700 hover:to-blue-800 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="w-6 h-6" />
              <span className="font-semibold">Assistente IA</span>
            </div>
            <p className="text-sm text-blue-100">Analise documentos e pesquise jurisprudência com inteligência artificial</p>
            <div className="flex items-center gap-1 text-xs text-blue-200 mt-3">
              Acessar assistente <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          {/* Processos recentes */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Processos Recentes</h3>
              <Link href="/processos/novo" className="text-xs text-blue-600 hover:underline">+ Novo</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {processosRecentes?.map(p => (
                <Link key={p.id} href={`/processos/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.titulo}</p>
                    <p className="text-xs text-slate-400">{(Array.isArray(p.clientes) ? p.clientes[0]?.nome : (p.clientes as { nome: string } | null)?.nome) ?? 'Sem cliente'}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    p.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>{p.status}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
