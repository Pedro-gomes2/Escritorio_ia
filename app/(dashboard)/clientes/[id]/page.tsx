import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, FolderOpen, DollarSign, Mail, Phone, MapPin, BarChart3 } from 'lucide-react'
import { formatDate, formatMoeda } from '@/lib/utils'
import CopiarLinkPortal from './_copiar-link'
import WhatsappButton from './_whatsapp-button'
import AbrirPasta from './_abrir-pasta'

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  const { data: processos } = await supabase
    .from('processos')
    .select('id, titulo, numero, status, prazo_proximo, tipo')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })

  const { data: honorarios } = await supabase
    .from('honorarios')
    .select('*')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })

  const totalPendente = honorarios?.filter(h => h.status === 'pendente').reduce((s, h) => s + h.valor, 0) ?? 0
  const totalPago = honorarios?.filter(h => h.status === 'pago').reduce((s, h) => s + h.valor, 0) ?? 0

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/clientes" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{cliente.nome}</h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            cliente.tipo === 'pj' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {cliente.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
          </span>
        </div>
        <AbrirPasta nome={cliente.nome} pastaPath={cliente.pasta_path ?? null} />
        <Link href={`/previdencia/cnis?clienteId=${id}`}
          className="flex items-center gap-2 border border-blue-200 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <BarChart3 className="w-4 h-4" />
          CNIS
        </Link>
        <WhatsappButton clienteId={id} nome={cliente.nome} telefone={cliente.telefone ?? null} />
        <CopiarLinkPortal token={cliente.token_portal} nome={cliente.nome} email={cliente.email} />
        <Link href={`/clientes/${id}/editar`}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Pencil className="w-4 h-4" />
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Processos</p>
          <p className="text-2xl font-bold text-slate-800">{processos?.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">A Receber</p>
          <p className="text-2xl font-bold text-amber-600">{formatMoeda(totalPendente)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Recebido</p>
          <p className="text-2xl font-bold text-green-600">{formatMoeda(totalPago)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Dados do Cliente</h3>
            <dl className="space-y-3 text-sm">
              {cliente.cpf_cnpj && (
                <div>
                  <dt className="text-slate-500 text-xs">{cliente.tipo === 'pj' ? 'CNPJ' : 'CPF'}</dt>
                  <dd className="font-medium text-slate-700">{cliente.cpf_cnpj}</dd>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`mailto:${cliente.email}`} className="text-blue-600 hover:underline">{cliente.email}</a>
                </div>
              )}
              {cliente.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cliente.telefone}</span>
                </div>
              )}
              {cliente.endereco && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                  <span className="text-slate-600">{cliente.endereco}</span>
                </div>
              )}
              <div>
                <dt className="text-slate-500 text-xs">Cliente desde</dt>
                <dd className="font-medium text-slate-700">{formatDate(cliente.created_at)}</dd>
              </div>
            </dl>
            {cliente.observacoes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Observações</p>
                <p className="text-sm text-slate-600">{cliente.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-500" />
                Processos
              </h3>
              <Link href={`/processos/novo?cliente_id=${id}`}
                className="text-xs text-blue-600 hover:underline">+ Novo processo</Link>
            </div>
            {processos?.length === 0 ? (
              <p className="text-slate-400 text-sm py-6 text-center">Nenhum processo vinculado</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {processos?.map(p => (
                  <Link key={p.id} href={`/processos/${p.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{p.titulo}</p>
                      <p className="text-xs text-slate-400">{p.numero ?? 'Sem número'} · {p.tipo}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      p.status === 'ativo' ? 'bg-green-100 text-green-700' :
                      p.status === 'encerrado' ? 'bg-slate-100 text-slate-600' :
                      'bg-amber-100 text-amber-700'
                    }`}>{p.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                Honorários
              </h3>
              <Link href={`/financeiro/novo?cliente_id=${id}`}
                className="text-xs text-blue-600 hover:underline">+ Novo honorário</Link>
            </div>
            {honorarios?.length === 0 ? (
              <p className="text-slate-400 text-sm py-6 text-center">Nenhum honorário registrado</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {honorarios?.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{h.descricao}</p>
                      <p className="text-xs text-slate-400">
                        {h.tipo} · {h.vencimento ? `Vence ${formatDate(h.vencimento)}` : 'Sem vencimento'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-800">{formatMoeda(h.valor)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        h.status === 'pago' ? 'bg-green-100 text-green-700' :
                        h.status === 'cancelado' ? 'bg-slate-100 text-slate-500' :
                        'bg-amber-100 text-amber-700'
                      }`}>{h.status}</span>
                    </div>
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
