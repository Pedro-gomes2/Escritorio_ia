import { createClient } from '@/lib/supabase/server'
import TarefaForm from '../../_components/tarefa-form'

export default async function NovaTarefaPage({
  searchParams,
}: {
  searchParams: Promise<{ processo_id?: string }>
}) {
  const { processo_id } = await searchParams
  const supabase = await createClient()

  const [{ data: processos }, { data: advogados }] = await Promise.all([
    supabase.from('processos').select('id, titulo').eq('status', 'ativo').order('titulo'),
    supabase.from('profiles').select('id, nome').order('nome'),
  ])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Nova Tarefa</h1>
      <TarefaForm
        processos={processos ?? []}
        advogados={advogados ?? []}
        defaultProcessoId={processo_id}
      />
    </div>
  )
}
