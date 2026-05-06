import { createClient } from '@/lib/supabase/server'
import ProcessoForm from '../../_components/processo-form'

export default async function NovoProcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string }>
}) {
  const { cliente_id } = await searchParams
  const supabase = await createClient()

  const [{ data: clientes }, { data: advogados }] = await Promise.all([
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('profiles').select('id, nome').order('nome'),
  ])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Novo Processo</h1>
      <ProcessoForm
        clientes={clientes ?? []}
        advogados={advogados ?? []}
        defaultClienteId={cliente_id}
      />
    </div>
  )
}
