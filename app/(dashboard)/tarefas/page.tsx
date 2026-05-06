import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import KanbanBoard from './_kanban-board'

export default async function TarefasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tarefas } = await supabase
    .from('tarefas')
    .select('*, processos(titulo), profiles(nome)')
    .order('created_at', { ascending: false })

  const { data: processos } = await supabase
    .from('processos')
    .select('id, titulo')
    .eq('status', 'ativo')
    .order('titulo')

  const { data: advogados } = await supabase
    .from('profiles')
    .select('id, nome')
    .order('nome')

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tarefas</h1>
          <p className="text-slate-500 text-sm mt-1">{tarefas?.length ?? 0} tarefa(s) no total</p>
        </div>
        <Link href="/tarefas/nova"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </Link>
      </div>
      <KanbanBoard
        tarefas={tarefas ?? []}
        processos={processos ?? []}
        advogados={advogados ?? []}
        userId={user?.id ?? ''}
      />
    </div>
  )
}
