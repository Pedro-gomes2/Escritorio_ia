'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Clock, AlertCircle, User, FolderOpen } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

type Tarefa = {
  id: string
  titulo: string
  descricao: string | null
  status: string
  prioridade: string
  prazo: string | null
  processos: { titulo: string } | null
  profiles: { nome: string } | null
}

const colunas = [
  { key: 'pendente', label: 'Pendente', color: 'bg-slate-100' },
  { key: 'em_andamento', label: 'Em Andamento', color: 'bg-blue-100' },
  { key: 'revisao', label: 'Revisão', color: 'bg-amber-100' },
  { key: 'concluida', label: 'Concluída', color: 'bg-green-100' },
]

const prioridadeColor: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-100 text-amber-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}

export default function KanbanBoard({
  tarefas: initialTarefas,
}: {
  tarefas: Tarefa[]
  processos: { id: string; titulo: string }[]
  advogados: { id: string; nome: string }[]
  userId: string
}) {
  const [tarefas, setTarefas] = useState(initialTarefas)
  const [dragging, setDragging] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function moveToStatus(id: string, newStatus: string) {
    setTarefas(prev =>
      prev.map(t => t.id === id ? { ...t, status: newStatus } : t)
    )
    await supabase.from('tarefas').update({ status: newStatus }).eq('id', id)
    router.refresh()
  }

  function onDragStart(id: string) {
    setDragging(id)
  }

  function onDrop(status: string) {
    if (dragging) {
      moveToStatus(dragging, status)
      setDragging(null)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
      {colunas.map(col => {
        const colTarefas = tarefas.filter(t => t.status === col.key)
        return (
          <div
            key={col.key}
            className="flex-shrink-0 w-72 flex flex-col"
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(col.key)}
          >
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${col.color}`}>
              <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              <span className="text-xs bg-white rounded-full px-2 py-0.5 font-medium text-slate-600">
                {colTarefas.length}
              </span>
            </div>

            <div className="flex-1 bg-slate-100/60 rounded-b-xl p-2 space-y-2 overflow-y-auto min-h-32">
              {colTarefas.map(tarefa => (
                <div
                  key={tarefa.id}
                  draggable
                  onDragStart={() => onDragStart(tarefa.id)}
                  className={cn(
                    'bg-white rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing border border-slate-100 hover:border-blue-200 transition-colors',
                    dragging === tarefa.id && 'opacity-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-slate-800 leading-tight">{tarefa.titulo}</p>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', prioridadeColor[tarefa.prioridade])}>
                      {tarefa.prioridade}
                    </span>
                  </div>

                  {tarefa.descricao && (
                    <p className="text-xs text-slate-500 mb-2 line-clamp-2">{tarefa.descricao}</p>
                  )}

                  <div className="space-y-1">
                    {tarefa.processos?.titulo && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <FolderOpen className="w-3 h-3" />
                        <span className="truncate">{tarefa.processos.titulo}</span>
                      </div>
                    )}
                    {tarefa.profiles?.nome && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <User className="w-3 h-3" />
                        <span>{tarefa.profiles.nome}</span>
                      </div>
                    )}
                    {tarefa.prazo && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(tarefa.prazo)}</span>
                      </div>
                    )}
                  </div>

                  {col.key !== 'concluida' && (
                    <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
                      {colunas
                        .filter(c => c.key !== col.key)
                        .map(c => (
                          <button
                            key={c.key}
                            onClick={() => moveToStatus(tarefa.id, c.key)}
                            className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            → {c.label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ))}

              {colTarefas.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-xs text-slate-400">
                  Sem tarefas
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
