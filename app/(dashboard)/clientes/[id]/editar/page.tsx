import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClienteForm from '../../../_components/cliente-form'

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Editar Cliente</h1>
      <ClienteForm cliente={cliente} />
    </div>
  )
}
