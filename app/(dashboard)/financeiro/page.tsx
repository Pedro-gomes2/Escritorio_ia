import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatDate, formatMoeda } from '@/lib/utils'

const tipoLabel: Record<string, string> = { fixo: 'Fixo', exito: 'Êxito', hora: 'Por hora', mensal: 'Mensal' }
const statusStyle: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  pago: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-500',
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('honorarios')
    .select('*, clientes(nome), processos(titulo)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: honorarios } = await query
  const { data: todos } = await supabase.from('honorarios').select('valor, status')

  const totalPendente = todos?.filter(h => h.status === 'pendente').reduce((s, h) => s + h.valor, 0) ?? 0
  const totalPago = todos?.filter(h => h.status === 'pago').reduce((s, h) => s + h.valor, 0) ?? 0
  const totalGeral = (totalPendente + totalPago)

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

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <TrendingUp className="w-4 h-4" />
            Total geral
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatMoeda(totalGeral)}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-2">
            <Clock className="w-4 h-4" />
            A receber
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatMoeda(totalPendente)}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-5">
          <div className="flex items-center gap-2 text-green-600 text-sm mb-2">
            <CheckCircle className="w-4 h-4" />
            Recebido
          </div>
          <p className="text-2xl font-bold text-green-600">{formatMoeda(totalPago)}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'pendente', 'pago', 'cancelado'].map(s => (
          <Link key={s} href={s ? `/financeiro?status=${s}` : '/financeiro'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (status ?? '') === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {honorarios?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <XCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum honorário registrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {honorarios?.map(h => (
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
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="font-bold text-slate-800">{formatMoeda(h.valor)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle[h.status]}`}>
                    {h.status}
                  </span>
                  <HonorarioActions id={h.id} status={h.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HonorarioActions({ id, status }: { id: string; status: string }) {
  if (status === 'pago' || status === 'cancelado') return null
  return (
    <form action={`/api/honorarios/${id}/pagar`} method="POST">
      <button type="submit"
        className="text-xs text-green-600 hover:text-green-700 border border-green-200 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors font-medium">
        Marcar pago
      </button>
    </form>
  )
}
