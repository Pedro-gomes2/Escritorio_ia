import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, TrendingUp, Clock, CheckCircle, XCircle, Pencil } from 'lucide-react'
import { formatDate, formatMoeda } from '@/lib/utils'
import DeleteButton from './_delete-button'

const tipoLabel: Record<string, string> = { fixo: 'Fixo', exito: 'Êxito', hora: 'Por hora', mensal: 'Mensal' }
const statusStyle: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  pago: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-500',
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mes?: string; ano?: string }>
}) {
  const { status, mes, ano } = await searchParams
  const supabase = await createClient()

  const anoAtual = new Date().getFullYear()
  const anoFiltro = ano ? parseInt(ano) : null
  const mesFiltro = mes ? parseInt(mes) : null

  let query = supabase
    .from('honorarios')
    .select('*, clientes(nome), processos(titulo)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  // Filtro por mês/ano usando vencimento
  if (anoFiltro && mesFiltro) {
    const inicio = `${anoFiltro}-${String(mesFiltro).padStart(2, '0')}-01`
    const fimDate = new Date(anoFiltro, mesFiltro, 0) // último dia do mês
    const fim = `${anoFiltro}-${String(mesFiltro).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2,'0')}`
    query = query.gte('vencimento', inicio).lte('vencimento', fim)
  } else if (anoFiltro) {
    query = query.gte('vencimento', `${anoFiltro}-01-01`).lte('vencimento', `${anoFiltro}-12-31`)
  }

  const { data: honorarios } = await query
  const { data: todos } = await supabase.from('honorarios').select('valor, status')

  const totalPendente = todos?.filter(h => h.status === 'pendente').reduce((s, h) => s + h.valor, 0) ?? 0
  const totalPago = todos?.filter(h => h.status === 'pago').reduce((s, h) => s + h.valor, 0) ?? 0
  const totalGeral = (totalPendente + totalPago)

  // Anos disponíveis para filtro (últimos 5 anos + próximo)
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 4 + i)

  // Monta a query string preservando outros filtros
  function filtroUrl(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (ano) p.set('ano', ano)
    if (mes) p.set('mes', mes)
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) p.delete(k)
      else p.set(k, v)
    }
    const s = p.toString()
    return `/financeiro${s ? `?${s}` : ''}`
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-slate-500 text-sm mt-1">Honorários e faturas</p>
        </div>
        <Link href="/financeiro/novo"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Novo Honorário
        </Link>
      </div>

      {/* Cards de resumo (sempre do total geral, sem filtro de período) */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <TrendingUp className="w-4 h-4" />Total geral
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatMoeda(totalGeral)}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-2">
            <Clock className="w-4 h-4" />A receber
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatMoeda(totalPendente)}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-5">
          <div className="flex items-center gap-2 text-green-600 text-sm mb-2">
            <CheckCircle className="w-4 h-4" />Recebido
          </div>
          <p className="text-2xl font-bold text-green-600">{formatMoeda(totalPago)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* Filtro status */}
        <div className="flex gap-1">
          {['', 'pendente', 'pago', 'cancelado'].map(s => (
            <Link key={s} href={filtroUrl({ status: s || undefined })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                (status ?? '') === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Filtro ano */}
        <div className="flex gap-1 flex-wrap">
          <Link href={filtroUrl({ ano: undefined, mes: undefined })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !anoFiltro ? 'bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            Todos os anos
          </Link>
          {anos.map(a => (
            <Link key={a} href={filtroUrl({ ano: String(a), mes: undefined })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                anoFiltro === a ? 'bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {a}
            </Link>
          ))}
        </div>

        {/* Filtro mês (só aparece se ano selecionado) */}
        {anoFiltro && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex gap-1 flex-wrap">
              <Link href={filtroUrl({ mes: undefined })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !mesFiltro ? 'bg-blue-100 text-blue-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                Todo o ano
              </Link>
              {MESES.map((m, i) => (
                <Link key={i} href={filtroUrl({ mes: String(i + 1) })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mesFiltro === i + 1 ? 'bg-blue-100 text-blue-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {m}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {!honorarios || honorarios.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <XCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum honorário{anoFiltro ? ` em ${mesFiltro ? `${MESES[mesFiltro-1]}/${anoFiltro}` : anoFiltro}` : ''}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {honorarios.map(h => (
              <div key={h.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{h.descricao}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    {h.clientes?.nome && <span>{h.clientes.nome}</span>}
                    {h.processos?.titulo && <span>· {h.processos.titulo}</span>}
                    <span>· {tipoLabel[h.tipo]}</span>
                    {h.vencimento && <span>· Vence {formatDate(h.vencimento)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="font-bold text-slate-800">{formatMoeda(h.valor)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle[h.status]}`}>
                    {h.status}
                  </span>

                  {/* Marcar pago */}
                  {h.status === 'pendente' && (
                    <form action={`/api/honorarios/${h.id}/pagar`} method="POST">
                      <button type="submit"
                        className="text-xs text-green-600 hover:text-green-700 border border-green-200 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors font-medium">
                        Marcar pago
                      </button>
                    </form>
                  )}

                  {/* Editar */}
                  <Link href={`/financeiro/${h.id}/editar`}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>

                  {/* Excluir */}
                  <DeleteButton id={h.id} descricao={h.descricao} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
