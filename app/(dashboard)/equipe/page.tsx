import { createClient } from '@/lib/supabase/server'
import { UserCircle, Scale } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import EditarPerfilForm from './_editar-perfil'

const cargoLabel: Record<string, string> = {
  socio: 'Sócio(a)', advogado: 'Advogado(a)', estagiario: 'Estagiário(a)',
}
const cargoBadge: Record<string, string> = {
  socio: 'bg-purple-100 text-purple-700',
  advogado: 'bg-blue-100 text-blue-700',
  estagiario: 'bg-slate-100 text-slate-600',
}

export default async function EquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profiles }, { data: meuPerfil }] = await Promise.all([
    supabase.from('profiles').select('*').order('cargo').order('nome'),
    supabase.from('profiles').select('*').eq('id', user?.id).single(),
  ])

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Equipe</h1>
        <p className="text-slate-500 text-sm mt-1">{profiles?.length ?? 0} membro(s) no escritório</p>
      </div>

      {meuPerfil && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">Meu Perfil</h3>
          <EditarPerfilForm perfil={meuPerfil} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Membros do Escritório</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {profiles?.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-6 h-6 text-slate-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{p.nome}</p>
                  {p.id === user?.id && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">você</span>
                  )}
                </div>
                {p.oab && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Scale className="w-3 h-3" /> OAB: {p.oab}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${cargoBadge[p.cargo ?? 'advogado']}`}>
                  {cargoLabel[p.cargo ?? 'advogado']}
                </span>
                <p className="text-xs text-slate-400 mt-1">desde {formatDate(p.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
