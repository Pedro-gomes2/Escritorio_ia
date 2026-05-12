import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import HonorarioForm from '../../_honorario-form'

export default async function EditarHonorarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: honorario }, { data: clientes }, { data: processos }] = await Promise.all([
    supabase.from('honorarios').select('*').eq('id', id).single(),
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('processos').select('id, titulo').order('titulo'),
  ])

  if (!honorario) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Editar Honorário</h1>
      <HonorarioForm
        clientes={clientes ?? []}
        processos={processos ?? []}
        honorario={{
          id: honorario.id,
          descricao: honorario.descricao,
          valor: honorario.valor,
          tipo: honorario.tipo,
          status: honorario.status,
          cliente_id: honorario.cliente_id,
          processo_id: honorario.processo_id,
          vencimento: honorario.vencimento,
        }}
      />
    </div>
  )
}
