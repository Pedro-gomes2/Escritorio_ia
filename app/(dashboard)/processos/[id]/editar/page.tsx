import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProcessoForm from '../../../_components/processo-form'

export default async function EditarProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: processo }, { data: clientes }, { data: advogados }] = await Promise.all([
    supabase.from('processos').select('*').eq('id', id).single(),
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('profiles').select('id, nome').order('nome'),
  ])

  if (!processo) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Editar Processo</h1>
      <ProcessoForm processo={processo} clientes={clientes ?? []} advogados={advogados ?? []} />
    </div>
  )
}
