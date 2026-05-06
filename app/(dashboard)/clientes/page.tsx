import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Users, Phone, Mail, Building2, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('clientes')
    .select('*, processos(count)')
    .order('nome')

  if (q) {
    query = query.or(`nome.ilike.%${q}%,cpf_cnpj.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: clientes } = await query

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">{clientes?.length ?? 0} cliente(s) cadastrado(s)</p>
        </div>
        <Link
          href="/clientes/novo"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <form className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
        </div>

        {clientes?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm mt-1">
              {q ? 'Tente uma busca diferente' : 'Cadastre seu primeiro cliente'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {clientes?.map(cliente => (
              <Link
                key={cliente.id}
                href={`/clientes/${cliente.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  {cliente.tipo === 'pj'
                    ? <Building2 className="w-5 h-5 text-blue-600" />
                    : <User className="w-5 h-5 text-blue-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{cliente.nome}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {cliente.cpf_cnpj && (
                      <span className="text-xs text-slate-500">{cliente.cpf_cnpj}</span>
                    )}
                    {cliente.email && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />{cliente.email}
                      </span>
                    )}
                    {cliente.telefone && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{cliente.telefone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    cliente.tipo === 'pj'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {cliente.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    desde {formatDate(cliente.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
