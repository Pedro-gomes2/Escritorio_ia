import { createClient } from '@/lib/supabase/server'
import HonorarioForm from '../_honorario-form'

export default async function NovoHonorarioPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string }>
}) {
  const { cliente_id } = await searchParams
  const supabase = await createClient()

  const [{ data: clientes }, { data: processos }] = await Promise.all([
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('processos').select('id, titulo').eq('status', 'ativo').order('titulo'),
  ])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Novo Honorário</h1>
      <HonorarioForm
        clientes={clientes ?? []}
        processos={processos ?? []}
        defaultClienteId={cliente_id}
      />
    </div>
  )
}
